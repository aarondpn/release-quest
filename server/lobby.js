const { LOBBY_CONFIG } = require('./config');
const { createGameState, createCounters } = require('./state');
const db = require('./db');

// In-memory registry: lobbyId -> { state, counters, timers }
const lobbies = new Map();

// Reverse lookup: playerId -> lobbyId
const playerToLobby = new Map();

async function createLobby(name, maxPlayers) {
  const lobbyCount = await db.getActiveLobbyCount();
  if (lobbyCount >= LOBBY_CONFIG.maxLobbies) {
    return { error: 'Maximum number of lobbies reached' };
  }

  maxPlayers = Math.min(maxPlayers || LOBBY_CONFIG.defaultMaxPlayers, LOBBY_CONFIG.maxPlayersLimit);
  maxPlayers = Math.max(1, maxPlayers);

  const row = await db.createLobby(name, maxPlayers);

  lobbies.set(row.id, {
    state: createGameState(),
    counters: createCounters(),
    timers: {},
  });

  return { lobby: row };
}

async function joinLobby(lobbyId, playerId, playerData) {
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

  const mem = lobbies.get(lobbyId);
  mem.state.players[playerId] = playerData;

  return { lobby, mem };
}

async function leaveLobby(lobbyId, playerId) {
  try {
    await db.leaveLobby(lobbyId, playerId);
  } catch (err) {
    console.error('DB leaveLobby failed:', err.message);
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

async function destroyLobby(lobbyId) {
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

async function listLobbies() {
  return db.listLobbies();
}

// Periodic sweep: destroy any in-memory lobby with 0 players
async function sweepEmptyLobbies() {
  for (const [lobbyId, mem] of lobbies) {
    if (Object.keys(mem.state.players).length === 0) {
      console.log(`Sweeping empty lobby ${lobbyId}`);
      await destroyLobby(lobbyId);
    }
  }
}

function getLobbyForPlayer(playerId) {
  return playerToLobby.get(playerId) || null;
}

function getLobbyState(lobbyId) {
  return lobbies.get(lobbyId) || null;
}

module.exports = {
  lobbies,
  playerToLobby,
  createLobby,
  joinLobby,
  leaveLobby,
  destroyLobby,
  listLobbies,
  sweepEmptyLobbies,
  getLobbyForPlayer,
  getLobbyState,
};
