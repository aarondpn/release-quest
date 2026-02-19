import type { WebSocket } from 'ws';
import type { GameContext, PlayerInfo } from './types.ts';
import logger from './logger.ts';
import * as network from './network.ts';
import * as lobby from './lobby.ts';
import * as game from './game.ts';
import { broadcastSystemChat, removePlayerFromChat } from './handlers/chat.ts';

/**
 * Get the game context for a specific player
 */
export function getCtxForPlayer(pid: string, playerInfo: Map<string, PlayerInfo>): GameContext | null {
  const lobbyId = lobby.getLobbyForPlayer(pid);
  if (!lobbyId) return null;
  const mem = lobby.getLobbyState(lobbyId);
  if (!mem) return null;
  const ctx: GameContext = { lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers, matchLog: null, playerInfo, events: mem.events, lifecycle: mem.lifecycle };
  // matchLog must persist across ctx instances so logging survives level transitions
  Object.defineProperty(ctx, 'matchLog', {
    get() { return mem.matchLog; },
    set(v: unknown) { mem.matchLog = v as GameContext['matchLog']; },
    enumerable: true,
  });
  return ctx;
}

/**
 * Handle player leaving a lobby
 */
export async function handleLeaveLobby(ws: WebSocket, pid: string, lobbyId: number, playerInfo: Map<string, PlayerInfo>): Promise<void> {
  const mem = lobby.getLobbyState(lobbyId);
  const info = playerInfo.get(pid);
  broadcastSystemChat(lobbyId, `${info?.name || 'Unknown'} left`);
  removePlayerFromChat(lobbyId, pid);
  network.wsToLobby.delete(ws);
  network.removeClientFromLobby(lobbyId, ws);

  try {
    await lobby.leaveLobby(lobbyId, pid);
  } catch (err: unknown) {
    logger.error({ err, lobbyId, playerId: pid }, 'Error leaving lobby');
  }

  if (mem) {
    const remaining = Object.keys(mem.state.players).length;
    // Notify remaining players
    network.broadcastToLobby(lobbyId, {
      type: 'player-left',
      playerId: pid,
      playerCount: remaining,
    });

    // Reset game if lobby is now empty (destroyLobby already called by leaveLobby)
    if (remaining === 0) {
      game.resetToLobby({ lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers, matchLog: null, playerInfo, events: mem.events, lifecycle: mem.lifecycle });
    }
  }
}

/**
 * Augment lobby list with runtime state
 */
export function augmentLobbies(lobbies: any[]): any[] {
  return lobbies.map(l => {
    const mem = lobby.lobbies.get(l.id);
    const customConfig = (l.settings as any)?.customConfig;
    const hasCustomSettings = !!(customConfig && Object.keys(customConfig).length > 0);
    const hasPassword = !!(l.settings as any)?.password;
    // Strip password from settings before sending to clients
    const { password: _pw, ...safeSettings } = (l.settings as any) || {};
    return { ...l, settings: safeSettings, started: mem ? mem.state.phase !== 'lobby' : false, hasCustomSettings, hasPassword, spectatorCount: lobby.getSpectators(l.id).size };
  });
}

/**
 * Broadcast lobby list to all unattached clients
 */
export function broadcastLobbyList(wss: any): void {
  lobby.listLobbies().then(lobbies => {
    // Send to all clients not in a lobby
    const data = JSON.stringify({ type: 'lobby-list', lobbies: augmentLobbies(lobbies) });
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1 && !network.wsToLobby.has(client)) {
        client.send(data);
      }
    });
  }).catch(() => {});
}
