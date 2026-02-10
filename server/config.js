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

module.exports = { LOGICAL_W, LOGICAL_H, COLORS, ICONS, LEVEL_CONFIG, BOSS_CONFIG, MAX_LEVEL, HP_DAMAGE, BUG_POINTS };
