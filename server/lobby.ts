import { LOBBY_CONFIG } from './config.ts';
import { createGameState, createCounters } from './state.ts';
import { createTimerBag } from './timer-bag.ts';
import logger, { createLobbyLogger } from './logger.ts';
import * as db from './db.ts';
import { gameLobbiesActive } from './metrics.ts';
import { createEventBus } from './event-bus.ts';
import { createGameLifecycle } from './game-lifecycle.ts';
import { broadcastToLobby } from './network.ts';
import { stopRecording } from './recording.ts';
import { cleanupChatForLobby } from './handlers/chat.ts';
import type { LobbyMemory, PlayerData, DbLobbyRow, CustomDifficultyConfig, GameTimers } from './types.ts';

function createGameTimers(): GameTimers {
  return { lobby: createTimerBag(), boss: createTimerBag() };
}

function createLobbyMemory(lobbyId: number, difficulty: string, customConfig?: CustomDifficultyConfig): LobbyMemory {
  const timers = createGameTimers();
  const state = createGameState(difficulty, customConfig);
  const events = createEventBus();
  events.on((msg) => broadcastToLobby(lobbyId, msg));

  const lifecycle = createGameLifecycle();

  // Register cleanup hooks in order
  lifecycle.onCleanup(() => timers.lobby.clearAll());
  lifecycle.onCleanup(() => timers.boss.clearAll());
  lifecycle.onCleanup(() => {
    for (const id of Object.keys(state.bugs)) {
      state.bugs[id]._timers.clearAll();
    }
    state.bugs = {};
    state.pipelineChains = {};
  });
  lifecycle.onCleanup(() => {
    state.rubberDuck = null;
    state.duckBuff = null;
    state.hotfixHammer = null;
    state.hammerStunActive = false;
  });
  lifecycle.onCleanup(() => {
    state.playerBuffs = {};
    state.shopReadyPlayers = undefined;
  });
  // matchLog is mutable on the mem object, so close via a closure over mem reference
  const mem: LobbyMemory = {
    state,
    counters: createCounters(),
    timers,
    matchLog: null,
    events,
    lifecycle,
  };
  lifecycle.onCleanup(() => {
    if (mem.matchLog) { mem.matchLog.close(); mem.matchLog = null; }
  });
  lifecycle.onCleanup(() => stopRecording(lobbyId));

  return mem;
}

// In-memory registry: lobbyId -> { state, counters, timers }
export const lobbies = new Map<number, LobbyMemory>();

// Reverse lookup: playerId -> lobbyId
export const playerToLobby = new Map<string, number>();

export async function createLobby(name: string, maxPlayers: number | undefined, difficulty: string = 'medium', customConfig?: CustomDifficultyConfig, password?: string): Promise<{ lobby?: DbLobbyRow; error?: string }> {
  const lobbyCount = await db.getActiveLobbyCount();
  if (lobbyCount >= LOBBY_CONFIG.maxLobbies) {
    return { error: 'Maximum number of lobbies reached' };
  }

  let mp = Math.min(maxPlayers || LOBBY_CONFIG.defaultMaxPlayers, LOBBY_CONFIG.maxPlayersLimit);
  mp = Math.max(1, mp);

  const settings: Record<string, unknown> = { difficulty, customConfig };
  if (password) settings.password = password;
  const row = await db.createLobby(name, mp, settings);

  lobbies.set(row.id, createLobbyMemory(row.id, difficulty, customConfig));
  gameLobbiesActive.inc();

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
    const difficulty = (lobby.settings as any)?.difficulty || 'medium';
    const customConfig = (lobby.settings as any)?.customConfig;
    lobbies.set(lobbyId, createLobbyMemory(lobbyId, difficulty, customConfig));
  }

  const mem = lobbies.get(lobbyId)!;
  mem.state.players[playerId] = playerData;

  return { lobby, mem };
}

export async function leaveLobby(lobbyId: number, playerId: string): Promise<void> {
  try {
    await db.leaveLobby(lobbyId, playerId);
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message, lobbyId, playerId }, 'DB leaveLobby failed');
  }
  playerToLobby.delete(playerId);

  const mem = lobbies.get(lobbyId);
  if (mem) {
    delete mem.state.players[playerId];
    delete mem.state.playerBuffs[playerId];

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
    mem.lifecycle.destroy();
    lobbies.delete(lobbyId);
    gameLobbiesActive.dec();
  }
  cleanupChatForLobby(lobbyId);

  try {
    await db.deleteLobby(lobbyId);
  } catch (err) {
    logger.error({ err, lobbyId }, 'Error deleting lobby from DB');
  }
}

export async function listLobbies(): Promise<DbLobbyRow[]> {
  return db.listLobbies();
}

// Periodic sweep: destroy any in-memory lobby with 0 players
export async function sweepEmptyLobbies(): Promise<void> {
  for (const [lobbyId, mem] of lobbies) {
    if (Object.keys(mem.state.players).length === 0) {
      const lobbyLogger = createLobbyLogger(lobbyId.toString());
      lobbyLogger.info('Sweeping empty lobby');
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
