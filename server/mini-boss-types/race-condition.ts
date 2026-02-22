import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
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

    return [
      {
        id: 'mb_thread_a',
        x: LOGICAL_W * 0.2,
        y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4,
        hp: THREAD_HP,
        maxHp: THREAD_HP,
        variant: 'thread-a',
        label: 'A',
      },
      {
        id: 'mb_thread_b',
        x: LOGICAL_W * 0.8,
        y: LOGICAL_H * 0.3 + Math.random() * LOGICAL_H * 0.4,
        hp: THREAD_HP,
        maxHp: THREAD_HP,
        variant: 'thread-b',
        label: 'B',
      },
    ];
  },

  onClick(ctx: GameContext, _pid: string, _entityId: string, clickPos?: { x: number; y: number }): void {
    const mb = ctx.state.miniBoss;
    if (!mb || !clickPos) return;

    const data = mb.data as unknown as HerdData;
    const threads = mb.entities.filter(e => e.hp > 0);
    if (threads.length < 2) return;

    const minHp = Math.min(...threads.map(t => t.hp));
    const pushDist = minHp <= THREAD_HP * 0.25 ? SLIPPERY_PUSH : PUSH_DISTANCE;

    let pushed = false;

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
      }
    }

    if (!pushed) return;

    // Check collision between threads
    const now = Date.now();
    const [a, b] = threads;
    if (a && b && distance(a, b) < COLLISION_DISTANCE && (now - data.lastCollisionAt) > COLLISION_COOLDOWN_MS) {
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
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
      data._extra.collisionFlash = false;
      return;
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

    const threads = mb.entities.filter(e => e.hp > 0);
    if (threads.length < 2) return;

    const [a, b] = threads;
    if (!a || !b) return;

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
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    return mb.entities.every(e => e.hp <= 0);
  },
};
