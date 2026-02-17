import { baseDescriptor } from './base.ts';
import { getDescriptor, getType } from './index.ts';
import { getDifficultyConfig, LOGICAL_W, LOGICAL_H } from '../config.ts';
import { randomPosition, awardScore, currentLevelConfig } from '../state.ts';
import { createTimerBag } from '../timer-bag.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin } from '../types.ts';

export const AZUBI_MECHANICS = {
  clicksToKill: 10,
  spawnInterval: 1200,
  spawnSpeedupPerHit: 0.80,
  bonusPoints: 50,
  escapeDamage: 25,
  escapeTimeMultiplier: 2.5,
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
  if (Math.random() < 0.5) child.isFeature = true;

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

  broadcastFields(bug: BugEntity) {
    return { isAzubi: true, azubiHp: bug.azubiHp, azubiMaxHp: bug.azubiMaxHp };
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    startAzubiSpawning(bug, ctx);
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
    ctx.state.hp -= AZUBI_MECHANICS.escapeDamage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;

    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'azubi', activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }

    ctx.events.emit({ type: 'azubi-escaped', bugId: bug.id, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    bug.azubiHp = (bug.azubiHp ?? AZUBI_MECHANICS.clicksToKill) - 1;

    if (bug.azubiHp! <= 0) {
      // Azubi killed
      bug._timers.clearAll();
      delete state.bugs[bug.id];

      player.bugsSquashed = (player.bugsSquashed || 0) + 1;
      gameBugsSquashed.inc();
      let rawPoints = AZUBI_MECHANICS.bonusPoints;
      if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;
      const points = awardScore(ctx, pid, rawPoints);

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'azubi', by: pid, activeBugs: Object.keys(state.bugs).length, score: state.score });
      }

      ctx.events.emit({
        type: 'azubi-killed',
        bugId: bug.id,
        playerId: pid,
        playerColor: player.color,
        score: state.score,
        playerScore: player.score,
        points,
      });

      if (state.phase === 'boss') game.checkBossGameState(ctx);
      else game.checkGameState(ctx);
    } else {
      // Hit but not dead — speed up spawning
      bug.azubiSpawnInterval = (bug.azubiSpawnInterval ?? AZUBI_MECHANICS.spawnInterval) * AZUBI_MECHANICS.spawnSpeedupPerHit;
      // Restart spawn timer with new faster interval
      bug._timers.clear('azubi-spawn');
      startAzubiSpawning(bug, ctx);

      ctx.events.emit({
        type: 'azubi-hit',
        bugId: bug.id,
        playerId: pid,
        playerColor: player.color,
        azubiHp: bug.azubiHp,
        azubiMaxHp: bug.azubiMaxHp,
      });
    }
  },
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
    createVariant: () => ({
      isAzubi: true,
      azubiHp: AZUBI_MECHANICS.clicksToKill,
      azubiMaxHp: AZUBI_MECHANICS.clicksToKill,
      azubiSpawnInterval: AZUBI_MECHANICS.spawnInterval,
    }),
    canSpawn: (ctx) => {
      // Max 1 azubi at a time
      return !Object.values(ctx.state.bugs).some(b => b.isAzubi);
    },
  },
};
