import crypto from 'node:crypto';
import pg from 'pg';
import { DATABASE_CONFIG } from './config.ts';
import type { DbLobbyRow, DbUserRow, DbSessionRow, DbGuestSessionRow, LeaderboardEntry, RecordingMetadata, RecordingEvent, RecordingRow, RecordingPlayerRow, RecordingEventRow, RecordingMouseMoveRow, MouseMoveEvent, UserQuestRow, CurrencyBalance, InventoryItem } from './types.ts';

const { Pool } = pg;
const pool = new Pool(DATABASE_CONFIG);

export async function initialize(): Promise<void> {
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
      icon VARCHAR(16) NOT NULL DEFAULT '\u{1F431}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Widen icon column for avatar IDs (e.g. "av:knight", "shop:phoenix_gold")
  await pool.query(`ALTER TABLE users ALTER COLUMN icon TYPE VARCHAR(64)`);

  // Track which shop rotation the user last viewed
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_seen_rotation VARCHAR(32)`);

  // Migrate legacy premium icons that moved to the shop
  await pool.query(`
    UPDATE users SET icon = CASE icon
      WHEN 'av:cyborg' THEN 'shop:cyborg'
      WHEN 'av:phoenix' THEN 'shop:phoenix_bird'
      WHEN 'av:samurai' THEN 'shop:samurai'
      WHEN 'av:reaper' THEN 'shop:reaper'
      WHEN 'av:dragon' THEN 'shop:dragon'
      ELSE icon
    END
    WHERE icon IN ('av:cyborg', 'av:phoenix', 'av:samurai', 'av:reaper', 'av:dragon')
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_recordings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER NOT NULL,
      outcome VARCHAR(16) NOT NULL,
      score INTEGER NOT NULL,
      difficulty VARCHAR(16) NOT NULL,
      player_count INTEGER NOT NULL
    )
  `);

  // Drop legacy JSONB columns if they exist
  await pool.query(`
    ALTER TABLE game_recordings DROP COLUMN IF EXISTS players,
                                DROP COLUMN IF EXISTS events
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recording_players (
      id SERIAL PRIMARY KEY,
      recording_id INTEGER NOT NULL REFERENCES game_recordings(id) ON DELETE CASCADE,
      player_id VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      icon VARCHAR(16) NOT NULL DEFAULT '',
      color VARCHAR(16) NOT NULL,
      score INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Widen recording_players icon column for avatar IDs
  await pool.query(`ALTER TABLE recording_players ALTER COLUMN icon TYPE VARCHAR(64)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recording_events (
      id SERIAL PRIMARY KEY,
      recording_id INTEGER NOT NULL REFERENCES game_recordings(id) ON DELETE CASCADE,
      t INTEGER NOT NULL,
      type VARCHAR(64) NOT NULL,
      data JSONB NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recording_mouse_moves (
      id SERIAL PRIMARY KEY,
      recording_id INTEGER NOT NULL REFERENCES game_recordings(id) ON DELETE CASCADE,
      player_id VARCHAR(64) NOT NULL,
      t INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL
    )
  `);

  // Add share columns for public replay sharing
  await pool.query(`
    ALTER TABLE game_recordings ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE
  `);
  await pool.query(`
    ALTER TABLE game_recordings ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guest_sessions (
      token VARCHAR(64) PRIMARY KEY,
      name VARCHAR(16) NOT NULL,
      icon VARCHAR(16) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_currency (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0,
      total_earned INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_quests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_key VARCHAR(64) NOT NULL,
      quest_type VARCHAR(16) NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      target INTEGER NOT NULL,
      reward INTEGER NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      claimed BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      period_start DATE NOT NULL,
      period_end DATE NOT NULL
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_quests_active
    ON user_quests (user_id, quest_type, period_end)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_inventory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id VARCHAR(64) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'avatar',
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, item_id)
    )
  `);

  // Clean expired sessions
  await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  await pool.query(`DELETE FROM guest_sessions WHERE expires_at < NOW()`);

  // Clean up stale lobby data from previous runs
  await pool.query(`DELETE FROM lobby_players`);
  await pool.query(`DELETE FROM lobbies`);
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLobby(name: string, maxPlayers: number, settings: Record<string, unknown> = {}): Promise<DbLobbyRow> {
  const code = generateCode();
  const result = await pool.query(
    `INSERT INTO lobbies (name, code, max_players, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, code, maxPlayers, JSON.stringify(settings)]
  );
  return result.rows[0] as DbLobbyRow;
}

export async function joinLobby(lobbyId: number, playerId: string, playerName: string): Promise<void> {
  await pool.query(
    `INSERT INTO lobby_players (lobby_id, player_id, player_name) VALUES ($1, $2, $3)
     ON CONFLICT (lobby_id, player_id) DO NOTHING`,
    [lobbyId, playerId, playerName]
  );
}

export async function leaveLobby(lobbyId: number, playerId: string): Promise<void> {
  await pool.query(
    `DELETE FROM lobby_players WHERE lobby_id = $1 AND player_id = $2`,
    [lobbyId, playerId]
  );
}

export async function listLobbies(): Promise<DbLobbyRow[]> {
  const result = await pool.query(`
    SELECT l.*, COUNT(lp.player_id)::int AS player_count
    FROM lobbies l
    LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
    WHERE l.status = 'active'
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `);
  return result.rows as DbLobbyRow[];
}

export async function getLobby(lobbyId: number): Promise<DbLobbyRow | null> {
  const result = await pool.query(`SELECT * FROM lobbies WHERE id = $1`, [lobbyId]);
  return (result.rows[0] as DbLobbyRow) || null;
}

export async function getLobbyByCode(code: string): Promise<DbLobbyRow | null> {
  const result = await pool.query(`
    SELECT l.*, COUNT(lp.player_id)::int AS player_count
    FROM lobbies l
    LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
    WHERE l.code = $1 AND l.status = 'active'
    GROUP BY l.id
  `, [code]);
  return (result.rows[0] as DbLobbyRow) || null;
}

export async function deleteLobby(lobbyId: number): Promise<void> {
  await pool.query(`DELETE FROM lobbies WHERE id = $1`, [lobbyId]);
}

export async function getLobbyPlayerCount(lobbyId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM lobby_players WHERE lobby_id = $1`,
    [lobbyId]
  );
  return (result.rows[0] as { count: number }).count;
}

export async function getActiveLobbyCount(): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM lobbies WHERE status = 'active'`
  );
  return (result.rows[0] as { count: number }).count;
}

// User & session queries

export async function createUser(username: string, passwordHash: string, displayName: string, icon: string): Promise<DbUserRow> {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, display_name, icon) VALUES ($1, $2, $3, $4) RETURNING *`,
    [username, passwordHash, displayName, icon]
  );
  return result.rows[0] as DbUserRow;
}

