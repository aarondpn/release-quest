const { Pool } = require('pg');
const { DATABASE_CONFIG } = require('./config');

const pool = new Pool(DATABASE_CONFIG);

async function initialize() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobbies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      code VARCHAR(8) NOT NULL UNIQUE,
      max_players INTEGER NOT NULL DEFAULT 4,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      settings JSONB NOT NULL DEFAULT '{}'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobby_players (
      lobby_id INTEGER NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
      player_id VARCHAR(64) NOT NULL,
      player_name VARCHAR(64) NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (lobby_id, player_id)
    )
  `);

  // Clean up stale data from previous runs
  await pool.query(`DELETE FROM lobby_players`);
  await pool.query(`DELETE FROM lobbies`);
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createLobby(name, maxPlayers, settings = {}) {
  const code = generateCode();
  const result = await pool.query(
    `INSERT INTO lobbies (name, code, max_players, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, code, maxPlayers, JSON.stringify(settings)]
  );
  return result.rows[0];
}

async function joinLobby(lobbyId, playerId, playerName) {
  await pool.query(
    `INSERT INTO lobby_players (lobby_id, player_id, player_name) VALUES ($1, $2, $3)
     ON CONFLICT (lobby_id, player_id) DO NOTHING`,
    [lobbyId, playerId, playerName]
  );
}

async function leaveLobby(lobbyId, playerId) {
  await pool.query(
    `DELETE FROM lobby_players WHERE lobby_id = $1 AND player_id = $2`,
    [lobbyId, playerId]
  );
}

async function listLobbies() {
  const result = await pool.query(`
    SELECT l.*, COUNT(lp.player_id)::int AS player_count
    FROM lobbies l
    LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
    WHERE l.status = 'active'
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `);
  return result.rows;
}

async function getLobby(lobbyId) {
  const result = await pool.query(`SELECT * FROM lobbies WHERE id = $1`, [lobbyId]);
  return result.rows[0] || null;
}

async function deleteLobby(lobbyId) {
  await pool.query(`DELETE FROM lobbies WHERE id = $1`, [lobbyId]);
}

async function getLobbyPlayerCount(lobbyId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM lobby_players WHERE lobby_id = $1`,
    [lobbyId]
  );
  return result.rows[0].count;
}

async function getActiveLobbyCount() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM lobbies WHERE status = 'active'`
  );
  return result.rows[0].count;
}

module.exports = {
  pool,
  initialize,
  createLobby,
  joinLobby,
  leaveLobby,
  listLobbies,
  getLobby,
  deleteLobby,
  getLobbyPlayerCount,
  getActiveLobbyCount,
};
