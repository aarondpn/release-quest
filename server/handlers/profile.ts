import type { MessageHandler } from './types.ts';
import { ICONS, PREMIUM_ICON_IDS, SHOP_ICON_IDS } from '../config.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as auth from '../auth.ts';
import { getCtxForPlayer } from '../helpers.ts';

function isShopIcon(icon: string): boolean {
  return SHOP_ICON_IDS.includes(icon);
}

async function validateAndSetIcon(icon: string, info: { userId?: number; icon: string }): Promise<boolean> {
  // Guests cannot change their icon
  if (!info.userId) return false;
  if (ICONS.includes(icon)) { info.icon = icon; return true; }
  if (PREMIUM_ICON_IDS.includes(icon)) { info.icon = icon; return true; }
  if (isShopIcon(icon)) {
    const owns = await db.userOwnsItem(info.userId, icon);
    if (owns) { info.icon = icon; return true; }
  }
  return false;
}

export const handleSetName: MessageHandler = async ({ msg, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info) return;
  const newName = String(msg.name || '').trim().slice(0, 16);
  if (newName) info.name = newName;

  let iconChanged = false;
  if (msg.icon) {
    iconChanged = await validateAndSetIcon(msg.icon, info);
  }

  // Persist changes to database for logged-in users
  if (info.userId) {
    if (newName) db.updateUserDisplayName(info.userId, newName).catch(() => {});
    if (iconChanged) db.updateUserIcon(info.userId, info.icon).catch(() => {});
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
      player.icon = info.icon;
      network.broadcastToLobby(ctx.lobbyId, {
        type: 'player-joined',
        player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score, isGuest: player.isGuest },
        playerCount: Object.keys(ctx.state.players).length,
      });
    }
  }
};