export async function updateUserIcon(userId: number, icon: string): Promise<void> {
  await pool.query(`UPDATE users SET icon = $1 WHERE id = $2`, [icon, userId]);
}

export async function updateUserDisplayName(userId: number, displayName: string): Promise<void> {
  await pool.query(`UPDATE users SET display_name = $1 WHERE id = $2`, [displayName, userId]);
}

export async function getUserByUsername(username: string): Promise<DbUserRow | null> {
  const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  return (result.rows[0] as DbUserRow) || null;
}

export async function createSession(token: string, userId: number, expiresAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
}

export async function getSessionWithUser(token: string): Promise<DbSessionRow | null> {
  const result = await pool.query(
    `SELECT s.token, s.expires_at, u.id AS user_id, u.username, u.display_name, u.icon
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return (result.rows[0] as DbSessionRow) || null;
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// Guest session queries

export async function createGuestSession(token: string, name: string, icon: string): Promise<void> {
  await pool.query(
    `INSERT INTO guest_sessions (token, name, icon) VALUES ($1, $2, $3)`,
    [token, name, icon]
  );
}

export async function getGuestSession(token: string): Promise<DbGuestSessionRow | null> {
  const result = await pool.query(
    `SELECT * FROM guest_sessions WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  return (result.rows[0] as DbGuestSessionRow) || null;
}

export async function updateGuestSession(token: string, name: string, icon: string): Promise<void> {
  await pool.query(
    `UPDATE guest_sessions SET name = $1, icon = $2 WHERE token = $3`,
    [name, icon, token]
  );
}

export async function deleteGuestSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM guest_sessions WHERE token = $1`, [token]);
}

export async function expireGuestSessions(): Promise<number> {
  const result = await pool.query(`DELETE FROM guest_sessions WHERE expires_at < NOW()`);
  return result.rowCount ?? 0;
}

// Stats queries

export async function recordGameStats(userId: number, score: number, won: boolean, bugsSquashed: number): Promise<void> {
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

export async function getUserStats(userId: number): Promise<LeaderboardEntry | null> {
  const result = await pool.query(`
    SELECT u.display_name, u.icon, s.games_played, s.games_won, s.games_lost,
           s.total_score, s.highest_score, s.bugs_squashed
    FROM user_stats s
    JOIN users u ON s.user_id = u.id
    WHERE s.user_id = $1
  `, [userId]);
  return (result.rows[0] as LeaderboardEntry) || null;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const result = await pool.query(`
    SELECT u.display_name, u.icon, s.games_played, s.games_won, s.games_lost,
           s.total_score, s.highest_score, s.bugs_squashed
    FROM user_stats s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.total_score DESC
    LIMIT $1
  `, [limit]);
  return result.rows as LeaderboardEntry[];
}

// Recording queries

export async function saveRecording(
  userId: number,
  meta: Omit<RecordingMetadata, 'userId'>,
  events: RecordingEvent[],
  mouseMovements: MouseMoveEvent[]
): Promise<void> {
  // 1. Insert metadata row
  const recResult = await pool.query(
    `INSERT INTO game_recordings (user_id, duration_ms, outcome, score, difficulty, player_count)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, meta.duration_ms, meta.outcome, meta.score, meta.difficulty, meta.player_count]
  );
  const recordingId = recResult.rows[0].id as number;

  // 2. Batch insert players
  if (meta.players.length > 0) {
    const playerValues: unknown[] = [];
    const playerPlaceholders: string[] = [];
    let idx = 1;
    for (const p of meta.players) {
      playerPlaceholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
      playerValues.push(recordingId, p.id, p.name, p.icon, p.color, p.score);
      idx += 6;
    }
    await pool.query(
      `INSERT INTO recording_players (recording_id, player_id, name, icon, color, score) VALUES ${playerPlaceholders.join(', ')}`,
      playerValues
    );
  }

  // 3. Batch insert non-cursor events
  if (events.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < events.length; i += BATCH) {
      const batch = events.slice(i, i + BATCH);
      const evValues: unknown[] = [];
      const evPlaceholders: string[] = [];
      let idx = 1;
      for (const ev of batch) {
        evPlaceholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
        const eventType = (ev.msg.type as string) || 'unknown';
        evValues.push(recordingId, ev.t, eventType, JSON.stringify(ev.msg));
        idx += 4;
      }
      await pool.query(
        `INSERT INTO recording_events (recording_id, t, type, data) VALUES ${evPlaceholders.join(', ')}`,
        evValues
      );
    }
  }

  // 4. Batch insert mouse movements
  if (mouseMovements.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < mouseMovements.length; i += BATCH) {
      const batch = mouseMovements.slice(i, i + BATCH);
      const mmValues: unknown[] = [];
      const mmPlaceholders: string[] = [];
      let idx = 1;
      for (const mm of batch) {
        mmPlaceholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
        mmValues.push(recordingId, mm.playerId, mm.t, mm.x, mm.y);
        idx += 5;
      }
      await pool.query(
        `INSERT INTO recording_mouse_moves (recording_id, player_id, t, x, y) VALUES ${mmPlaceholders.join(', ')}`,
        mmValues
      );
    }
  }

  // 5. Retention: keep only 3 most recent non-shared per user (CASCADE deletes child rows)
  //    Shared replays are protected from retention purge (they expire via expireOldShares instead)
  await pool.query(
    `DELETE FROM game_recordings WHERE id IN (
       SELECT id FROM game_recordings WHERE user_id = $1 AND share_token IS NULL
       ORDER BY recorded_at DESC OFFSET 3
     )`,
    [userId]
  );
}

