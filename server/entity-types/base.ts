import { getDifficultyConfig } from '../config.ts';
import { randomPosition } from '../state.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

// ── Base descriptor — shared defaults for all entity types ──

export const baseDescriptor: EntityDescriptor = {
  init(_bug: BugEntity, _ctx: GameContext, _opts: { phaseCheck: string }) {},

  broadcastFields(_bug: BugEntity) { return {}; },

  setupTimers(_bug: BugEntity, _ctx: GameContext) {},

  createWander(bug: BugEntity, ctx: GameContext) {
    const { lobbyId, state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      const newPos = randomPosition();
      bug.x = newPos.x;
      bug.y = newPos.y;
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
    }, bug.escapeTime * 0.45);
  },

  onStun(bug: BugEntity, _ctx: GameContext) {
    bug.isStunned = true;
    bug.remainingEscapeTime = Math.max(0, bug.escapeTime - (Date.now() - bug.escapeStartedAt));
    bug._timers.clearAll();
  },

  onResume(this: EntityDescriptor, bug: BugEntity, ctx: GameContext) {
    bug.isStunned = false;
    const remainingTime = bug.remainingEscapeTime!;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    // Restart escape timer (only on the owner bug, not shared-escape followers)
    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);
    }

    if (remainingTime > 0) {
      this.createWander(bug, ctx);
      this.setupTimers(bug, ctx);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const diffConfig = getDifficultyConfig(ctx.state.difficulty);
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];
    ctx.state.hp -= diffConfig.hpDamage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'bug-escaped', bugId: bug.id, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const player = state.players[pid];
    if (!player) return;

    bug._timers.clearAll();
    delete state.bugs[bug.id];

    player.bugsSquashed = (player.bugsSquashed || 0) + 1;
    gameBugsSquashed.inc();
    let points = diffConfig.bugPoints;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;
    state.score += points;
    player.score += points;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id,
        type: bug.isMinion ? 'minion' : 'normal',
        by: pid,
        activeBugs: Object.keys(state.bugs).length,
        score: state.score,
      });
    }

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'bug-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      score: state.score,
      playerScore: player.score,
      isHeisenbug: false,
      isMemoryLeak: false,
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};
