const path = require('path');

// Load config.json with env var overrides
let fileConfig = {};
try {
  fileConfig = require(path.join(__dirname, '..', 'config.json'));
} catch (e) {
  // config.json is optional; defaults below
}

const SERVER_CONFIG = {
  port: parseInt(process.env.PORT, 10) || (fileConfig.server && fileConfig.server.port) || 3000,
};

const DATABASE_CONFIG = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || (fileConfig.database && fileConfig.database.host) || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || (fileConfig.database && fileConfig.database.port) || 5432,
      database: process.env.DB_NAME || (fileConfig.database && fileConfig.database.database) || 'release_quest',
      user: process.env.DB_USER || (fileConfig.database && fileConfig.database.user) || 'release_quest',
      password: process.env.DB_PASSWORD || (fileConfig.database && fileConfig.database.password) || 'release_quest',
    };

const LOBBY_CONFIG = {
  maxLobbies: parseInt(process.env.MAX_LOBBIES, 10) || (fileConfig.lobby && fileConfig.lobby.maxLobbies) || 10,
  defaultMaxPlayers: parseInt(process.env.DEFAULT_MAX_PLAYERS, 10) || (fileConfig.lobby && fileConfig.lobby.defaultMaxPlayers) || 4,
  maxPlayersLimit: parseInt(process.env.MAX_PLAYERS_LIMIT, 10) || (fileConfig.lobby && fileConfig.lobby.maxPlayersLimit) || 8,
};

const LOGICAL_W = 800;
const LOGICAL_H = 500;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4'];
const ICONS = ['\u{1F431}', '\u{1F436}', '\u{1F430}', '\u{1F98A}', '\u{1F438}', '\u{1F427}', '\u{1F43C}', '\u{1F428}'];
const LEVEL_CONFIG = {
  1: { bugsTotal: 8,  escapeTime: 5000, spawnRate: 2200, maxOnScreen: 2 },
  2: { bugsTotal: 12, escapeTime: 3800, spawnRate: 1600, maxOnScreen: 3 },
  3: { bugsTotal: 16, escapeTime: 2800, spawnRate: 1200, maxOnScreen: 4 },
};
const BOSS_CONFIG = {
  hp: 500,
  clickDamage: 5,
  clickPoints: 5,
  killBonus: 200,
  wanderInterval: 2000,
  enrageThreshold: 0.5,
  enrageWanderInterval: 1200,
  minionSpawnRate: 4000,
  enrageMinionSpawnRate: 2200,
  minionEscapeTime: 3500,
  minionMaxOnScreen: 3,
  enrageMinionMaxOnScreen: 5,
  clickCooldownMs: 100,
  regenPerSecond: 3,
  timeLimit: 120,
  escalation: [
    { timeRemaining: 90, spawnRate: 3200, maxOnScreen: 4 },
    { timeRemaining: 60, spawnRate: 2600, maxOnScreen: 4 },
    { timeRemaining: 30, spawnRate: 2000, maxOnScreen: 5 },
  ],
};
const MAX_LEVEL = 3;
const HP_DAMAGE = 15;
const BUG_POINTS = 10;

const HEISENBUG_CONFIG = {
  chance: 0.15,
  escapeTimeMultiplier: 0.65,
  pointsMultiplier: 3,
  fleeRadius: 100,
  fleeCooldown: 800,
  maxFlees: 4,
};

const CODE_REVIEW_CONFIG = {
  featureChance: 0.12,
  hpPenalty: 10,
  startLevel: 2,
  bossPhaseChance: 0.08,
};

const RUBBER_DUCK_CONFIG = {
  spawnIntervalMin: 20000,
  spawnIntervalMax: 30000,
  despawnTime: 5000,
  buffDuration: 6000,
  pointsMultiplier: 2,
  duckPoints: 25,
  wanderInterval: 1200,
};

const MERGE_CONFLICT_CONFIG = {
  chance: 0.08,
  resolveWindow: 1500,
  bonusPoints: 50,
  doubleDamage: true,
  escapeTimeMultiplier: 1.2,
  minPlayers: 2,
};

const AUTH_CONFIG = {
  saltRounds: 10,
  sessionDurationDays: 30,
  minPasswordLength: 6,
  maxPasswordLength: 64,
  usernameRegex: /^[a-zA-Z0-9_]{3,16}$/,
};

module.exports = {
  SERVER_CONFIG, DATABASE_CONFIG, LOBBY_CONFIG, AUTH_CONFIG,
  LOGICAL_W, LOGICAL_H, COLORS, ICONS, LEVEL_CONFIG, BOSS_CONFIG, MAX_LEVEL, HP_DAMAGE, BUG_POINTS,
  HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, RUBBER_DUCK_CONFIG, MERGE_CONFLICT_CONFIG,
};
