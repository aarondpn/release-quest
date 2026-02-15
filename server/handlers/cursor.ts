import type { HandlerContext, MessageHandler } from './types.ts';
import * as network from '../network.ts';
import * as entityTypes from '../entity-types/index.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleCursorMove: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st, lobbyId: lid } = ctx;
  const player = st.players[pid];
  if (!player) return;
  player.x = msg.x;
  player.y = msg.y;
  network.broadcastToLobby(lid, {
    type: 'player-cursor',
    playerId: pid,
    x: msg.x,
    y: msg.y,
  }, ws);

  // Heisenbug flee check — dispatch to descriptor
  for (const bid of Object.keys(st.bugs)) {
    const b = st.bugs[bid];
    const desc = entityTypes.getDescriptor(b);
    if (desc.onCursorNear) desc.onCursorNear(b, ctx, pid, msg.x, msg.y);
  }
};
