import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const BOSS_HP = 15;
const LOCK_COUNT = 6;
const WRONG_CLICK_HEAL = 1;
const STREAK_THRESHOLD = 3;
const STREAK_BONUS_DAMAGE = 1;

function litDuration(bossHp: number): number {
  if (bossHp < 5) return 1000;
  if (bossHp < 10) return 1200;
  return 1500;
}

function simultaneousLit(bossHp: number): number {
  if (bossHp < 5) return 3;
  if (bossHp < 10) return 2;
  return 1;
}

interface LockCascadeData {
  bossHp: number;
  litLocks: Record<string, number>; // lockId → expiresAt timestamp
  streak: number;
  tickCount: number;
  _extra: {
    bossHp: number;
    bossMaxHp: number;
    litLockIds: string[];
    streak: number;
    wrongClickLockId: string;
  };
}

function toData(raw: Record<string, unknown>): LockCascadeData {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return raw as unknown as LockCascadeData;
}

function fromData(data: LockCascadeData): Record<string, unknown> {
  return { ...data };
}

function lockPositions(): { x: number; y: number }[] {
  const cx = LOGICAL_W / 2;
  const cy = LOGICAL_H / 2;
  const radius = Math.min(LOGICAL_W, LOGICAL_H) * 0.32;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < LOCK_COUNT; i++) {
    const angle = (i / LOCK_COUNT) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return positions;
}

function pickRandomLock(currentLit: Set<string>): string | null {
  const allLocks = Array.from({ length: LOCK_COUNT }, (_, i) => 'mb_lock_' + i);
  const available = allLocks.filter(id => !currentLit.has(id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export const deadlockPlugin: MiniBossPlugin = {
  typeKey: 'deadlock',
  displayName: 'Lock Cascade',
  icon: '\u{1F512}',
  description: 'Click glowing locks before they go dark. Wrong clicks heal the boss!',
  timeLimit: 30,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;

    // Illuminate first lock immediately
    const firstLock = 'mb_lock_' + Math.floor(Math.random() * LOCK_COUNT);
    const now = Date.now();
    const initialLitLocks: Record<string, number> = {
      [firstLock]: now + litDuration(BOSS_HP),
    };

    const data: LockCascadeData = {
      bossHp: BOSS_HP,
      litLocks: initialLitLocks,
      streak: 0,
      tickCount: 0,
      _extra: {
        bossHp: BOSS_HP,
        bossMaxHp: BOSS_HP,
        litLockIds: [firstLock],
        streak: 0,
        wrongClickLockId: '',
      },
    };
    mb.data = fromData(data);

    logger.info({
      miniBoss: 'deadlock',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        BOSS_HP,
        LOCK_COUNT,
        WRONG_CLICK_HEAL,
        STREAK_THRESHOLD,
        STREAK_BONUS_DAMAGE,
        litDurationMs: litDuration(BOSS_HP),
        timeLimit: 30,
      },
      firstLock,
      note: `Streak of ${STREAK_THRESHOLD} correct clicks = +${STREAK_BONUS_DAMAGE} bonus damage. Lit duration scales with boss HP.`,
    }, '[LockCascade] Boss initialized');

    const positions = lockPositions();
    return positions.map((pos, i) => ({
      id: 'mb_lock_' + i,
      x: pos.x,
      y: pos.y,
      hp: 1,
      maxHp: 1,
      variant: 'lock',
    }));
  },

  onClick(ctx: GameContext, pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = toData(mb.data);

    // Only handle lock entities
    if (!entityId.match(/^mb_lock_\d+$/)) return;

    const isLit = entityId in data.litLocks;

    if (isLit) {
      // Correct click — deal damage, track streak
      const hpBefore = data.bossHp;
      data.bossHp = Math.max(0, data.bossHp - 1);
      data.streak++;
      delete data.litLocks[entityId];

      // Streak bonus every STREAK_THRESHOLD correct clicks
      let bonusDamage = 0;
      if (data.streak % STREAK_THRESHOLD === 0) {
        bonusDamage = STREAK_BONUS_DAMAGE;
        data.bossHp = Math.max(0, data.bossHp - bonusDamage);
      }

      data._extra.bossHp = data.bossHp;
      data._extra.litLockIds = Object.keys(data.litLocks);
      data._extra.streak = data.streak;
      data._extra.wrongClickLockId = '';

      logger.info({
        miniBoss: 'deadlock',
        event: 'click-correct',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
        bossHpBefore: hpBefore,
        bossHpAfter: data.bossHp,
        streak: data.streak,
        bonusDamage,
        timeRemaining: mb.timeRemaining,
      }, '[LockCascade] Lit lock clicked');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
    } else {
      // Wrong click — boss heals, streak resets
      const hpBefore = data.bossHp;
      data.bossHp = Math.min(BOSS_HP, data.bossHp + WRONG_CLICK_HEAL);
      data.streak = 0;
      data._extra.bossHp = data.bossHp;
      data._extra.streak = 0;
      data._extra.wrongClickLockId = entityId;
      data._extra.litLockIds = Object.keys(data.litLocks);

      logger.warn({
        miniBoss: 'deadlock',
        event: 'click-wrong',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
        bossHpBefore: hpBefore,
        bossHpAfter: data.bossHp,
        timeRemaining: mb.timeRemaining,
      }, '[LockCascade] Dark lock clicked — boss heals');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'Wrong lock! Boss heals.',
        extra: { ...data._extra },
      });
      data._extra.wrongClickLockId = '';
    }
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = toData(mb.data);
    const now = Date.now();
    data.tickCount++;

    // Expire lit locks past their duration
    for (const lockId of Object.keys(data.litLocks)) {
      if (now >= data.litLocks[lockId]) {
        delete data.litLocks[lockId];
      }
    }

    // Illuminate new locks up to simultaneous target count
    const targetCount = simultaneousLit(data.bossHp);
    const currentLitSet = new Set(Object.keys(data.litLocks));
    const duration = litDuration(data.bossHp);

    while (currentLitSet.size < targetCount) {
      const newLock = pickRandomLock(currentLitSet);
      if (!newLock) break;
      data.litLocks[newLock] = now + duration;
      currentLitSet.add(newLock);
    }

    data._extra.litLockIds = Object.keys(data.litLocks);
    data._extra.bossHp = data.bossHp;
    data._extra.streak = data.streak;

    logger.info({
      miniBoss: 'deadlock',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      tickCount: data.tickCount,
      bossHp: data.bossHp,
      litLockCount: Object.keys(data.litLocks).length,
      litLockIds: Object.keys(data.litLocks),
      streak: data.streak,
      targetSimultaneous: targetCount,
      litDurationMs: duration,
      timeRemaining: mb.timeRemaining,
    }, '[LockCascade] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const data = toData(mb.data);
    const victory = data.bossHp <= 0;
    if (victory) {
      logger.info({
        miniBoss: 'deadlock',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
        finalStreak: data.streak,
      }, '[LockCascade] Victory condition met');
    }
    return victory;
  },
};
