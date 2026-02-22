import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const THREAD_HP = 12;
const PUSH_RADIUS = 120;
const PUSH_DISTANCE = 75;
const COLLISION_DISTANCE = 55;
const COLLISION_COOLDOWN_MS = 600;
const DRIFT_SPEED = 3; // px/tick away from each other
const DRIFT_FAST = 6; // below 50% HP
const SLIPPERY_PUSH = 100; // push distance below 25% HP
const PAD = 50;

interface HerdData {
  lastCollisionAt: number;
  _extra: {
    collisionFlash: boolean;
  };
}

function clampPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(PAD, Math.min(LOGICAL_W - PAD, x)),
    y: Math.max(PAD, Math.min(LOGICAL_H - PAD, y)),
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(dx: number, dy: number): { nx: number; ny: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { nx: 1, ny: 0 };
  return { nx: dx / len, ny: dy / len };
}

export const raceConditionPlugin: MiniBossPlugin = {
  typeKey: 'race-condition',
  displayName: 'Race Condition',
  icon: '\u{1F3CE}\uFE0F',
  description: 'Push the threads into each other! Click near a thread to shove it.',
  timeLimit: 45,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    const data: HerdData = {
      lastCollisionAt: 0,
      _extra: { collisionFlash: false },
    };
    mb.data = data as unknown as Record<string, unknown>;

    const posA = { x: LOGICAL_W * 0.2, y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4 };
    const posB = { x: LOGICAL_W * 0.8, y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4 };
    const initDist = distance(posA, posB);

    logger.info({
      miniBoss: 'race-condition',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        THREAD_HP,
        PUSH_RADIUS,
        PUSH_DISTANCE,
        COLLISION_DISTANCE,
        COLLISION_COOLDOWN_MS,
        DRIFT_SPEED,
        DRIFT_FAST,
        SLIPPERY_PUSH,
        timeLimit: 45,
      },
      initialPositions: { a: posA, b: posB },
      initialDistance: Math.round(initDist),
      note: `Threads need to be within ${COLLISION_DISTANCE}px to collide. They drift apart by ${DRIFT_SPEED}px/tick. Each collision deals 1 HP to both threads (${THREAD_HP} HP each = ${THREAD_HP} collisions needed).`,
    }, '[RaceCondition] Boss initialized');

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
    ];
  },

  onClick(ctx: GameContext, pid: string, _entityId: string, clickPos?: { x: number; y: number }): void {
    const mb = ctx.state.miniBoss;
    if (!mb || !clickPos) {
      logger.info({
        miniBoss: 'race-condition',
        event: 'click-no-pos',
        lobbyId: ctx.lobbyId,
        pid,
        hasClickPos: !!clickPos,
      }, '[RaceCondition] Click ignored — no click position');
      return;
    }

    const data = mb.data as unknown as HerdData;
    const threads = mb.entities.filter(e => e.hp > 0);
    if (threads.length < 2) {
      logger.info({
        miniBoss: 'race-condition',
        event: 'click-not-enough-threads',
        lobbyId: ctx.lobbyId,
        pid,
        aliveThreads: threads.length,
      }, '[RaceCondition] Click ignored — fewer than 2 threads alive');
      return;
    }

    const minHp = Math.min(...threads.map(t => t.hp));
    const pushDist = minHp <= THREAD_HP * 0.25 ? SLIPPERY_PUSH : PUSH_DISTANCE;

    const distToA = distance(threads[0], clickPos);
    const distToB = distance(threads[1], clickPos);
    const threadDist = distance(threads[0], threads[1]);

    let pushed = false;
    const pushedThreads: string[] = [];

    // Push threads near click position
    for (const thread of threads) {
      const dist = distance(thread, clickPos);
      if (dist < PUSH_RADIUS) {
        // Push away from click
        const dx = thread.x - clickPos.x;
        const dy = thread.y - clickPos.y;
        const { nx, ny } = normalize(dx, dy);
        const pos = clampPos(thread.x + nx * pushDist, thread.y + ny * pushDist);
        thread.x = pos.x;
        thread.y = pos.y;
        pushed = true;
        pushedThreads.push(thread.id);
      }
    }

    if (!pushed) {
      logger.info({
        miniBoss: 'race-condition',
        event: 'click-out-of-range',
        lobbyId: ctx.lobbyId,
        pid,
        clickPos,
        distToA: Math.round(distToA),
        distToB: Math.round(distToB),
        pushRadius: PUSH_RADIUS,
        threadDist: Math.round(threadDist),
      }, '[RaceCondition] Click too far from any thread');
      return;
    }

    // Check collision between threads
    const now = Date.now();
    const [a, b] = threads;
    const distAfterPush = distance(a, b);
    const timeSinceCollision = now - data.lastCollisionAt;
    const collisionReady = distAfterPush < COLLISION_DISTANCE && timeSinceCollision > COLLISION_COOLDOWN_MS;

    if (a && b && collisionReady) {
      data.lastCollisionAt = now;

      // Damage both
      a.hp--;
      b.hp--;

      // Bounce apart
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const { nx, ny } = normalize(dx, dy);
      const bounceDistance = 80;
      const posA = clampPos(a.x - nx * bounceDistance, a.y - ny * bounceDistance);
      const posB = clampPos(b.x + nx * bounceDistance, b.y + ny * bounceDistance);
      a.x = posA.x;
      a.y = posA.y;
      b.x = posB.x;
      b.y = posB.y;

      data._extra.collisionFlash = true;

      logger.info({
        miniBoss: 'race-condition',
        event: 'collision',
        lobbyId: ctx.lobbyId,
        pid,
        threadDistBeforePush: Math.round(threadDist),
        threadDistAfterPush: Math.round(distAfterPush),
        collisionDistance: COLLISION_DISTANCE,
        threadAHp: a.hp,
        threadBHp: b.hp,
        timeRemaining: mb.timeRemaining,
      }, '[RaceCondition] COLLISION — both threads take damage');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      data._extra.collisionFlash = false;
      return;
    }

    logger.info({
      miniBoss: 'race-condition',
      event: 'click-push',
      lobbyId: ctx.lobbyId,
      pid,
      clickPos,
      pushedThreads,
      pushDistance: pushDist,
      threadDistBeforePush: Math.round(threadDist),
      threadDistAfterPush: Math.round(distAfterPush),
      collisionDistance: COLLISION_DISTANCE,
      collisionBlocked: distAfterPush < COLLISION_DISTANCE && timeSinceCollision <= COLLISION_COOLDOWN_MS,
      collisionCooldownRemainingMs: Math.max(0, COLLISION_COOLDOWN_MS - timeSinceCollision),
      threadAHp: a?.hp,
      threadBHp: b?.hp,
    }, '[RaceCondition] Threads pushed');

    ctx.events.emit({
      type: 'mini-boss-entity-update',
      entities: mb.entities,
      extra: { ...data._extra },
    });
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const threads = mb.entities.filter(e => e.hp > 0);
    if (threads.length < 2) return;

    const [a, b] = threads;
    if (!a || !b) return;

    const distBefore = distance(a, b);

    // Threads drift apart
    const minHp = Math.min(a.hp, b.hp);
    const drift = minHp <= THREAD_HP * 0.5 ? DRIFT_FAST : DRIFT_SPEED;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const { nx, ny } = normalize(dx, dy);

    // Each thread drifts away from the other
    const posA = clampPos(a.x - nx * drift, a.y - ny * drift);
    const posB = clampPos(b.x + nx * drift, b.y + ny * drift);
    a.x = posA.x;
    a.y = posA.y;
    b.x = posB.x;
    b.y = posB.y;

    // Small random jitter
    a.x = Math.max(PAD, Math.min(LOGICAL_W - PAD, a.x + (Math.random() - 0.5) * 8));
    a.y = Math.max(PAD, Math.min(LOGICAL_H - PAD, a.y + (Math.random() - 0.5) * 8));
    b.x = Math.max(PAD, Math.min(LOGICAL_W - PAD, b.x + (Math.random() - 0.5) * 8));
    b.y = Math.max(PAD, Math.min(LOGICAL_H - PAD, b.y + (Math.random() - 0.5) * 8));

    const distAfter = distance(a, b);

    logger.info({
      miniBoss: 'race-condition',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      timeRemaining: mb.timeRemaining,
      threadAHp: a.hp,
      threadBHp: b.hp,
      distBefore: Math.round(distBefore),
      distAfter: Math.round(distAfter),
      driftSpeed: drift,
      collisionDistance: COLLISION_DISTANCE,
      gapToCollision: Math.round(distAfter - COLLISION_DISTANCE),
    }, '[RaceCondition] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const victory = mb.entities.every(e => e.hp <= 0);
    if (victory) {
      logger.info({
        miniBoss: 'race-condition',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
      }, '[RaceCondition] Victory condition met');
    }
    return victory;
  },
};
