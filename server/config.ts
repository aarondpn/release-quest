import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DifficultyConfig, CustomDifficultyConfig, CosmeticShopItem } from './types.ts';

export const DEV_MODE = process.env.DEV_MODE === 'true';

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

import { STANDARD_ICONS as ICONS } from '../shared/constants.ts';
export const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4'];
export const PREMIUM_ICON_IDS = ['av:knight', 'av:ninja', 'av:mage'];


export const COSMETIC_SHOP_CATALOG: CosmeticShopItem[] = [
  { id: 'shop:robot', name: 'Pixel Robot', category: 'avatar', price: 100, description: 'A friendly 8-bit robot companion', rarity: 'common' },
  { id: 'shop:alien', name: 'Neon Alien', category: 'avatar', price: 100, description: 'Visitor from a neon galaxy', rarity: 'common' },
  { id: 'shop:witch', name: 'Glitch Witch', category: 'avatar', price: 150, description: 'Casts spells in binary', rarity: 'common' },
  { id: 'shop:pirate', name: 'Data Pirate', category: 'avatar', price: 150, description: 'Plunders data on the high seas', rarity: 'common' },
  { id: 'shop:cyborg', name: 'Neon Cyborg', category: 'avatar', price: 250, description: 'Half human, half machine', rarity: 'rare' },
  { id: 'shop:phoenix_bird', name: 'Pixel Phoenix', category: 'avatar', price: 250, description: 'Rises from the ashes of failed builds', rarity: 'rare' },
  { id: 'shop:samurai', name: 'Neon Samurai', category: 'avatar', price: 300, description: 'Slices through spaghetti code', rarity: 'rare' },
  { id: 'shop:astronaut', name: 'Space Dev', category: 'avatar', price: 250, description: 'Debugging in zero gravity', rarity: 'rare' },
  { id: 'shop:vampire', name: 'Byte Vampire', category: 'avatar', price: 250, description: 'Drains memory at midnight', rarity: 'rare' },
  { id: 'shop:reaper', name: 'Code Reaper', category: 'avatar', price: 400, description: 'Harvests deprecated functions', rarity: 'epic' },
  { id: 'shop:dragon', name: 'Bit Dragon', category: 'avatar', price: 450, description: 'Breathes fire on tech debt', rarity: 'epic' },
  { id: 'shop:demon', name: 'Core Dump Demon', category: 'avatar', price: 400, description: 'Rises from crashed processes', rarity: 'epic' },
  { id: 'shop:angel', name: 'Refactor Angel', category: 'avatar', price: 400, description: 'Blesses code with clean patterns', rarity: 'epic' },
  { id: 'shop:kraken', name: 'Dependency Kraken', category: 'avatar', price: 500, description: 'Lurks deep in node_modules', rarity: 'epic' },
  { id: 'shop:phoenix_gold', name: 'Golden Phoenix', category: 'avatar', price: 750, description: 'Reborn from ashes of production', rarity: 'epic' },
];

export const COSMETIC_SHOP_MAP = new Map(COSMETIC_SHOP_CATALOG.map(item => [item.id, item]));
export const SHOP_ICON_IDS = COSMETIC_SHOP_CATALOG.map(item => item.id);
export const ALL_ICONS = [...ICONS, ...PREMIUM_ICON_IDS, ...SHOP_ICON_IDS];

const ROTATION_SIZE = 4;

export function getWeekBoundaries(): { weekStart: Date; weekEnd: Date; weekNumber: number } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  // Week number: weeks since epoch Monday (Jan 5 1970)
  const epochMonday = Date.UTC(1970, 0, 5);
  const weekNumber = Math.floor((weekStart.getTime() - epochMonday) / (7 * 24 * 60 * 60 * 1000));
  return { weekStart, weekEnd, weekNumber };
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _cachedRotation: { items: CosmeticShopItem[]; rotationEndUtc: string } | null = null;
let _cachedRotationWeek = -1;

