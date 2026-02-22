import type { MessageHandler } from './types.ts';
import * as network from '../network.ts';
import * as lobby from '../lobby.ts';
import * as db from '../db.ts';
import { EMOTE_MAP, FREE_EMOTE_IDS } from '../../shared/emotes.ts';
import type { ServerMessage } from '../../shared/messages.ts';

// Rate limiting: 3 emotes per 5 seconds
const rateLimitBuckets = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5_000;

const ALLOWED_PHASES = new Set(['playing', 'boss', 'shopping', 'mini_boss']);

function isRateLimited(pid: string): boolean {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(pid);
  if (!bucket) {
    bucket = [];
    rateLimitBuckets.set(pid, bucket);
  }
  while (bucket.length > 0 && bucket[0] <= now - RATE_LIMIT_WINDOW_MS) {
    bucket.shift();
  }
  if (bucket.length >= RATE_LIMIT_MAX) return true;
  bucket.push(now);
  return false;
}

export function removePlayerEmoteState(pid: string): void {
  rateLimitBuckets.delete(pid);
}

export const handleEmote: MessageHandler = async ({ ws, msg, pid, playerInfo }) => {
  const emoteId = msg.emoteId as string;

  // Validate emote exists
  if (!EMOTE_MAP.has(emoteId)) return;

  // Must be in a lobby
  const lobbyId = lobby.getLobbyForPlayer(pid);
  if (!lobbyId) return;

  const lobbyMemory = lobby.getLobbyState(lobbyId);
  if (!lobbyMemory) return;

  // Phase gating
  if (!ALLOWED_PHASES.has(lobbyMemory.state.phase)) return;

  // Rate limit
  if (isRateLimited(pid)) {
    network.send(ws, { type: 'error', message: 'Emote cooldown — slow down!' });
    return;
  }

  const info = playerInfo.get(pid);
  if (!info) return;

  // Premium check
  if (!FREE_EMOTE_IDS.has(emoteId)) {
    if (!info.userId) return; // guests can't use premium emotes
    const owns = await db.userOwnsItem(info.userId, emoteId);
    if (!owns) return;
  }

  // Get player position
  const player = lobbyMemory.state.players[pid];
  if (!player) return;

  const broadcast: ServerMessage = {
    type: 'emote-broadcast',
    playerId: pid,
    playerName: info.name,
    emoteId,
    x: player.x,
    y: player.y,
  };

  // Broadcast to all clients in the lobby (goes through broadcastToLobby so it's captured in recordings)
  network.broadcastToLobby(lobbyId, broadcast);
};
