import type { HandlerContext, MessageHandler } from './types.ts';
import * as game from '../game.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleStartGame: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  if (ctx.state.phase === 'lobby' || ctx.state.phase === 'gameover' || ctx.state.phase === 'win') {
    console.log(`[game] ${pid} started game in lobby ${ctx.lobbyId} (${Object.keys(ctx.state.players).length} players)`);
    game.startGame(ctx);
  }
};
