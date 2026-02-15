import type { HandlerContext, MessageHandler } from './types.ts';
import { createGameLogger } from '../logger.ts';
import * as game from '../game.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleStartGame: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  if (ctx.state.phase === 'lobby' || ctx.state.phase === 'gameover' || ctx.state.phase === 'win') {
    const gameLogger = createGameLogger(ctx.lobbyId.toString(), ctx.state.phase);
    gameLogger.info({ playerId: pid, playerCount: Object.keys(ctx.state.players).length }, 'Game started');
    game.startGame(ctx);
  }
};
