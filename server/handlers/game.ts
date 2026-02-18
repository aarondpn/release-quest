import type { HandlerContext, MessageHandler } from './types.ts';
import { createGameLogger } from '../logger.ts';
import * as game from '../game.ts';
import * as network from '../network.ts';
import { getCtxForPlayer } from '../helpers.ts';
import { getLobbyModerator } from './chat.ts';

export const handleStartGame: MessageHandler = ({ ws, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const moderator = getLobbyModerator(ctx.lobbyId);
  if (moderator && moderator !== pid) {
    network.send(ws, { type: 'error', message: 'Only the lobby creator can start the game' });
    return;
  }
  if (ctx.state.phase === 'lobby' || ctx.state.phase === 'gameover' || ctx.state.phase === 'win') {
    const gameLogger = createGameLogger(ctx.lobbyId.toString(), ctx.state.phase);
    gameLogger.info({ playerId: pid, playerCount: Object.keys(ctx.state.players).length }, 'Game started');
    game.startGame(ctx);
  }
};
