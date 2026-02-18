import { baseDescriptor } from './base.ts';
import { getDifficultyConfig } from '../config.ts';
import { randomPosition, awardScore } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import * as roles from '../roles.ts';
import { gameBugsSquashed } from '../metrics.ts';
import { getCtxForPlayer } from '../helpers.ts';
import { z } from 'zod';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin } from '../types.ts';

export const MEMORY_LEAK_MECHANICS = {
  growthInterval: 500,
  maxGrowthStage: 3,
  damageByStage: [5, 10, 15, 20],
  pointsByStage: [10, 15, 20, 25],
  escapeTimeMultiplier: 1.3,
  holdTimeByStage: [400, 600, 800, 1000],
};

export const memoryLeakDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isMemoryLeak: true, growthStage: bug.growthStage };
  },

  createWander(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      // Don't move while players are actively defusing
      if (bug.holders && bug.holders.size > 0) return;
      const newPos = randomPosition();
      bug.x = newPos.x;
      bug.y = newPos.y;
      ctx.events.emit({ type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
    }, bug.escapeTime * 0.45);
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
      const { state } = ctx;
      bug._timers.setInterval('growth', () => {
        if (!state.bugs[bug.id]) return;
        if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
          bug.growthStage!++;
          ctx.events.emit({ type: 'memory-leak-grow', bugId: bug.id, growthStage: bug.growthStage });
        }
      }, MEMORY_LEAK_MECHANICS.growthInterval);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const diffConfig = getDifficultyConfig(ctx.state.difficulty);
    bug._timers.clearAll();
    const damage = MEMORY_LEAK_MECHANICS.damageByStage[bug.growthStage!] || diffConfig.hpDamage;
    delete ctx.state.bugs[bug.id];
    ctx.state.hp -= damage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'memory-leak', growthStage: bug.growthStage, damage, activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }
    ctx.events.emit({ type: 'memory-leak-escaped', bugId: bug.id, growthStage: bug.growthStage, damage, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(_bug: BugEntity, _ctx: GameContext, _pid: string, _msg: any) {
    // Memory leak uses hold mechanic — regular clicks are ignored
    return;
  },

  onHoldStart(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string) {
    const { state } = ctx;

    // Initialize holders tracking if needed
    if (!bug.holders) {
      bug.holders = new Map();
      bug.holdStartStage = bug.growthStage;
      bug.firstHolderStartTime = Date.now();
    }

    // Add this player to holders
    if (!bug.holders.has(pid)) {
      bug.holders.set(pid, Date.now());

      const elapsedSinceFirst = Date.now() - bug.firstHolderStartTime!;
      const requiredTime = MEMORY_LEAK_MECHANICS.holdTimeByStage[bug.holdStartStage!];
      const effectiveRequiredTime = requiredTime / bug.holders.size;

      ctx.events.emit({
        type: 'memory-leak-hold-update',
        bugId: bug.id,
        playerId: pid,
        holderCount: bug.holders.size,
        requiredHoldTime: requiredTime,
        elapsedTime: elapsedSinceFirst,
      });

      const remainingTime = Math.max(0, effectiveRequiredTime - elapsedSinceFirst);
      bug._timers.setTimeout('completion', () => {
        this._completeHold!(bug, ctx);
      }, remainingTime);
    }
  },

  onHoldComplete(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    if (!bug.holders || !bug.holders.has(pid)) return;

    const requiredTime = MEMORY_LEAK_MECHANICS.holdTimeByStage[bug.holdStartStage!];
    const elapsedSinceFirst = Date.now() - bug.firstHolderStartTime!;

    bug.holders.delete(pid);

    // If no holders left, reset completely
    if (bug.holders.size === 0) {
      bug._timers.clear('completion');
      delete bug.holders;
      delete bug.holdStartStage;
      delete bug.firstHolderStartTime;

      ctx.events.emit({
        type: 'memory-leak-hold-update',
        bugId: bug.id,
        playerId: pid,
        holderCount: 0,
        requiredHoldTime: requiredTime,
        elapsedTime: elapsedSinceFirst,
        dropOut: true,
      });
      return;
    }

    // Recalculate completion timer with new holder count
    const newEffectiveTime = requiredTime / bug.holders.size;
    const remainingTime = Math.max(0, newEffectiveTime - elapsedSinceFirst);

    bug._timers.setTimeout('completion', () => {
      this._completeHold!(bug, ctx);
    }, remainingTime);

    ctx.events.emit({
      type: 'memory-leak-hold-update',
      bugId: bug.id,
      playerId: pid,
      holderCount: bug.holders.size,
      requiredHoldTime: requiredTime,
      elapsedTime: elapsedSinceFirst,
      dropOut: true,
    });
  },

  _completeHold(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    if (!state.bugs[bug.id] || !bug.holders || bug.holders.size === 0) return;

    bug._timers.clearAll();

    const allHolders = Array.from(bug.holders.keys());
    const holderCount = allHolders.length;
    delete state.bugs[bug.id];

    let rawPoints = MEMORY_LEAK_MECHANICS.pointsByStage[bug.holdStartStage!] || diffConfig.bugPoints;
    // Debugger passive: +50% points if any holder is a Debugger
    const hasDebugger = allHolders.some(holderId => roles.hasRole(state, holderId, 'debugger'));
    if (hasDebugger) rawPoints *= 1.5;
    if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;

    let points = 0;
    for (const holderId of allHolders) {
      if (state.players[holderId]) {
        state.players[holderId].bugsSquashed = (state.players[holderId].bugsSquashed || 0) + 1;
        gameBugsSquashed.inc();
        points = awardScore(ctx, holderId, rawPoints);
      }
    }

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id,
        type: 'memory-leak',
        by: allHolders,
        growthStage: bug.holdStartStage,
        holderCount,
        activeBugs: Object.keys(state.bugs).length,
        score: state.score,
      });
    }

    ctx.events.emit({
      type: 'memory-leak-cleared',
      bugId: bug.id,
      holders: allHolders,
      holderCount,
      score: state.score,
      players: Object.fromEntries(
        allHolders.filter(h => state.players[h]).map(h => [h, state.players[h].score])
      ),
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};

export const memoryLeakPlugin: BugTypePlugin = {
  typeKey: 'memoryLeak',
  detect: (bug) => !!bug.isMemoryLeak,
  descriptor: memoryLeakDescriptor,
  escapeTimeMultiplier: MEMORY_LEAK_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'single',
    chanceKey: 'memoryLeakChance',
    createVariant: () => ({ isMemoryLeak: true, growthStage: 0 }),
    canSpawn: (ctx) => {
      const playerCount = Object.keys(ctx.state.players).length;
      return Object.values(ctx.state.bugs).filter(b => b.isMemoryLeak).length < Math.max(1, playerCount - 1);
    },
  },
  schemas: {
    'click-memory-leak-start': z.object({
      type: z.literal('click-memory-leak-start'),
      bugId: z.string(),
    }),
    'click-memory-leak-complete': z.object({
      type: z.literal('click-memory-leak-complete'),
      bugId: z.string(),
    }),
  },
  handlers: {
    'click-memory-leak-start': ({ msg, pid, playerInfo }: any) => {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) return;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') return;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isMemoryLeak) return;
      memoryLeakDescriptor.onHoldStart!(bug, ctx, pid);
    },
    'click-memory-leak-complete': ({ msg, pid, playerInfo }: any) => {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) return;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') return;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isMemoryLeak) return;
      memoryLeakDescriptor.onHoldComplete!(bug, ctx, pid);
    },
  },
};