export async function getRecordingsList(userId: number): Promise<RecordingRow[]> {
  const recResult = await pool.query(
    `SELECT id, user_id, recorded_at, duration_ms, outcome, score, difficulty, player_count, share_token
     FROM game_recordings WHERE user_id = $1
     ORDER BY recorded_at DESC`,
    [userId]
  );
  const recordings = recResult.rows as RecordingRow[];

  if (recordings.length > 0) {
    const ids = recordings.map(r => r.id);
    const playersResult = await pool.query(
      `SELECT id, recording_id, player_id, name, icon, color, score
       FROM recording_players WHERE recording_id = ANY($1)`,
      [ids]
    );
    const playersByRecording = new Map<number, RecordingPlayerRow[]>();
    for (const row of playersResult.rows as RecordingPlayerRow[]) {
      const list = playersByRecording.get(row.recording_id) ?? [];
      list.push(row);
      playersByRecording.set(row.recording_id, list);
    }
    for (const rec of recordings) {
      rec.players = playersByRecording.get(rec.id) ?? [];
    }
  } else {
    for (const rec of recordings) {
      rec.players = [];
    }
  }

  return recordings;
}

export async function getRecording(id: number, userId: number): Promise<RecordingRow | null> {
  const recResult = await pool.query(
    `SELECT id, user_id, recorded_at, duration_ms, outcome, score, difficulty, player_count
     FROM game_recordings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (recResult.rows.length === 0) return null;
  const rec = recResult.rows[0] as RecordingRow;

  const [playersResult, eventsResult, mouseResult] = await Promise.all([
    pool.query(
      `SELECT id, recording_id, player_id, name, icon, color, score
       FROM recording_players WHERE recording_id = $1`,
      [id]
    ),
    pool.query(
      `SELECT id, recording_id, t, type, data
       FROM recording_events WHERE recording_id = $1 ORDER BY t`,
      [id]
    ),
    pool.query(
      `SELECT id, recording_id, player_id, t, x, y
       FROM recording_mouse_moves WHERE recording_id = $1 ORDER BY t`,
      [id]
    ),
  ]);

  rec.players = playersResult.rows as RecordingPlayerRow[];
  rec.events = eventsResult.rows as RecordingEventRow[];
  rec.mouseMovements = mouseResult.rows as RecordingMouseMoveRow[];

  return rec;
}

export async function shareRecording(id: number, userId: number): Promise<string | null> {
  // Check ownership and return existing token if already shared
  const existing = await pool.query(
    `SELECT share_token FROM game_recordings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (existing.rows.length === 0) return null;
  if (existing.rows[0].share_token) return existing.rows[0].share_token as string;

  const token = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `UPDATE game_recordings SET share_token = $1, shared_at = NOW() WHERE id = $2 AND user_id = $3`,
    [token, id, userId]
  );
  return token;
}

