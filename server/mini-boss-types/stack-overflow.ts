import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const BOSS_HP = 30;
const HEAT_PER_CLICK = 15;
const HEAT_DECAY_PER_TICK = 8;
const HEAT_DECAY_SLOW = 5; // below 25% boss HP
const OVERHEAT_THRESHOLD = 100;
const LOCKOUT_DURATION_MS = 3000;
const BOSS_HEAL_ON_OVERHEAT = 8;
const LOCKOUT_HEAT_RESET = 60;
const COOLANT_HEAT_REDUCTION = 30;
const COOLANT_LIFETIME_MS = 3500;
const COOLANT_SPAWN_INTERVAL = 5; // ticks (seconds)
const COOLANT_SPAWN_SLOW = 7; // below 50% boss HP

interface OverheatData {
  heat: number;
  lockedOut: boolean;
  lockoutEndsAt: number;
  ticksSinceCoolant: number;
  _nextCoolantId: number;
  _extra: {
    heat: number;
    lockedOut: boolean;
  };
}

function randomPos(): { x: number; y: number } {
  const pad = 80;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

function bossSpeed(hp: number): number {
  if (hp <= BOSS_HP * 0.25) return 40;
  if (hp <= BOSS_HP * 0.5) return 25;
  return 15;
}

export const stackOverflowPlugin: MiniBossPlugin = {
  typeKey: 'stack-overflow',
  displayName: 'Stack Overflow',
  icon: '\u{1F525}',
  description: 'Don\'t overheat! Spam-clicking locks you out and heals the boss.',
  timeLimit: 40,
  defeatPenalty: 25,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    const data: OverheatData = {
      heat: 0,
      lockedOut: false,
      lockoutEndsAt: 0,
      ticksSinceCoolant: 0,
      _nextCoolantId: 1,
      _extra: { heat: 0, lockedOut: false },
    };
    mb.data = data as unknown as Record<string, unknown>;

    return [{
      id: 'mb_boss',
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      hp: BOSS_HP,
      maxHp: BOSS_HP,
      variant: 'boss',
    }];
  },

  onClick(ctx: GameContext, _pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as OverheatData;
    const now = Date.now();

    // Check lockout
    if (data.lockedOut) {
      if (now < data.lockoutEndsAt) {
        return; // still locked out, ignore click
      }
      // Lockout expired during click handling
      data.lockedOut = false;
      data._extra.lockedOut = false;
    }

    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity || entity.hp <= 0) return;

    // Clicking a coolant pickup
    if (entity.variant === 'coolant') {
      data.heat = Math.max(0, data.heat - COOLANT_HEAT_REDUCTION);
      data._extra.heat = data.heat;
      // Remove coolant
      mb.entities = mb.entities.filter(e => e.id !== entityId);
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      return;
    }

    // Clicking the boss
    if (entity.variant === 'boss') {
      data.heat += HEAT_PER_CLICK;

      if (data.heat >= OVERHEAT_THRESHOLD) {
        // OVERHEAT! Lockout + boss heals
        data.lockedOut = true;
        data.lockoutEndsAt = now + LOCKOUT_DURATION_MS;
        data.heat = LOCKOUT_HEAT_RESET;
        entity.hp = Math.min(entity.maxHp, entity.hp + BOSS_HEAL_ON_OVERHEAT);
        data._extra = { heat: data.heat, lockedOut: true };

        ctx.events.emit({
          type: 'mini-boss-entity-update',
          entities: mb.entities,
          warning: 'OVERHEATED! Locked out for 3s — boss heals!',
          extra: { ...data._extra },
        });
        return;
      }

      // Normal damage
      entity.hp--;
      data._extra.heat = data.heat;
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
    }
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as OverheatData;
    const now = Date.now();
    const boss = mb.entities.find(e => e.variant === 'boss');
    if (!boss) return;

    // Check lockout expiry
    if (data.lockedOut && now >= data.lockoutEndsAt) {
      data.lockedOut = false;
      data._extra.lockedOut = false;
    }

    // Decay heat
    if (!data.lockedOut) {
      const decayRate = boss.hp <= BOSS_HP * 0.25 ? HEAT_DECAY_SLOW : HEAT_DECAY_PER_TICK;
      data.heat = Math.max(0, data.heat - decayRate);
      data._extra.heat = data.heat;
    }

    // Move boss
    const speed = bossSpeed(boss.hp);
    const angle = Math.random() * Math.PI * 2;
    const pad = 60;
    boss.x = Math.max(pad, Math.min(LOGICAL_W - pad, boss.x + Math.cos(angle) * speed));
    boss.y = Math.max(pad, Math.min(LOGICAL_H - pad, boss.y + Math.sin(angle) * speed));

    // Remove expired coolants
    mb.entities = mb.entities.filter(
      e => e.variant !== 'coolant' || !e.spawnedAt || (now - e.spawnedAt) < COOLANT_LIFETIME_MS
    );

    // Spawn coolant
    data.ticksSinceCoolant++;
    const spawnInterval = boss.hp <= BOSS_HP * 0.5 ? COOLANT_SPAWN_SLOW : COOLANT_SPAWN_INTERVAL;
    if (data.ticksSinceCoolant >= spawnInterval) {
      data.ticksSinceCoolant = 0;
      const pos = randomPos();
      const coolantId = 'mb_coolant_' + data._nextCoolantId++;
      mb.entities.push({
        id: coolantId,
        x: pos.x,
        y: pos.y,
        hp: 1,
        maxHp: 1,
        variant: 'coolant',
        spawnedAt: now,
      });
    }
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const boss = mb.entities.find(e => e.variant === 'boss');
    return !boss || boss.hp <= 0;
  },
};
