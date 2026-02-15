import type { HandlerContext, MessageHandler } from './types.ts';
import { ICONS, PREMIUM_ICON_IDS, ALL_ICONS } from '../config.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as auth from '../auth.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleSetName: MessageHandler = ({ msg, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info) return;
  const newName = String(msg.name || '').trim().slice(0, 16);
  if (newName) info.name = newName;
  if (msg.icon && ICONS.includes(msg.icon)) info.icon = msg.icon;
  if (msg.icon && PREMIUM_ICON_IDS.includes(msg.icon) && info.userId) info.icon = msg.icon;

  // Persist changes to database for logged-in users
  if (info.userId) {
    if (newName) db.updateUserDisplayName(info.userId, newName).catch(() => {});
    if (msg.icon && ALL_ICONS.includes(msg.icon)) db.updateUserIcon(info.userId, info.icon).catch(() => {});
  }

  // Persist changes for guest sessions
  if (!info.userId && info.guestToken) {
    auth.updateGuestProfile(info.guestToken, info.name, info.icon).catch(() => {});
  }

  // If already in a lobby, update there too
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (ctx) {
    const player = ctx.state.players[pid];
    if (player) {
      if (newName) player.name = newName;
      if (msg.icon && ICONS.includes(msg.icon)) player.icon = msg.icon;
      if (msg.icon && PREMIUM_ICON_IDS.includes(msg.icon) && info.userId) player.icon = msg.icon;
      network.broadcastToLobby(ctx.lobbyId, {
        type: 'player-joined',
        player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score, isGuest: player.isGuest },
        playerCount: Object.keys(ctx.state.players).length,
      });
    }
  }
};
