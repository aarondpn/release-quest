import { LOBBY_CONFIG } from './config.ts';
import { createGameState, createCounters } from './state.ts';
import * as db from './db.ts';
import type { GameContext, LobbyMemory, PlayerData, DbLobbyRow } from './types.ts';

// In-memory registry: lobbyId -> { state, counters, timers }
export const lobbies = new Map<number, LobbyMemory>();

// Reverse lookup: playerId -> lobbyId
export const playerToLobby = new Map<string, number>();

export async function createLobby(name: string, maxPlayers: number | undefined): Promise<{ lobby?: DbLobbyRow; error?: string }> {
  const lobbyCount = await db.getActiveLobbyCount();
  if (lobbyCount >= LOBBY_CONFIG.maxLobbies) {
    return { error: 'Maximum number of lobbies reached' };
  }

  let mp = Math.min(maxPlayers || LOBBY_CONFIG.defaultMaxPlayers, LOBBY_CONFIG.maxPlayersLimit);
  mp = Math.max(1, mp);

  const row = await db.createLobby(name, mp);

  lobbies.set(row.id, {
    state: createGameState(),
    counters: createCounters(),
    timers: {},
  });

  return { lobby: row };
}

export async function joinLobby(lobbyId: number, playerId: string, playerData: PlayerData): Promise<{ lobby?: DbLobbyRow; mem?: LobbyMemory; error?: string }> {
  const lobby = await db.getLobby(lobbyId);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.status !== 'active') return { error: 'Lobby is no longer active' };

  const playerCount = await db.getLobbyPlayerCount(lobbyId);
  if (playerCount >= lobby.max_players) {
    return { error: 'Lobby is full' };
  }

  await db.joinLobby(lobbyId, playerId, playerData.name);
  playerToLobby.set(playerId, lobbyId);

  // Ensure in-memory state exists
  if (!lobbies.has(lobbyId)) {
    lobbies.set(lobbyId, {
      state: createGameState(),
      counters: createCounters(),
      timers: {},
    });
  }

  const mem = lobbies.get(lobbyId)!;
  mem.state.players[playerId] = playerData;

  return { lobby, mem };
}

export async function leaveLobby(lobbyId: number, playerId: string): Promise<void> {
  try {
    await db.leaveLobby(lobbyId, playerId);
  } catch (err: unknown) {
    console.error('DB leaveLobby failed:', (err as Error).message);
  }
  playerToLobby.delete(playerId);

  const mem = lobbies.get(lobbyId);
  if (mem) {
    delete mem.state.players[playerId];

    // Auto-delete empty lobbies — check both in-memory and DB
    const inMemoryEmpty = Object.keys(mem.state.players).length === 0;
    let dbEmpty = false;
    try {
      const remaining = await db.getLobbyPlayerCount(lobbyId);
      dbEmpty = remaining === 0;
    } catch {
      // DB unavailable — rely on in-memory count
      dbEmpty = inMemoryEmpty;
    }

    if (inMemoryEmpty || dbEmpty) {
      await destroyLobby(lobbyId);
    }
  }
}

export async function destroyLobby(lobbyId: number): Promise<void> {
  const mem = lobbies.get(lobbyId);
  if (mem) {
    // Clear any running game timers
    for (const key of Object.keys(mem.timers)) {
      clearTimeout(mem.timers[key]);
      clearInterval(mem.timers[key]);
    }
    // Clear boss TimerBag
    if (mem.timers._boss && mem.timers._boss.clearAll) {
      mem.timers._boss.clearAll();
    }
    // Clear bug timers
    for (const bugId of Object.keys(mem.state.bugs)) {
      mem.state.bugs[bugId]._timers.clearAll();
    }
    lobbies.delete(lobbyId);
  }
  await db.deleteLobby(lobbyId);
}

export async function listLobbies(): Promise<DbLobbyRow[]> {
  return db.listLobbies();
}

// Periodic sweep: destroy any in-memory lobby with 0 players
export async function sweepEmptyLobbies(): Promise<void> {
  for (const [lobbyId, mem] of lobbies) {
    if (Object.keys(mem.state.players).length === 0) {
      console.log(`Sweeping empty lobby ${lobbyId}`);
      await destroyLobby(lobbyId);
    }
  }
}

export function getLobbyForPlayer(playerId: string): number | null {
  return playerToLobby.get(playerId) || null;
}

export function getLobbyState(lobbyId: number): LobbyMemory | null {
  return lobbies.get(lobbyId) || null;
}
