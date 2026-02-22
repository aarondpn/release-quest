import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const THREAD_HP = 5;
const SYNC_ZONE_RADIUS = 60;
const SYNC_ZONE_TIMEOUT_TICKS = 5;
const SYNC_TIMEOUT_HEAL = 1;
const PUSH_RADIUS = 120;
const PUSH_DISTANCE = 75;
const THREAD_SPEED = 15;
const THREAD_SPEED_FAST = 25;
const DUAL_CAPTURE_DAMAGE = 3;
const PAD = 50;

interface ThreadCorralData {
  syncZoneX: number;
  syncZoneY: number;
  syncZoneTimer: number; // ticks remaining until timeout
  tickCount: number;
  _extra: {
    syncActive: boolean;
    syncTimer: number;
    captureFlash: boolean;
  };
}

function randomSyncZonePos(): { x: number; y: number } {
  const pad = 80;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(dx: number, dy: number): { nx: number; ny: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { nx: Math.random() > 0.5 ? 1 : -1, ny: 0 };
  return { nx: dx / len, ny: dy / len };
}

function clampPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(PAD, Math.min(LOGICAL_W - PAD, x)),
    y: Math.max(PAD, Math.min(LOGICAL_H - PAD, y)),
  };
}

function threadSpeed(hp: number): number {
  return hp < 3 ? THREAD_SPEED_FAST : THREAD_SPEED;
}

function checkCaptures(
  threads: MiniBossEntity[],
  syncZone: { x: number; y: number }
): { captured: MiniBossEntity[]; dual: boolean } {
  const captured = threads.filter(t => t.hp > 0 && distance(t, syncZone) <= SYNC_ZONE_RADIUS);
  return { captured, dual: captured.length >= 2 };
}

function repositionSyncZone(data: ThreadCorralData, mb: { entities: MiniBossEntity[] }): void {
  const newPos = randomSyncZonePos();
  data.syncZoneX = newPos.x;
  data.syncZoneY = newPos.y;
  data.syncZoneTimer = SYNC_ZONE_TIMEOUT_TICKS;
  data._extra.syncTimer = SYNC_ZONE_TIMEOUT_TICKS;
  const syncEnt = mb.entities.find(e => e.variant === 'sync-zone');
  if (syncEnt) {
    syncEnt.x = newPos.x;
    syncEnt.y = newPos.y;
  }
}

