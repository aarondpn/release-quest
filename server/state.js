const { LOGICAL_W, LOGICAL_H, LEVEL_CONFIG, MAX_LEVEL } = require('./config');

const state = {
  phase: 'lobby',
  score: 0,
  hp: 100,
  level: 1,
  bugsRemaining: 0,
  bugsSpawned: 0,
  bugs: {},
  players: {},
  boss: null,
};

const counters = {
  nextBugId: 1,
  nextPlayerId: 1,
  colorIndex: 0,
};

function randomPosition() {
  const pad = 40;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

function currentLevelConfig() {
  const base = LEVEL_CONFIG[state.level] || LEVEL_CONFIG[MAX_LEVEL];
  const extra = Math.max(0, Object.keys(state.players).length - 1);
  if (extra === 0) return base;
  return {
    bugsTotal: base.bugsTotal + extra * 4,
    escapeTime: base.escapeTime,
    spawnRate: Math.max(800, base.spawnRate - extra * 150),
    maxOnScreen: base.maxOnScreen + 1 + Math.floor(extra / 2),
  };
}

function getPlayerScores() {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    score: p.score,
  }));
}

function getStateSnapshot() {
  return {
    phase: state.phase,
    score: state.score,
    hp: state.hp,
    level: state.level,
    bugsRemaining: currentLevelConfig().bugsTotal - state.bugsSpawned + Object.keys(state.bugs).length,
    bugs: Object.values(state.bugs).map(b => ({ id: b.id, x: b.x, y: b.y })),
    players: getPlayerScores(),
    boss: state.boss ? {
      hp: state.boss.hp,
      maxHp: state.boss.maxHp,
      x: state.boss.x,
      y: state.boss.y,
      enraged: state.boss.enraged,
      timeRemaining: state.boss.timeRemaining,
    } : null,
  };
}

module.exports = { state, counters, randomPosition, currentLevelConfig, getPlayerScores, getStateSnapshot };
