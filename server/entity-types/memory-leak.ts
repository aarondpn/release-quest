import { baseDescriptor } from './base.ts';
import { getDifficultyConfig, MEMORY_LEAK_MECHANICS } from '../config.ts';
import { randomPosition } from '../state.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

export const memoryLeakDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isMemoryLeak: true, growthStage: bug.growthStage };
  },

  createWander(bug: BugEntity, ctx: GameContext) {
    const { lobbyId, state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      // Don't move while players are actively defusing
      if (bug.holders && bug.holders.size > 0) return;
      const newPos = randomPosition();
      bug.x = newPos.x;
      bug.y = newPos.y;
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
    }, bug.escapeTime * 0.45);
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
      const { lobbyId, state } = ctx;
      bug._timers.setInterval('growth', () => {
        if (!state.bugs[bug.id]) return;
        if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
          bug.growthStage!++;
          network.broadcastToLobby(lobbyId, { type: 'memory-leak-grow', bugId: bug.id, growthStage: bug.growthStage });
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
    network.broadcastToLobby(ctx.lobbyId, { type: 'memory-leak-escaped', bugId: bug.id, growthStage: bug.growthStage, damage, hp: ctx.state.hp });
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

      network.broadcastToLobby(ctx.lobbyId, {
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

      network.broadcastToLobby(ctx.lobbyId, {
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

    network.broadcastToLobby(ctx.lobbyId, {
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

    let points = MEMORY_LEAK_MECHANICS.pointsByStage[bug.holdStartStage!] || diffConfig.bugPoints;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;

    for (const holderId of allHolders) {
      if (state.players[holderId]) {
        state.players[holderId].bugsSquashed = (state.players[holderId].bugsSquashed || 0) + 1;
        gameBugsSquashed.inc();
        state.players[holderId].score += points;
        state.score += points;
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

    network.broadcastToLobby(ctx.lobbyId, {
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
