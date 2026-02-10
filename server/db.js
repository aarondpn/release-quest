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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(16) NOT NULL UNIQUE,
      password_hash VARCHAR(72) NOT NULL,
      display_name VARCHAR(16) NOT NULL,
      icon VARCHAR(8) NOT NULL DEFAULT '🐱',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      games_lost INTEGER NOT NULL DEFAULT 0,
      total_score BIGINT NOT NULL DEFAULT 0,
      highest_score INTEGER NOT NULL DEFAULT 0,
      bugs_squashed INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Clean expired sessions
  await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`);

  // Clean up stale lobby data from previous runs
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

// ── User & session queries ──

async function createUser(username, passwordHash, displayName, icon) {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, icon) VALUES ($1, $2, $3, $4) RETURNING *`,
    [username, passwordHash, displayName, icon]
  );
  return result.rows[0];
}

async function getUserByUsername(username) {
  const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  return result.rows[0] || null;
}

async function createSession(token, userId, expiresAt) {
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
}

async function getSessionWithUser(token) {
  const result = await pool.query(
    `SELECT s.token, s.expires_at, u.id AS user_id, u.username, u.display_name, u.icon
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

async function deleteSession(token) {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// ── Stats queries ──

async function recordGameStats(userId, score, won, bugsSquashed) {
  await pool.query(`
    INSERT INTO user_stats (user_id, games_played, games_won, games_lost, total_score, highest_score, bugs_squashed, updated_at)
    VALUES ($1, 1, $2, $3, $4::bigint, $5, $6, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = user_stats.games_played + 1,
      games_won = user_stats.games_won + $2,
      games_lost = user_stats.games_lost + $3,
      total_score = user_stats.total_score + $4::bigint,
      highest_score = GREATEST(user_stats.highest_score, $5),
      bugs_squashed = user_stats.bugs_squashed + $6,
      updated_at = NOW()
  `, [userId, won ? 1 : 0, won ? 0 : 1, score, score, bugsSquashed]);
}

async function getLeaderboard(limit = 10) {
  const result = await pool.query(`
    SELECT u.display_name, u.icon, s.games_played, s.games_won, s.games_lost,
           s.total_score, s.highest_score, s.bugs_squashed
    FROM user_stats s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.total_score DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
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
  createUser,
  getUserByUsername,
  createSession,
  getSessionWithUser,
  deleteSession,
  recordGameStats,
  getLeaderboard,
};
