import type { MessageHandler } from './types.ts';
import { getCtxForPlayer } from '../helpers.ts';
import * as roguelike from '../roguelike.ts';

export const handleMapVote: MessageHandler = ({ pid, msg, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx || ctx.state.gameMode !== 'roguelike') return;
  roguelike.handleNodeVote(ctx, pid, msg.nodeId);
};