export function getWeeklyRotation(): { items: CosmeticShopItem[]; rotationEndUtc: string } {
  const { weekEnd, weekNumber } = getWeekBoundaries();
  if (_cachedRotation && _cachedRotationWeek === weekNumber) return _cachedRotation;
  const rng = mulberry32(weekNumber);
  // Fisher-Yates shuffle on the full catalog
  const pool = [...COSMETIC_SHOP_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  _cachedRotation = { items: pool.slice(0, ROTATION_SIZE), rotationEndUtc: weekEnd.toISOString() };
  _cachedRotationWeek = weekNumber;
  return _cachedRotation;
}

export const REST_CONFIG = {
  hpGain: 30,
  trainScoreBonus: 0.1,
};

export const ELITE_CONFIG = {
  maxPerMap: 2,
  scoreMultiplier: 2.5,
  hpDamageMultiplier: 1.5,
  types: {
    'super-heisenbug': {
      title: 'Super-Heisenbug',
      icon: '\u{1F47B}',
      description: 'A massive Heisenbug with 5 flees and 30% faster escape',
      scoreMultiplier: 5,
      hpDamageMultiplier: 1.5,
      wavesTotal: 1,
    },
    'mega-pipeline': {
      title: 'Mega-Pipeline',
      icon: '\u{1F6A7}',
      description: 'An 8-segment pipeline that resets on wrong clicks',
      scoreMultiplier: 3,
      hpDamageMultiplier: 1.5,
      wavesTotal: 1,
    },
    'memory-leak-cluster': {
      title: 'Memory Leak Cluster',
      icon: '\u{1F4A7}',
      description: '3 simultaneous memory leaks with accelerating growth',
      scoreMultiplier: 3,
      hpDamageMultiplier: 2,
      wavesTotal: 1,
    },
    'merge-conflict-chain': {
      title: 'Merge Conflict Chain',
      icon: '\u{1F500}',
      description: '3 waves of merge conflicts with shrinking resolve windows',
      scoreMultiplier: 3,
      hpDamageMultiplier: 1.5,
      wavesTotal: 3,
    },
  } as Record<string, { title: string; icon: string; description: string; scoreMultiplier: number; hpDamageMultiplier: number; wavesTotal: number }>,
};

export const MINI_BOSS_CONFIG = {
  maxPerMap: 1,
  defeatHpPenalty: 20,
};

export const ROGUELIKE_CONFIG = {
  mapRows: 5,
  voteTimerMs: 15000,
  rowScaling: {
    1: { bugsTotal: 7,  escapeTime: 5500, spawnRate: 2300, maxOnScreen: 2 },
    2: { bugsTotal: 10, escapeTime: 4500, spawnRate: 1900, maxOnScreen: 3 },
    3: { bugsTotal: 11, escapeTime: 4000, spawnRate: 1700, maxOnScreen: 3 },
    4: { bugsTotal: 14, escapeTime: 3400, spawnRate: 1500, maxOnScreen: 4 },
    5: { bugsTotal: 16, escapeTime: 3000, spawnRate: 1400, maxOnScreen: 4 },
  } as Record<number, { bugsTotal: number; escapeTime: number; spawnRate: number; maxOnScreen: number }>,
};

// Difficulty presets
export const DIFFICULTY_PRESETS: Record<string, DifficultyConfig> = {
  easy: {
    startingHp: 150,
    hpDamage: 10,
    bugPoints: 10,
    scoreMultiplier: 0.5,
    levels: {
      1: { bugsTotal: 6, escapeTime: 6000, spawnRate: 2500, maxOnScreen: 2 },
      2: { bugsTotal: 10, escapeTime: 5000, spawnRate: 2000, maxOnScreen: 2 },
      3: { bugsTotal: 14, escapeTime: 4000, spawnRate: 1800, maxOnScreen: 3 },
    },
    boss: {
      hp: 400,
      clickDamage: 5,
      clickPoints: 5,
      killBonus: 200,
      wanderInterval: 2500,
      minionSpawnRate: 5000,
      minionEscapeTime: 4500,
      minionMaxOnScreen: 2,
      clickCooldownMs: 100,
      regenPerSecond: 1.5,
      timeLimit: 150,
      escalation: [
        { timeRemaining: 100, spawnRate: 4000, maxOnScreen: 3 },
        { timeRemaining: 60, spawnRate: 3200, maxOnScreen: 3 },
        { timeRemaining: 30, spawnRate: 2500, maxOnScreen: 4 },
      ],
      bossPhases: {
        phase2Threshold: 0.5,
        phase3Threshold: 0.2,
        shieldDuration: 3500,
        shieldInterval: 6000,
        phase2WanderInterval: 1800,
        phase2SpawnRateMultiplier: 1.5,
        phase3SpawnRateMultiplier: 2.5,
        phase3MaxOnScreenMultiplier: 2,
        screenWipeInterval: 10000,
        screenWipeBugCount: 4,
        transitionInvulnTime: 1500,
        phase3TimeReduction: 0.15,
        phase3SizeMultiplier: 0.65,
        phase3DamageReductionPerMinion: 0.15,
        phase3MaxDamageReduction: 0.75,
      },
    },
    shop: {
      duration: 20000,
      items: [],
    },
    specialBugs: {
      heisenbugChance: 0.10,
      codeReviewChance: 0.08,
      codeReviewStartLevel: 2,
      mergeConflictChance: 0.05,
      pipelineBugChance: 0.08,
      pipelineBugStartLevel: 2,
      memoryLeakChance: 0.08,
      infiniteLoopChance: 0.06,
      infiniteLoopStartLevel: 2,
      azubiChance: 0.05,
      azubiStartLevel: 2,
      azubiSpawnInterval: 3000,
      azubiFeatureChance: 0.30,
    },
    powerups: {
      rubberDuckIntervalMin: 18000,
      rubberDuckIntervalMax: 28000,
      rubberDuckBuffDuration: 7000,
      rubberDuckWanderInterval: 1200,
      rubberDuckDespawnTime: 5000,
      rubberDuckPoints: 25,
      rubberDuckPointsMultiplier: 2,
      hotfixHammerIntervalMin: 22000,
      hotfixHammerIntervalMax: 38000,
      hotfixHammerStunDuration: 2500,
      hotfixHammerDespawnTime: 8000,
      hotfixHammerPoints: 15,
    },
  },
  medium: {
    startingHp: 100,
    hpDamage: 15,
    bugPoints: 10,
    scoreMultiplier: 1,
    levels: {
      1: { bugsTotal: 8, escapeTime: 5000, spawnRate: 2200, maxOnScreen: 2 },
      2: { bugsTotal: 12, escapeTime: 3800, spawnRate: 1600, maxOnScreen: 3 },
      3: { bugsTotal: 16, escapeTime: 3200, spawnRate: 1500, maxOnScreen: 4 },
    },
    boss: {
      hp: 500,
      clickDamage: 5,
      clickPoints: 5,
      killBonus: 200,
      wanderInterval: 2000,
      minionSpawnRate: 4000,
      minionEscapeTime: 3500,
      minionMaxOnScreen: 3,
      clickCooldownMs: 100,
      regenPerSecond: 2,
      timeLimit: 120,
      escalation: [
        { timeRemaining: 90, spawnRate: 3200, maxOnScreen: 4 },
        { timeRemaining: 60, spawnRate: 2600, maxOnScreen: 4 },
        { timeRemaining: 30, spawnRate: 2000, maxOnScreen: 5 },
      ],
      bossPhases: {
        phase2Threshold: 0.6,
        phase3Threshold: 0.25,
        shieldDuration: 3000,
        shieldInterval: 5000,
        phase2WanderInterval: 1500,
        phase2SpawnRateMultiplier: 1.8,
        phase3SpawnRateMultiplier: 3,
        phase3MaxOnScreenMultiplier: 2,
        screenWipeInterval: 8000,
        screenWipeBugCount: 5,
        transitionInvulnTime: 1500,
        phase3TimeReduction: 0.2,
        phase3SizeMultiplier: 0.65,
        phase3DamageReductionPerMinion: 0.18,
        phase3MaxDamageReduction: 0.80,
      },
    },
    shop: {
      duration: 15000,
      items: [],
    },
    specialBugs: {
      heisenbugChance: 0.15,
      codeReviewChance: 0.12,
      codeReviewStartLevel: 2,
      mergeConflictChance: 0.08,
      pipelineBugChance: 0.10,
      pipelineBugStartLevel: 2,
      memoryLeakChance: 0.12,
      infiniteLoopChance: 0.10,
      infiniteLoopStartLevel: 2,
      azubiChance: 0.08,
      azubiStartLevel: 2,
      azubiSpawnInterval: 2500,
      azubiFeatureChance: 0.50,
    },
    powerups: {
      rubberDuckIntervalMin: 20000,
      rubberDuckIntervalMax: 30000,
      rubberDuckBuffDuration: 6000,
      rubberDuckWanderInterval: 1200,
      rubberDuckDespawnTime: 5000,
      rubberDuckPoints: 25,
      rubberDuckPointsMultiplier: 2,
      hotfixHammerIntervalMin: 25000,
      hotfixHammerIntervalMax: 40000,
      hotfixHammerStunDuration: 2000,
      hotfixHammerDespawnTime: 8000,
      hotfixHammerPoints: 15,
    },
  },
  hard: {
    startingHp: 75,
    hpDamage: 20,
    bugPoints: 15,
    scoreMultiplier: 1.5,
    levels: {
      1: { bugsTotal: 10, escapeTime: 4000, spawnRate: 1800, maxOnScreen: 3 },
      2: { bugsTotal: 15, escapeTime: 3000, spawnRate: 1200, maxOnScreen: 4 },
      3: { bugsTotal: 20, escapeTime: 2500, spawnRate: 1000, maxOnScreen: 5 },
    },
    boss: {
      hp: 600,
      clickDamage: 5,
      clickPoints: 5,
      killBonus: 300,
      wanderInterval: 1500,
      minionSpawnRate: 3000,
      minionEscapeTime: 2800,
      minionMaxOnScreen: 4,
      clickCooldownMs: 100,
      regenPerSecond: 3,
      timeLimit: 100,
      escalation: [
        { timeRemaining: 75, spawnRate: 2400, maxOnScreen: 5 },
        { timeRemaining: 50, spawnRate: 1800, maxOnScreen: 5 },
        { timeRemaining: 25, spawnRate: 1400, maxOnScreen: 6 },
      ],
      bossPhases: {
        phase2Threshold: 0.65,
        phase3Threshold: 0.3,
        shieldDuration: 2500,
        shieldInterval: 4000,
        phase2WanderInterval: 1200,
        phase2SpawnRateMultiplier: 2,
        phase3SpawnRateMultiplier: 3.5,
        phase3MaxOnScreenMultiplier: 2,
        screenWipeInterval: 6000,
        screenWipeBugCount: 6,
        transitionInvulnTime: 1500,
        phase3TimeReduction: 0.25,
        phase3SizeMultiplier: 0.65,
        phase3DamageReductionPerMinion: 0.20,
        phase3MaxDamageReduction: 0.85,
      },
    },
    shop: {
      duration: 12000,
      items: [],
    },
    specialBugs: {
      heisenbugChance: 0.20,
      codeReviewChance: 0.15,
      codeReviewStartLevel: 1,
      mergeConflictChance: 0.12,
      pipelineBugChance: 0.15,
      pipelineBugStartLevel: 1,
      memoryLeakChance: 0.15,
      infiniteLoopChance: 0.12,
      infiniteLoopStartLevel: 2,
      azubiChance: 0.10,
      azubiStartLevel: 2,
      azubiSpawnInterval: 1800,
      azubiFeatureChance: 0.65,
    },
    powerups: {
      rubberDuckIntervalMin: 25000,
      rubberDuckIntervalMax: 35000,
      rubberDuckBuffDuration: 5000,
      rubberDuckWanderInterval: 1200,
      rubberDuckDespawnTime: 5000,
      rubberDuckPoints: 25,
      rubberDuckPointsMultiplier: 2,
      hotfixHammerIntervalMin: 30000,
      hotfixHammerIntervalMax: 45000,
      hotfixHammerStunDuration: 1500,
      hotfixHammerDespawnTime: 8000,
      hotfixHammerPoints: 15,
    },
  },
};

function deepMerge<T>(target: T, source: any): T {
  if (!source) return target;
  
  const output = { ...target } as any;
  
  for (const key in source) {
    if (!Object.hasOwn(source, key)) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
        output[key] = deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  
  return output as T;
}

export function getDifficultyConfig(difficulty: string = 'medium', customConfig?: CustomDifficultyConfig): DifficultyConfig {
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;
  return deepMerge(preset, customConfig || {});
}

// Game structure constants
export const MAX_LEVEL = 3;

export const GUEST_NAMES = [
  'StackOverflower',
  'NullPointer',
  'Git Pusher',
  'Bug Whisperer',
  'Segfault Sam',
  'Lint Roller',
  'Cache Money',
  'Sudo Steve',
  'Merge Conflict',
  'Hotfix Hero',
  'Debug Duck',
  'Heap Dumper',
  'Byte Me',
  'Fork Bomb',
  'Patch Adams',
  'Race Condition',
  'Code Monkey',
  'Refactor Rex',
  'Linter Lint',
  'Kernel Panic',
  'Dangling Ptr',
  'Tab Fighter',
  'Type Coercer',
  'Scope Creep',
  'Dead Code',
  'Off By One',
  'Rubber Ducker',
  'Ship It Shelly',
  '404 Not Found',
  'Infinite Looper',
  'Spaghetti Dev',
  'Chmod 777',
  'Try Catcher',
  'Npm Install',
  'Pixel Pusher',
  'Async Awaiter',
  'Localhost',
  'Syntax Terror',
  'Div Destroyer',
  'Sudo Rm Star',
  'Bit Flipper',
  'Stack Smasher',
  'Yolo Deployer',
  'PR Reviewer',
  'Regex Wizard',
  'Vim Escapee',
  'Docker Whale',
  'Agile Ninja',
  'Legacy Larry',
  'Breakpoint Bob',
  'Console Logger',
  'Callback Hell',
  'Lazy Loader',
  'Garbage Colctr',
  'Strict Mode',
  'Dark Mode Dan',
  'Crypto Hasher',
  'Event Bubbler',
  'Prop Driller',
  'Changelog Chad',
  'Jenkins Joker',
  'Ping Pong Pro',
  'Tombstone Dev',
  'Feature Flag',
  'Schema Shifter',
  'Throttle This',
  'Shard Shark',
  'Cron Job Carl',
  'Buffer Bandit',
  'Packet Pirate',
  'Root Access',
  'Ctrl+Z Hero',
  'Backlog Beast',
  'Monolith Mike',
  'Lambda Larry',
  'Tensor Tina',
  'Repo Rebel',
  'Upstream Uma',
];

export const AUTH_CONFIG = {
  saltRounds: 10,
  sessionDurationDays: 30,
  minPasswordLength: 6,
  maxPasswordLength: 64,
  usernameRegex: /^[a-zA-Z0-9_]{3,16}$/,
};