export async function unshareRecording(id: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE game_recordings SET share_token = NULL, shared_at = NULL WHERE id = $1 AND user_id = $2 AND share_token IS NOT NULL`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function expireOldShares(): Promise<number> {
  const result = await pool.query(
    `UPDATE game_recordings SET share_token = NULL, shared_at = NULL
     WHERE share_token IS NOT NULL AND shared_at < NOW() - INTERVAL '30 days'`
  );
  return result.rowCount ?? 0;
}

export async function getRecordingByToken(token: string): Promise<RecordingRow | null> {
  const recResult = await pool.query(
    `SELECT id, user_id, recorded_at, duration_ms, outcome, score, difficulty, player_count, share_token
     FROM game_recordings WHERE share_token = $1`,
    [token]
  );
  if (recResult.rows.length === 0) return null;
  const rec = recResult.rows[0] as RecordingRow;

  const [playersResult, eventsResult, mouseResult] = await Promise.all([
    pool.query(
      `SELECT id, recording_id, player_id, name, icon, color, score
       FROM recording_players WHERE recording_id = $1`,
      [rec.id]
    ),
    pool.query(
      `SELECT id, recording_id, t, type, data
       FROM recording_events WHERE recording_id = $1 ORDER BY t`,
      [rec.id]
    ),
    pool.query(
      `SELECT id, recording_id, player_id, t, x, y
       FROM recording_mouse_moves WHERE recording_id = $1 ORDER BY t`,
      [rec.id]
    ),
  ]);

  rec.players = playersResult.rows as RecordingPlayerRow[];
  rec.events = eventsResult.rows as RecordingEventRow[];
  rec.mouseMovements = mouseResult.rows as RecordingMouseMoveRow[];

  return rec;
}

export async function getRecordingsCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM game_recordings`);
  return result.rows[0]?.count || 0;
}

export async function getReplayEventsCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM recording_events`);
  return result.rows[0]?.count || 0;
}

export async function getReplayMouseEventsCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM recording_mouse_moves`);
  return result.rows[0]?.count || 0;
}

// Currency queries

