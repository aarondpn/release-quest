import type { MessageHandler } from './types.ts';
import { getLobbyForPlayer, getLobbyState } from '../lobby.ts';
import * as shop from '../shop.ts';
import type { GameContext } from '../types.ts';

function getCtx(pid: string, playerInfo: Map<string, any>): GameContext | null {
  const lobbyId = getLobbyForPlayer(pid);
  if (!lobbyId) return null;
  const mem = getLobbyState(lobbyId);
  if (!mem) return null;
  return { lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers, matchLog: mem.matchLog, playerInfo, events: mem.events, lifecycle: mem.lifecycle };
}

export const handleShopBuy: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtx(pid, playerInfo);
  if (!ctx) return;
  shop.handleBuy(ctx, pid, msg.itemId);
};

export const handleShopReady: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtx(pid, playerInfo);
  if (!ctx) return;
  shop.handleReady(ctx, pid);
};
