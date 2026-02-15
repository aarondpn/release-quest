import { baseDescriptor } from './base.ts';
import { CODE_REVIEW_MECHANICS } from '../config.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

export const featureDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isFeature: true };
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'feature', activeBugs: Object.keys(ctx.state.bugs).length });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'feature-escaped', bugId: bug.id });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    bug._timers.clearAll();
    delete state.bugs[bug.id];

    state.hp -= CODE_REVIEW_MECHANICS.hpPenalty;
    if (state.hp < 0) state.hp = 0;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', { bugId: bug.id, type: 'feature', by: pid, activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'feature-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      hp: state.hp,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};
