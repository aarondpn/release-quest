import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const BOSS_HP = 15;
const FRAME_LIFETIME_MS = 3000;
const OVERFLOW_THRESHOLD = 6;
const OVERFLOW_HEAL = 3;
const EXPIRED_FRAME_HEAL = 1;
const RECURSIVE_TICK_INTERVAL = 8;
const PAD = 70;

interface StackPurgeData {
  bossHp: number;
  tickCount: number;
  _nextFrameId: number;
  _extra: {
    bossHp: number;
    bossMaxHp: number;
    overflow: boolean;
  };
}

function randomPos(): { x: number; y: number } {
  return {
    x: PAD + Math.random() * (LOGICAL_W - PAD * 2),
    y: PAD + Math.random() * (LOGICAL_H - PAD * 2),
  };
}

function spawnRate(bossHp: number): number {
  if (bossHp < 5) return 3;
  if (bossHp < 10) return 2;
  return 1;
}

export const stackOverflowPlugin: MiniBossPlugin = {
  typeKey: 'stack-overflow',
  displayName: 'Stack Purge',
  icon: '\u{1F525}',
  description: 'Pop the stack frames before they overflow! Click frames to eliminate them.',
  timeLimit: 30,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    const data: StackPurgeData = {
      bossHp: BOSS_HP,
      tickCount: 0,
      _nextFrameId: 1,
      _extra: {
        bossHp: BOSS_HP,
        bossMaxHp: BOSS_HP,
        overflow: false,
      },
    };
    mb.data = data as unknown as Record<string, unknown>;

    logger.info({
      miniBoss: 'stack-overflow',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        BOSS_HP,
        FRAME_LIFETIME_MS,
        OVERFLOW_THRESHOLD,
        OVERFLOW_HEAL,
        EXPIRED_FRAME_HEAL,
        RECURSIVE_TICK_INTERVAL,
        timeLimit: 30,
      },
      note: `${OVERFLOW_THRESHOLD} frames triggers overflow (+${OVERFLOW_HEAL} boss HP). Each expired frame heals ${EXPIRED_FRAME_HEAL} HP.`,
    }, '[StackPurge] Boss initialized');

    const now = Date.now();
    const firstPos = randomPos();
    return [
      {
        id: 'mb_boss',
        x: LOGICAL_W / 2,
        y: LOGICAL_H / 2,
        hp: BOSS_HP,
        maxHp: BOSS_HP,
        variant: 'boss',
      },
      {
        id: 'mb_frame_0',
        x: firstPos.x,
        y: firstPos.y,
        hp: 1,
        maxHp: 1,
        variant: 'frame',
        spawnedAt: now,
      },
    ];
  },

  onClick(ctx: GameContext, pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as StackPurgeData;
    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity || entity.hp <= 0) return;

    // Boss entity at center is decorative — ignore clicks on it
    if (entity.variant === 'boss') return;

    const now = Date.now();

    if (entity.variant === 'recursive-frame') {
      // Recursive frame: 2 damage but spawns 2 new frames nearby
      const hpBefore = data.bossHp;
      data.bossHp = Math.max(0, data.bossHp - 2);
      data._extra.bossHp = data.bossHp;

      mb.entities = mb.entities.filter(e => e.id !== entityId);

      // Spawn 2 new regular frames nearby
      const spread = 80;
      for (let i = 0; i < 2; i++) {
        const nx = Math.max(PAD, Math.min(LOGICAL_W - PAD, entity.x + (Math.random() - 0.5) * spread * 2));
        const ny = Math.max(PAD, Math.min(LOGICAL_H - PAD, entity.y + (Math.random() - 0.5) * spread * 2));
        mb.entities.push({
          id: 'mb_frame_' + data._nextFrameId++,
          x: nx,
          y: ny,
          hp: 1,
          maxHp: 1,
          variant: 'frame',
          spawnedAt: now,
        });
      }

      const bossEnt = mb.entities.find(e => e.variant === 'boss');
      if (bossEnt) bossEnt.hp = data.bossHp;

      logger.info({
        miniBoss: 'stack-overflow',
        event: 'recursive-frame-click',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
        bossHpBefore: hpBefore,
        bossHpAfter: data.bossHp,
        activeFrames: mb.entities.filter(e => e.variant === 'frame' || e.variant === 'recursive-frame').length,
        timeRemaining: mb.timeRemaining,
      }, '[StackPurge] Recursive frame popped — 2 damage, 2 new frames spawned');
    } else {
      // Regular frame: 1 damage
      const hpBefore = data.bossHp;
      data.bossHp = Math.max(0, data.bossHp - 1);
      data._extra.bossHp = data.bossHp;
      mb.entities = mb.entities.filter(e => e.id !== entityId);

      const bossEnt = mb.entities.find(e => e.variant === 'boss');
      if (bossEnt) bossEnt.hp = data.bossHp;

      logger.info({
        miniBoss: 'stack-overflow',
        event: 'frame-click',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
        bossHpBefore: hpBefore,
        bossHpAfter: data.bossHp,
        activeFrames: mb.entities.filter(e => e.variant === 'frame' || e.variant === 'recursive-frame').length,
        timeRemaining: mb.timeRemaining,
      }, '[StackPurge] Frame popped');
    }

    ctx.events.emit({
      type: 'mini-boss-entity-update',
      entities: mb.entities,
      extra: { ...data._extra },
    });
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as StackPurgeData;
    const now = Date.now();
    data.tickCount++;

    // Expire old frames, heal boss for each expired one
    const expiredFrames = mb.entities.filter(
      e => (e.variant === 'frame' || e.variant === 'recursive-frame') &&
        e.spawnedAt !== undefined && (now - e.spawnedAt!) >= FRAME_LIFETIME_MS
    );
    for (const frame of expiredFrames) {
      data.bossHp = Math.min(BOSS_HP, data.bossHp + EXPIRED_FRAME_HEAL);
    }
    if (expiredFrames.length > 0) {
      const expiredIds = new Set(expiredFrames.map(e => e.id));
      mb.entities = mb.entities.filter(e => !expiredIds.has(e.id));
    }
    const expiredCount = expiredFrames.length;

    // Check overflow threshold AFTER expiry
    const activeFrames = mb.entities.filter(e => e.variant === 'frame' || e.variant === 'recursive-frame');
    if (activeFrames.length >= OVERFLOW_THRESHOLD) {
      data.bossHp = Math.min(BOSS_HP, data.bossHp + OVERFLOW_HEAL);
      mb.entities = mb.entities.filter(e => e.variant === 'boss');
      data._extra.bossHp = data.bossHp;
      data._extra.overflow = true;

      const bossEnt = mb.entities.find(e => e.variant === 'boss');
      if (bossEnt) bossEnt.hp = data.bossHp;

      logger.warn({
        miniBoss: 'stack-overflow',
        event: 'overflow',
        lobbyId: ctx.lobbyId,
        framesClearedCount: activeFrames.length,
        bossHp: data.bossHp,
        healAmount: OVERFLOW_HEAL,
        timeRemaining: mb.timeRemaining,
      }, '[StackPurge] OVERFLOW — boss healed, all frames cleared');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'STACK OVERFLOW! Boss healed!',
        extra: { ...data._extra },
      });
      data._extra.overflow = false;

      // Spawn a fresh frame after clearing
      const pos = randomPos();
      mb.entities.push({
        id: 'mb_frame_' + data._nextFrameId++,
        x: pos.x,
        y: pos.y,
        hp: 1,
        maxHp: 1,
        variant: 'frame',
        spawnedAt: now,
      });
      return;
    }

    // Spawn new frames based on boss HP phase
    const rate = spawnRate(data.bossHp);
    const isRecursiveTick = data.tickCount % RECURSIVE_TICK_INTERVAL === 0;
    for (let i = 0; i < rate; i++) {
      const isRecursive = i === 0 && isRecursiveTick;
      const pos = randomPos();
      mb.entities.push({
        id: 'mb_frame_' + data._nextFrameId++,
        x: pos.x,
        y: pos.y,
        hp: 1,
        maxHp: 1,
        variant: isRecursive ? 'recursive-frame' : 'frame',
        spawnedAt: now,
      });
    }

    // Sync boss entity HP
    const bossEnt = mb.entities.find(e => e.variant === 'boss');
    if (bossEnt) bossEnt.hp = data.bossHp;

    data._extra.bossHp = data.bossHp;
    data._extra.overflow = false;

    logger.info({
      miniBoss: 'stack-overflow',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      tickCount: data.tickCount,
      bossHp: data.bossHp,
      expiredFrames: expiredCount,
      activeFrames: mb.entities.filter(e => e.variant === 'frame' || e.variant === 'recursive-frame').length,
      spawnRate: rate,
      isRecursiveTick,
      timeRemaining: mb.timeRemaining,
    }, '[StackPurge] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const data = mb.data as unknown as StackPurgeData;
    const victory = data.bossHp <= 0;
    if (victory) {
      logger.info({
        miniBoss: 'stack-overflow',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
      }, '[StackPurge] Victory condition met');
    }
    return victory;
  },
};
