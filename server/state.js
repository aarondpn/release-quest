const { LOGICAL_W, LOGICAL_H, LEVEL_CONFIG, MAX_LEVEL } = require('./config');

function createGameState() {
  return {
    phase: 'lobby',
    score: 0,
    hp: 100,
    level: 1,
    bugsRemaining: 0,
    bugsSpawned: 0,
    bugs: {},
    players: {},
    boss: null,
    rubberDuck: null,
    duckBuff: null,
    hotfixHammer: null,
    hammerStunActive: false,
    dependencyChains: {},
  };
}

function createCounters() {
  return {
    nextBugId: 1,
    nextPlayerId: 1,
    colorIndex: 0,
    nextDuckId: 1,
    nextConflictId: 1,
    nextChainId: 1,
    nextHammerId: 1,
  };
}

function randomPosition() {
  const pad = 40;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

function currentLevelConfig(state) {
  const base = LEVEL_CONFIG[state.level] || LEVEL_CONFIG[MAX_LEVEL];
  const extra = Math.max(0, Object.keys(state.players).length - 1);
  if (extra === 0) return base;
  return {
    bugsTotal: base.bugsTotal + extra * 3,
    escapeTime: base.escapeTime,
    spawnRate: Math.max(800, base.spawnRate - extra * 50),
    maxOnScreen: base.maxOnScreen,
  };
}

function getPlayerScores(state) {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    score: p.score,
  }));
}

function getStateSnapshot(state) {
  return {
    phase: state.phase,
    score: state.score,
    hp: state.hp,
    level: state.level,
    bugsRemaining: currentLevelConfig(state).bugsTotal - state.bugsSpawned + Object.keys(state.bugs).length,
    bugs: Object.values(state.bugs).map(b => ({
      id: b.id, x: b.x, y: b.y,
      ...(b.isHeisenbug ? { isHeisenbug: true, fleesRemaining: b.fleesRemaining } : {}),
      ...(b.isFeature ? { isFeature: true } : {}),
      ...(b.mergeConflict ? { mergeConflict: b.mergeConflict, mergePartner: b.mergePartner, mergeSide: b.mergeSide } : {}),
      ...(b.isDependency ? { isDependency: true, chainId: b.chainId, chainIndex: b.chainIndex, chainLength: b.chainLength } : {}),
    })),
    rubberDuck: state.rubberDuck ? { id: state.rubberDuck.id, x: state.rubberDuck.x, y: state.rubberDuck.y } : null,
    duckBuff: state.duckBuff ? { expiresAt: state.duckBuff.expiresAt } : null,
    hotfixHammer: state.hotfixHammer ? { id: state.hotfixHammer.id, x: state.hotfixHammer.x, y: state.hotfixHammer.y } : null,
    players: getPlayerScores(state),
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

module.exports = { createGameState, createCounters, randomPosition, currentLevelConfig, getPlayerScores, getStateSnapshot };