export const raceConditionPlugin: MiniBossPlugin = {
  typeKey: 'race-condition',
  displayName: 'Thread Corral',
  icon: '\u{1F3CE}\uFE0F',
  description: 'Push threads into the sync zone! Both threads together = bonus damage.',
  timeLimit: 35,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    const syncPos = randomSyncZonePos();
    const data: ThreadCorralData = {
      syncZoneX: syncPos.x,
      syncZoneY: syncPos.y,
      syncZoneTimer: SYNC_ZONE_TIMEOUT_TICKS,
      tickCount: 0,
      _extra: {
        syncActive: true,
        syncTimer: SYNC_ZONE_TIMEOUT_TICKS,
        captureFlash: false,
      },
    };
    mb.data = data as unknown as Record<string, unknown>;

    const posA = { x: LOGICAL_W * 0.2, y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4 };
    const posB = { x: LOGICAL_W * 0.8, y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4 };

    logger.info({
      miniBoss: 'race-condition',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        THREAD_HP,
        SYNC_ZONE_RADIUS,
        SYNC_ZONE_TIMEOUT_TICKS,
        SYNC_TIMEOUT_HEAL,
        PUSH_RADIUS,
        PUSH_DISTANCE,
        THREAD_SPEED,
        THREAD_SPEED_FAST,
        DUAL_CAPTURE_DAMAGE,
        timeLimit: 35,
      },
      initialPositions: { a: posA, b: posB },
      syncZone: syncPos,
      note: `Single capture = 1 damage. Dual capture = ${DUAL_CAPTURE_DAMAGE} damage each. Zone times out every ${SYNC_ZONE_TIMEOUT_TICKS} ticks (heals 1 HP).`,
    }, '[ThreadCorral] Boss initialized');

    return [
      {
        id: 'mb_thread_a',
        x: posA.x,
        y: posA.y,
        hp: THREAD_HP,
        maxHp: THREAD_HP,
        variant: 'thread-a',
        label: 'A',
      },
      {
        id: 'mb_thread_b',
        x: posB.x,
        y: posB.y,
        hp: THREAD_HP,
        maxHp: THREAD_HP,
        variant: 'thread-b',
        label: 'B',
      },
      {
        id: 'mb_sync_zone',
        x: syncPos.x,
        y: syncPos.y,
        hp: 1,
        maxHp: 1,
        variant: 'sync-zone',
      },
    ];
  },

  onClick(ctx: GameContext, pid: string, _entityId: string, clickPos?: { x: number; y: number }): void {
    const mb = ctx.state.miniBoss;
    if (!mb || !clickPos) return;

    const data = mb.data as unknown as ThreadCorralData;
    const threads = mb.entities.filter(
      e => (e.variant === 'thread-a' || e.variant === 'thread-b') && e.hp > 0
    );
    if (threads.length === 0) return;

    let pushed = false;
    const pushedThreads: string[] = [];

    // Push threads within range away from click point
    for (const thread of threads) {
      const dist = distance(thread, clickPos);
      if (dist < PUSH_RADIUS) {
        const dx = thread.x - clickPos.x;
        const dy = thread.y - clickPos.y;
        const { nx, ny } = normalize(dx, dy);
        const pos = clampPos(thread.x + nx * PUSH_DISTANCE, thread.y + ny * PUSH_DISTANCE);
        thread.x = pos.x;
        thread.y = pos.y;
        pushed = true;
        pushedThreads.push(thread.id);
      }
    }

    if (!pushed) {
      return;
    }

    // Check sync zone captures after push
    const syncZone = { x: data.syncZoneX, y: data.syncZoneY };
    const { captured, dual } = checkCaptures(threads, syncZone);

    if (captured.length > 0) {
      if (dual) {
        for (const t of captured) {
          t.hp = Math.max(0, t.hp - DUAL_CAPTURE_DAMAGE);
        }
        logger.info({
          miniBoss: 'race-condition',
          event: 'dual-capture',
          lobbyId: ctx.lobbyId,
          pid,
          damage: DUAL_CAPTURE_DAMAGE * 2,
          threadAHp: threads.find(t => t.variant === 'thread-a')?.hp,
          threadBHp: threads.find(t => t.variant === 'thread-b')?.hp,
          timeRemaining: mb.timeRemaining,
        }, '[ThreadCorral] DUAL CAPTURE — both threads take 3 damage each');
      } else {
        captured[0].hp = Math.max(0, captured[0].hp - 1);
        logger.info({
          miniBoss: 'race-condition',
          event: 'capture',
          lobbyId: ctx.lobbyId,
          pid,
          threadId: captured[0].id,
          threadHp: captured[0].hp,
          timeRemaining: mb.timeRemaining,
        }, '[ThreadCorral] Thread captured in sync zone');
      }

      repositionSyncZone(data, mb);
      data._extra.captureFlash = true;
      data._extra.syncActive = true;

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      data._extra.captureFlash = false;
      return;
    }

    logger.info({
      miniBoss: 'race-condition',
      event: 'push',
      lobbyId: ctx.lobbyId,
      pid,
      pushedThreads,
      clickPos,
      timeRemaining: mb.timeRemaining,
    }, '[ThreadCorral] Threads pushed');

    ctx.events.emit({
      type: 'mini-boss-entity-update',
      entities: mb.entities,
      extra: { ...data._extra },
    });
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as ThreadCorralData;
    data.tickCount++;

    const threads = mb.entities.filter(
      e => (e.variant === 'thread-a' || e.variant === 'thread-b') && e.hp > 0
    );

    // Random walk both threads with wall bouncing
    for (const thread of threads) {
      const speed = threadSpeed(thread.hp);
      const angle = Math.random() * Math.PI * 2;
      const clamped = clampPos(
        thread.x + Math.cos(angle) * speed,
        thread.y + Math.sin(angle) * speed
      );
      thread.x = clamped.x;
      thread.y = clamped.y;
    }

    // Check sync zone captures after random walk
    const syncZone = { x: data.syncZoneX, y: data.syncZoneY };
    const { captured, dual } = checkCaptures(threads, syncZone);

    if (captured.length > 0) {
      if (dual) {
        for (const t of captured) t.hp = Math.max(0, t.hp - DUAL_CAPTURE_DAMAGE);
        logger.info({
          miniBoss: 'race-condition',
          event: 'dual-capture-tick',
          lobbyId: ctx.lobbyId,
          timeRemaining: mb.timeRemaining,
        }, '[ThreadCorral] Dual capture via random walk');
      } else {
        captured[0].hp = Math.max(0, captured[0].hp - 1);
        logger.info({
          miniBoss: 'race-condition',
          event: 'capture-tick',
          lobbyId: ctx.lobbyId,
          threadId: captured[0].id,
          threadHp: captured[0].hp,
          timeRemaining: mb.timeRemaining,
        }, '[ThreadCorral] Thread captured via random walk');
      }

      repositionSyncZone(data, mb);
      data._extra.captureFlash = true;
      data._extra.syncActive = true;

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      data._extra.captureFlash = false;
      return;
    }

    // Decrement sync zone timer
    data.syncZoneTimer--;
    data._extra.syncTimer = data.syncZoneTimer;

    if (data.syncZoneTimer <= 0) {
      // Zone timed out — heal the most-damaged thread, reposition zone
      let healedThreadId: string | undefined;
      if (threads.length > 0) {
        const lowestHpThread = threads.reduce((a, b) => a.hp <= b.hp ? a : b);
        lowestHpThread.hp = Math.min(lowestHpThread.maxHp, lowestHpThread.hp + SYNC_TIMEOUT_HEAL);
        healedThreadId = lowestHpThread.id;
      }

      repositionSyncZone(data, mb);

      logger.info({
        miniBoss: 'race-condition',
        event: 'sync-zone-timeout',
        lobbyId: ctx.lobbyId,
        healedThread: healedThreadId,
        healAmount: SYNC_TIMEOUT_HEAL,
        timeRemaining: mb.timeRemaining,
      }, '[ThreadCorral] Sync zone timed out — thread healed, new zone');
    }

    data._extra.syncActive = true;
    data._extra.captureFlash = false;

    logger.info({
      miniBoss: 'race-condition',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      tickCount: data.tickCount,
      syncZoneTimer: data.syncZoneTimer,
      threads: threads.map(t => ({ id: t.id, hp: t.hp, x: Math.round(t.x), y: Math.round(t.y) })),
      timeRemaining: mb.timeRemaining,
    }, '[ThreadCorral] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const threads = mb.entities.filter(
      e => e.variant === 'thread-a' || e.variant === 'thread-b'
    );
    const victory = threads.length > 0 && threads.every(e => e.hp <= 0);
    if (victory) {
      logger.info({
        miniBoss: 'race-condition',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
      }, '[ThreadCorral] Victory condition met');
    }
    return victory;
  },
};
