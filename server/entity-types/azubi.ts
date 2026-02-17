import { baseDescriptor } from './base.ts';
import { getDescriptor, getType } from './index.ts';
import { getDifficultyConfig, LOGICAL_W, LOGICAL_H } from '../config.ts';
import { currentLevelConfig } from '../state.ts';
import { createTimerBag } from '../timer-bag.ts';
import * as game from '../game.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin } from '../types.ts';

export const AZUBI_MECHANICS = {
  spawnInterval: 2500,
  escapeTimeMultiplier: 2.5,
  followSpeed: 60,
  followInterval: 150,
  followMinDistance: 30,
};

// Inline spawn to avoid circular dependency with bugs.ts
function spawnAzubiBug(bug: BugEntity, ctx: GameContext) {
  const { state, counters } = ctx;
  const cfg = currentLevelConfig(state);

  // Allow more bugs on screen when azubi is active
  if (Object.keys(state.bugs).length >= cfg.maxOnScreen + 6) return;

  const id = 'bug_' + (counters.nextBugId++);
  const offset = 60;
  const x = Math.max(20, Math.min(LOGICAL_W - 20, bug.x + (Math.random() - 0.5) * offset * 2));
  const y = Math.max(20, Math.min(LOGICAL_H - 20, bug.y + (Math.random() - 0.5) * offset * 2));

  const child: BugEntity = { id, x, y, _timers: createTimerBag(), escapeTime: cfg.escapeTime, escapeStartedAt: Date.now() };
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (Math.random() < diffConfig.specialBugs.azubiFeatureChance) child.isFeature = true;

  state.bugs[id] = child;

  const descriptor = getDescriptor(child);
  const phaseCheck = state.phase === 'boss' ? 'boss' as const : 'playing' as const;
  descriptor.init(child, ctx, { phaseCheck });

  if (ctx.matchLog) {
    ctx.matchLog.log('spawn', { bugId: id, type: getType(child), source: 'azubi', activeBugs: Object.keys(state.bugs).length });
  }

  const broadcastPayload: Record<string, unknown> = { id, x: child.x, y: child.y };
  Object.assign(broadcastPayload, descriptor.broadcastFields(child));
  ctx.events.emit({ type: 'bug-spawned', bug: broadcastPayload });

  descriptor.setupTimers(child, ctx);
  descriptor.createWander(child, ctx);

  const onEscapeCheck = state.phase === 'boss'
    ? () => game.checkBossGameState(ctx)
    : () => game.checkGameState(ctx);

  child._onEscape = () => {
    if (!state.bugs[id]) return;
    descriptor.onEscape(child, ctx, onEscapeCheck);
  };
  child._timers.setTimeout('escape', child._onEscape, cfg.escapeTime);
}

function startAzubiSpawning(bug: BugEntity, ctx: GameContext) {
  const interval = bug.azubiSpawnInterval ?? AZUBI_MECHANICS.spawnInterval;
  bug._timers.setInterval('azubi-spawn', () => {
    if (!ctx.state.bugs[bug.id] || ctx.state.hammerStunActive) return;
    spawnAzubiBug(bug, ctx);
  }, interval);
}

export const azubiDescriptor: EntityDescriptor = {
  ...baseDescriptor,

  broadcastFields(_bug: BugEntity) {
    return { isAzubi: true };
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    startAzubiSpawning(bug, ctx);
  },

  createWander(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const bugId = bug.id;

    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;

      // Find nearest player
      const playerIds = Object.keys(state.players);
      if (playerIds.length === 0) return;

      let nearestPid: string | null = null;
      let nearestDist = Infinity;
      for (const pid of playerIds) {
        const p = state.players[pid];
        const dx = p.x - bug.x;
        const dy = p.y - bug.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPid = pid;
        }
      }

      if (!nearestPid) return;
      bug.azubiTarget = nearestPid;

      // Don't jitter if already close enough
      if (nearestDist < AZUBI_MECHANICS.followMinDistance) return;

      const target = state.players[nearestPid];
      const dx = target.x - bug.x;
      const dy = target.y - bug.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Move toward target at followSpeed units per tick
      const step = Math.min(AZUBI_MECHANICS.followSpeed, dist);
      const nx = bug.x + (dx / dist) * step;
      const ny = bug.y + (dy / dist) * step;

      bug.x = Math.max(20, Math.min(LOGICAL_W - 20, nx));
      bug.y = Math.max(20, Math.min(LOGICAL_H - 20, ny));

      ctx.events.emit({ type: 'bug-wander', bugId, x: bug.x, y: bug.y });
    }, AZUBI_MECHANICS.followInterval);
  },

  onStun(bug: BugEntity, ctx: GameContext) {
    baseDescriptor.onStun(bug, ctx);
    // Base clears all timers including azubi-spawn, which is what we want
  },

  onResume(this: EntityDescriptor, bug: BugEntity, ctx: GameContext) {
    bug.isStunned = false;
    const remainingTime = bug.remainingEscapeTime!;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);
    }

    if (remainingTime > 0) {
      this.createWander(bug, ctx);
      startAzubiSpawning(bug, ctx);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];

    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'azubi', activeBugs: Object.keys(ctx.state.bugs).length });
    }

    // Azubi leaves harmlessly — no HP damage
    ctx.events.emit({ type: 'azubi-escaped', bugId: bug.id });
    onEscapeCheck();
  },

  // Clicks are absorbed but do nothing — pure annoyance
  onClick(_bug: BugEntity, _ctx: GameContext, _pid: string, _msg: any) {},
};

export const azubiPlugin: BugTypePlugin = {
  typeKey: 'azubi',
  detect: (bug) => !!bug.isAzubi,
  descriptor: azubiDescriptor,
  escapeTimeMultiplier: AZUBI_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'single',
    chanceKey: 'azubiChance',
    startLevelKey: 'azubiStartLevel',
    createVariant: (ctx) => ({
      isAzubi: true,
      azubiSpawnInterval: getDifficultyConfig(ctx.state.difficulty, ctx.state.customConfig).specialBugs.azubiSpawnInterval,
    }),
    canSpawn: (ctx) => {
      // Max 1 azubi at a time
      return !Object.values(ctx.state.bugs).some(b => b.isAzubi);
    },
  },
};