export async function getCurrencyBalance(userId: number): Promise<CurrencyBalance> {
  const result = await pool.query(
    `SELECT balance, total_earned FROM user_currency WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { balance: 0, totalEarned: 0 };
  return { balance: result.rows[0].balance as number, totalEarned: result.rows[0].total_earned as number };
}

export async function addCurrency(userId: number, amount: number): Promise<number> {
  const result = await pool.query(`
    INSERT INTO user_currency (user_id, balance, total_earned, updated_at)
    VALUES ($1, $2, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = user_currency.balance + $2,
      total_earned = user_currency.total_earned + $2,
      updated_at = NOW()
    RETURNING balance
  `, [userId, amount]);
  return result.rows[0].balance as number;
}

// Quest queries

export async function getActiveQuests(userId: number): Promise<UserQuestRow[]> {
  const result = await pool.query(
    `SELECT * FROM user_quests WHERE user_id = $1 AND period_end >= CURRENT_DATE ORDER BY quest_type, id`,
    [userId]
  );
  return result.rows as UserQuestRow[];
}

export async function assignQuests(userId: number, quests: { questKey: string; questType: string; target: number; reward: number; periodStart: Date; periodEnd: Date }[]): Promise<UserQuestRow[]> {
  if (quests.length === 0) return [];
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;
  for (const q of quests) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`);
    values.push(userId, q.questKey, q.questType, q.target, q.reward, q.periodStart, q.periodEnd);
    idx += 7;
  }
  const result = await pool.query(
    `INSERT INTO user_quests (user_id, quest_key, quest_type, target, reward, period_start, period_end) VALUES ${placeholders.join(', ')} RETURNING *`,
    values
  );
  return result.rows as UserQuestRow[];
}

export async function updateQuestProgress(questId: number, progress: number, completed: boolean): Promise<void> {
  await pool.query(
    `UPDATE user_quests SET progress = $1, completed = $2 WHERE id = $3`,
    [progress, completed, questId]
  );
}

export async function markQuestClaimed(questId: number): Promise<void> {
  await pool.query(
    `UPDATE user_quests SET claimed = true WHERE id = $1`,
    [questId]
  );
}

export async function cleanupExpiredQuests(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM user_quests WHERE period_end < CURRENT_DATE - INTERVAL '7 days'`
  );
  return result.rowCount ?? 0;
}

// Inventory queries

export async function getUserInventory(userId: number): Promise<InventoryItem[]> {
  const result = await pool.query(
    `SELECT item_id, category, purchased_at FROM user_inventory WHERE user_id = $1 ORDER BY purchased_at`,
    [userId]
  );
  return result.rows as InventoryItem[];
}

export async function userOwnsItem(userId: number, itemId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM user_inventory WHERE user_id = $1 AND item_id = $2`,
    [userId, itemId]
  );
  return result.rows.length > 0;
}

export async function purchaseItem(userId: number, itemId: string, category: string, cost: number): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balResult = await client.query(
      `SELECT balance FROM user_currency WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const balance = balResult.rows.length > 0 ? (balResult.rows[0].balance as number) : 0;
    if (balance < cost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Insufficient balance' };
    }
    // Check not already owned
    const ownCheck = await client.query(
      `SELECT 1 FROM user_inventory WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId]
    );
    if (ownCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Already owned' };
    }
    await client.query(
      `UPDATE user_currency SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
      [cost, userId]
    );
    await client.query(
      `INSERT INTO user_inventory (user_id, item_id, category) VALUES ($1, $2, $3)`,
      [userId, itemId, category]
    );
    const newBalResult = await client.query(
      `SELECT balance FROM user_currency WHERE user_id = $1`,
      [userId]
    );
    await client.query('COMMIT');
    return { success: true, newBalance: newBalResult.rows[0].balance as number };
  } catch {
    await client.query('ROLLBACK');
    return { success: false, error: 'Purchase failed' };
  } finally {
    client.release();
  }
}

export async function getShopSeenRotation(userId: number): Promise<string | null> {
  const result = await pool.query(
    `SELECT shop_seen_rotation FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.shop_seen_rotation ?? null;
}

export async function setShopSeenRotation(userId: number, rotation: string): Promise<void> {
  await pool.query(
    `UPDATE users SET shop_seen_rotation = $1 WHERE id = $2`,
    [rotation, userId]
  );
}

export async function close(): Promise<void> {
  await pool.end();
}
