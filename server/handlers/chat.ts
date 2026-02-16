import type { MessageHandler } from './types.ts';
import * as network from '../network.ts';
import * as lobby from '../lobby.ts';
import logger from '../logger.ts';

// In-memory chat state per lobby
const lobbyModerators = new Map<number, string>();
const rateLimitBuckets = new Map<string, number[]>();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_MESSAGE_LENGTH = 200;

// Profanity filter — normalizes leet-speak and spacing before matching
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'penis', 'vagina',
  'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut',
  'asshole', 'bastard', 'wanker', 'twat',
];

// Leet-speak substitution map
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

function normalize(text: string): string {
  // Replace leet-speak chars, strip spaces and common separators
  return text
    .split('')
    .map(c => LEET_MAP[c] || c)
    .join('')
    .replace(/[\s._\-*]/g, '')
    .toLowerCase();
}

function censorMessage(text: string): string {
  const normalized = normalize(text);
  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) {
      return '*'.repeat(text.length);
    }
  }
  return text;
}

// --- Lifecycle functions ---

export function initChatForLobby(lobbyId: number, creatorPid: string): void {
  lobbyModerators.set(lobbyId, creatorPid);
}

export function cleanupChatForLobby(lobbyId: number): void {
  lobbyModerators.delete(lobbyId);
}

export function removePlayerFromChat(_lobbyId: number, pid: string): void {
  rateLimitBuckets.delete(pid);
}

export function getLobbyModerator(lobbyId: number): string | null {
  return lobbyModerators.get(lobbyId) || null;
}

// --- Helpers ---

function broadcastChatToLobby(lobbyId: number, msg: Record<string, unknown>): void {
  const clients = network.lobbyClients.get(lobbyId);
  if (!clients) return;
  const data = JSON.stringify(msg);
  for (const client of clients) {
    try {
      if (client.readyState === 1) {
        client.send(data);
      }
    } catch (err) {
      logger.error({ err, lobbyId }, 'Error sending chat to client');
    }
  }
}

export function broadcastSystemChat(lobbyId: number, text: string): void {
  broadcastChatToLobby(lobbyId, {
    type: 'chat-broadcast',
    system: true,
    message: text,
    timestamp: Date.now(),
  });
}

function isRateLimited(pid: string): boolean {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(pid);
  if (!bucket) {
    bucket = [];
    rateLimitBuckets.set(pid, bucket);
  }
  // Remove timestamps outside the window
  while (bucket.length > 0 && bucket[0] <= now - RATE_LIMIT_WINDOW_MS) {
    bucket.shift();
  }
  if (bucket.length >= RATE_LIMIT_MAX) {
    return true;
  }
  bucket.push(now);
  return false;
}

// --- Handlers ---

export const handleChatMessage: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const lobbyId = lobby.getLobbyForPlayer(pid);
  if (!lobbyId) {
    network.send(ws, { type: 'chat-error', message: 'You are not in a lobby' });
    return;
  }

  const info = playerInfo.get(pid);
  if (!info) return;

  // Only logged-in users can send messages
  if (!info.userId) {
    network.send(ws, { type: 'chat-error', message: 'Only registered users can chat' });
    return;
  }

  // Rate limit
  if (isRateLimited(pid)) {
    network.send(ws, { type: 'chat-error', message: 'Slow down! Too many messages' });
    return;
  }

  // Sanitize message
  let text = String(msg.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return;

  text = censorMessage(text);

  broadcastChatToLobby(lobbyId, {
    type: 'chat-broadcast',
    system: false,
    playerId: pid,
    playerName: info.name,
    playerIcon: info.icon,
    playerColor: info.color,
    message: text,
    timestamp: Date.now(),
  });
};
