import { baseDescriptor } from './base.ts';
import { getDifficultyConfig, MERGE_CONFLICT_MECHANICS } from '../config.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

export const mergeConflictDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return {
      mergeConflict: bug.mergeConflict,
      mergePartner: bug.mergePartner,
      mergeSide: bug.mergeSide,
    };
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const partner = state.bugs[bug.mergePartner!];
    const damage = MERGE_CONFLICT_MECHANICS.doubleDamage ? diffConfig.hpDamage * 2 : diffConfig.hpDamage;
    bug._timers.clearAll();
    delete state.bugs[bug.id];
    if (partner) {
      partner._timers.clearAll();
      delete state.bugs[partner.id];
    }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'merge-conflict-escaped', bugId: bug.id, partnerId: bug.mergePartner, hp: state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;
    const partner = state.bugs[bug.mergePartner!];

    // Same player can't resolve both sides
    if (partner && partner.mergeClicked && partner.mergeClickedBy === pid) return;

    bug.mergeClicked = true;
    bug.mergeClickedBy = pid;
    bug.mergeClickedAt = Date.now();

    if (partner && partner.mergeClicked && (Date.now() - partner.mergeClickedAt!) < MERGE_CONFLICT_MECHANICS.resolveWindow) {
      // Both clicked in time — resolve!
      bug._timers.clearAll();
      partner._timers.clearAll();
      delete state.bugs[bug.id];
      delete state.bugs[partner.id];

      const clickers = new Set([pid, partner.mergeClickedBy!]);
      for (const clickerId of clickers) {
        if (state.players[clickerId]) {
          state.players[clickerId].score += MERGE_CONFLICT_MECHANICS.bonusPoints;
          state.score += MERGE_CONFLICT_MECHANICS.bonusPoints;
          state.players[clickerId].bugsSquashed = (state.players[clickerId].bugsSquashed || 0) + 1;
          gameBugsSquashed.inc();
        }
      }

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'merge-conflict', by: [...clickers], activeBugs: Object.keys(state.bugs).length, score: state.score });
      }

      network.broadcastToLobby(ctx.lobbyId, {
        type: 'merge-conflict-resolved',
        bugId: bug.id,
        partnerId: partner.id,
        clickers: [...clickers],
        score: state.score,
        players: Object.fromEntries(
          [...clickers].filter(c => state.players[c]).map(c => [c, state.players[c].score])
        ),
      });

      if (state.phase === 'boss') game.checkBossGameState(ctx);
      else game.checkGameState(ctx);
    } else {
      // Only one clicked — set timeout for reset
      network.broadcastToLobby(ctx.lobbyId, { type: 'merge-conflict-halfclick', bugId: bug.id });
      bug._timers.setTimeout('mergeReset', () => {
        if (state.bugs[bug.id]) {
          bug.mergeClicked = false;
          bug.mergeClickedBy = null;
          bug.mergeClickedAt = 0;
        }
      }, MERGE_CONFLICT_MECHANICS.resolveWindow);
    }
  },
};
