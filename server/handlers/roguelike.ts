import type { MessageHandler } from './types.ts';
import { getCtxForPlayer } from '../helpers.ts';
import * as roguelike from '../roguelike.ts';
import * as events from '../events.ts';
import * as rest from '../rest.ts';

export const handleMapVote: MessageHandler = ({ pid, msg, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx || ctx.state.gameMode !== 'roguelike') return;
  roguelike.handleNodeVote(ctx, pid, msg.nodeId);
};

export const handleEventVote: MessageHandler = ({ pid, msg, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx || ctx.state.gameMode !== 'roguelike') return;
  events.handleEventVote(ctx, pid, msg.optionId);
};

export const handleRestVote: MessageHandler = ({ pid, msg, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx || ctx.state.gameMode !== 'roguelike') return;
  rest.handleRestVote(ctx, pid, msg.option);
};
