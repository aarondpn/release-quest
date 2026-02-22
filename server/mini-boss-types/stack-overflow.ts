import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const BOSS_HP = 22;           // was 30 — too much for 40s solo; player hit 2 HP remaining
const HEAT_PER_CLICK = 15;
const HEAT_DECAY_PER_TICK = 11; // was 8 — net heat/click was +7, now +4; slightly more forgiving pace
const HEAT_DECAY_SLOW = 7;    // was 5 — below 25% boss HP
const OVERHEAT_THRESHOLD = 100;
const LOCKOUT_DURATION_MS = 2500; // was 3000ms
const BOSS_HEAL_ON_OVERHEAT = 4;  // was 8 — one overheat was costing ~3s of progress
const LOCKOUT_HEAT_RESET = 55;
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

    logger.info({
      miniBoss: 'stack-overflow',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        BOSS_HP,
        HEAT_PER_CLICK,
        HEAT_DECAY_PER_TICK,
        OVERHEAT_THRESHOLD,
        LOCKOUT_DURATION_MS,
        BOSS_HEAL_ON_OVERHEAT,
        COOLANT_HEAT_REDUCTION,
        COOLANT_SPAWN_INTERVAL,
        timeLimit: 40,
      },
      note: `Overheat at ${OVERHEAT_THRESHOLD} heat. ${Math.floor(OVERHEAT_THRESHOLD / HEAT_PER_CLICK)} clicks = overheat. Net heat/click at 1/s = ${HEAT_PER_CLICK - HEAT_DECAY_PER_TICK} → heat will accumulate!`,
    }, '[StackOverflow] Boss initialized');

    return [{
      id: 'mb_boss',
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      hp: BOSS_HP,
      maxHp: BOSS_HP,
      variant: 'boss',
    }];
  },

  onClick(ctx: GameContext, pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as OverheatData;
    const now = Date.now();

    // Check lockout
    if (data.lockedOut) {
      if (now < data.lockoutEndsAt) {
        const remainingMs = data.lockoutEndsAt - now;
        logger.info({
          miniBoss: 'stack-overflow',
          event: 'click-blocked-lockout',
          lobbyId: ctx.lobbyId,
          pid,
          entityId,
          remainingLockoutMs: remainingMs,
          heat: data.heat,
        }, '[StackOverflow] Click ignored — still locked out');
        return; // still locked out, ignore click
      }
      // Lockout expired during click handling
      data.lockedOut = false;
      data._extra.lockedOut = false;
      logger.info({
        miniBoss: 'stack-overflow',
        event: 'lockout-expired',
        lobbyId: ctx.lobbyId,
        heat: data.heat,
      }, '[StackOverflow] Lockout expired during click');
    }

    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity || entity.hp <= 0) {
      logger.info({
        miniBoss: 'stack-overflow',
        event: 'click-no-entity',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
        entityFound: !!entity,
        entityHp: entity?.hp,
      }, '[StackOverflow] Click on missing/dead entity');
      return;
    }

    // Clicking a coolant pickup
    if (entity.variant === 'coolant') {
      const heatBefore = data.heat;
      data.heat = Math.max(0, data.heat - COOLANT_HEAT_REDUCTION);
      data._extra.heat = data.heat;
      // Remove coolant
      mb.entities = mb.entities.filter(e => e.id !== entityId);

      logger.info({
        miniBoss: 'stack-overflow',
        event: 'coolant-collected',
        lobbyId: ctx.lobbyId,
        pid,
        coolantId: entityId,
        heatBefore,
        heatAfter: data.heat,
        heatReduced: heatBefore - data.heat,
        remainingCoolants: mb.entities.filter(e => e.variant === 'coolant').length,
      }, '[StackOverflow] Coolant collected');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      return;
    }

    // Clicking the boss
    if (entity.variant === 'boss') {
      const heatBefore = data.heat;
      const bossHpBefore = entity.hp;
      data.heat += HEAT_PER_CLICK;

      if (data.heat >= OVERHEAT_THRESHOLD) {
        // OVERHEAT! Lockout + boss heals
        data.lockedOut = true;
        data.lockoutEndsAt = now + LOCKOUT_DURATION_MS;
        data.heat = LOCKOUT_HEAT_RESET;
        entity.hp = Math.min(entity.maxHp, entity.hp + BOSS_HEAL_ON_OVERHEAT);
        data._extra = { heat: data.heat, lockedOut: true };

        logger.warn({
          miniBoss: 'stack-overflow',
          event: 'overheat',
          lobbyId: ctx.lobbyId,
          pid,
          heatBefore,
          heatAtOverheat: OVERHEAT_THRESHOLD,
          heatResetTo: LOCKOUT_HEAT_RESET,
          bossHpBefore,
          bossHpAfter: entity.hp,
          healAmount: BOSS_HEAL_ON_OVERHEAT,
          lockoutMs: LOCKOUT_DURATION_MS,
          timeRemaining: mb.timeRemaining,
        }, '[StackOverflow] OVERHEAT — boss healed, player locked out');

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

      logger.info({
        miniBoss: 'stack-overflow',
        event: 'click-damage',
        lobbyId: ctx.lobbyId,
        pid,
        heatBefore,
        heatAfter: data.heat,
        heatUntilOverheat: OVERHEAT_THRESHOLD - data.heat,
        bossHpBefore,
        bossHpAfter: entity.hp,
        timeRemaining: mb.timeRemaining,
      }, '[StackOverflow] Boss hit');

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
      logger.info({
        miniBoss: 'stack-overflow',
        event: 'lockout-expired-tick',
        lobbyId: ctx.lobbyId,
        heat: data.heat,
        timeRemaining: mb.timeRemaining,
      }, '[StackOverflow] Lockout expired (tick)');
    }

    // Decay heat
    const heatBefore = data.heat;
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
    const coolantsBefore = mb.entities.filter(e => e.variant === 'coolant').length;
    mb.entities = mb.entities.filter(
      e => e.variant !== 'coolant' || !e.spawnedAt || (now - e.spawnedAt) < COOLANT_LIFETIME_MS
    );
    const coolantsAfter = mb.entities.filter(e => e.variant === 'coolant').length;
    const expiredCount = coolantsBefore - coolantsAfter;

    // Spawn coolant
    data.ticksSinceCoolant++;
    const spawnInterval = boss.hp <= BOSS_HP * 0.5 ? COOLANT_SPAWN_SLOW : COOLANT_SPAWN_INTERVAL;
    let coolantSpawned = false;
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
      coolantSpawned = true;
    }

    logger.info({
      miniBoss: 'stack-overflow',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      timeRemaining: mb.timeRemaining,
      bossHp: boss.hp,
      bossMaxHp: boss.maxHp,
      heat: data.heat,
      heatDecayed: heatBefore - data.heat,
      lockedOut: data.lockedOut,
      activeCoolants: mb.entities.filter(e => e.variant === 'coolant').length,
      expiredCoolants: expiredCount,
      coolantSpawned,
      ticksSinceCoolant: data.ticksSinceCoolant,
      nextCoolantInTicks: spawnInterval - data.ticksSinceCoolant,
    }, '[StackOverflow] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const boss = mb.entities.find(e => e.variant === 'boss');
    const victory = !boss || boss.hp <= 0;
    if (victory) {
      logger.info({
        miniBoss: 'stack-overflow',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
      }, '[StackOverflow] Victory condition met');
    }
    return victory;
  },
};
