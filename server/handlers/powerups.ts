import type { HandlerContext, MessageHandler } from './types.ts';
import * as powerups from '../powerups.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleClickDuck: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  powerups.collectDuck(ctx, pid);
};

export const handleClickHammer: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  powerups.collectHammer(ctx, pid);
};
