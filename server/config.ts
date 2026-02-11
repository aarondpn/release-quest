import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LevelConfigEntry, EscalationEntry } from './types.ts';

interface FileConfig {
  server?: { port?: number };
  database?: { host?: string; port?: number; database?: string; user?: string; password?: string };
  lobby?: { maxLobbies?: number; defaultMaxPlayers?: number; maxPlayersLimit?: number };
}

let fileConfig: FileConfig = {};
try {
  fileConfig = JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'config.json'), 'utf-8')) as FileConfig;
} catch {
  // config.json is optional; defaults below
}

export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT ?? '', 10) || fileConfig.server?.port || 3000,
};

export const DATABASE_CONFIG = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || fileConfig.database?.host || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '', 10) || fileConfig.database?.port || 5432,
      database: process.env.DB_NAME || fileConfig.database?.database || 'release_quest',
      user: process.env.DB_USER || fileConfig.database?.user || 'release_quest',
      password: process.env.DB_PASSWORD || fileConfig.database?.password || 'release_quest',
    };

export const LOBBY_CONFIG = {
  maxLobbies: parseInt(process.env.MAX_LOBBIES ?? '', 10) || fileConfig.lobby?.maxLobbies || 10,
  defaultMaxPlayers: parseInt(process.env.DEFAULT_MAX_PLAYERS ?? '', 10) || fileConfig.lobby?.defaultMaxPlayers || 4,
  maxPlayersLimit: parseInt(process.env.MAX_PLAYERS_LIMIT ?? '', 10) || fileConfig.lobby?.maxPlayersLimit || 8,
};

export const LOGICAL_W = 800;
export const LOGICAL_H = 500;
export const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4'];
export const ICONS = ['\u{1F431}', '\u{1F436}', '\u{1F430}', '\u{1F98A}', '\u{1F438}', '\u{1F427}', '\u{1F43C}', '\u{1F428}'];

export const LEVEL_CONFIG: Record<number, LevelConfigEntry> = {
  1: { bugsTotal: 8,  escapeTime: 5000, spawnRate: 2200, maxOnScreen: 2 },
  2: { bugsTotal: 12, escapeTime: 3800, spawnRate: 1600, maxOnScreen: 3 },
  3: { bugsTotal: 16, escapeTime: 3200, spawnRate: 1500, maxOnScreen: 4 },
};

export const BOSS_CONFIG: {
  hp: number; clickDamage: number; clickPoints: number; killBonus: number;
  wanderInterval: number; enrageThreshold: number; enrageWanderInterval: number;
  minionSpawnRate: number; enrageMinionSpawnRate: number; minionEscapeTime: number;
  minionMaxOnScreen: number; enrageMinionMaxOnScreen: number; clickCooldownMs: number;
  regenPerSecond: number; timeLimit: number; escalation: EscalationEntry[];
} = {
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
  regenPerSecond: 2,
  timeLimit: 120,
  escalation: [
    { timeRemaining: 90, spawnRate: 3200, maxOnScreen: 4 },
    { timeRemaining: 60, spawnRate: 2600, maxOnScreen: 4 },
    { timeRemaining: 30, spawnRate: 2000, maxOnScreen: 5 },
  ],
};

export const MAX_LEVEL = 3;
export const HP_DAMAGE = 15;
export const BUG_POINTS = 10;

export const HEISENBUG_CONFIG = {
  chance: 0.15,
  escapeTimeMultiplier: 0.85,
  pointsMultiplier: 3,
  fleeRadius: 100,
  fleeCooldown: 800,
  maxFlees: 2,
};

export const CODE_REVIEW_CONFIG = {
  featureChance: 0.12,
  hpPenalty: 10,
  startLevel: 2,
  bossPhaseChance: 0.08,
};

export const RUBBER_DUCK_CONFIG = {
  spawnIntervalMin: 20000,
  spawnIntervalMax: 30000,
  despawnTime: 5000,
  buffDuration: 6000,
  pointsMultiplier: 2,
  duckPoints: 25,
  wanderInterval: 1200,
};

export const MERGE_CONFLICT_CONFIG = {
  chance: 0.08,
  resolveWindow: 1500,
  bonusPoints: 50,
  doubleDamage: true,
  escapeTimeMultiplier: 1.2,
  minPlayers: 2,
};

export const PIPELINE_BUG_CONFIG = {
  chance: 0.10,
  startLevel: 2,
  minChainLength: 3,
  maxChainLength: 5,
  escapeTimeMultiplier: 2.0,
  pointsPerBug: 15,
  chainBonus: 40,
};

export const HOTFIX_HAMMER_CONFIG = {
  spawnIntervalMin: 25000,
  spawnIntervalMax: 40000,
  despawnTime: 8000,
  stunDuration: 2000,
  hammerPoints: 15,
};

export const MEMORY_LEAK_CONFIG = {
  chance: 0.12,
  growthInterval: 500,
  maxGrowthStage: 3,
  damageByStage: [5, 10, 15, 20],
  pointsByStage: [10, 15, 20, 25],
  escapeTimeMultiplier: 1.3,
  holdTimeByStage: [400, 600, 800, 1000],
};

export const AUTH_CONFIG = {
  saltRounds: 10,
  sessionDurationDays: 30,
  minPasswordLength: 6,
  maxPasswordLength: 64,
  usernameRegex: /^[a-zA-Z0-9_]{3,16}$/,
};
