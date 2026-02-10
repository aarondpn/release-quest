const { HP_DAMAGE, BOSS_CONFIG } = require('./config');
const { state, counters, randomPosition, currentLevelConfig } = require('./state');
const network = require('./network');

let spawnTimer = null;

function spawnEntity({ phaseCheck, maxOnScreen, escapeTime, isMinion, onEscapeCheck }) {
  if (state.phase !== phaseCheck) return;
  if (Object.keys(state.bugs).length >= maxOnScreen) return;

  const id = 'bug_' + (counters.nextBugId++);
  const pos = randomPosition();
  const bug = { id, x: pos.x, y: pos.y, escapeTimer: null, wanderInterval: null };
  if (isMinion) bug.isMinion = true;

  state.bugs[id] = bug;

  network.broadcast({
    type: 'bug-spawned',
    bug: { id, x: bug.x, y: bug.y, ...(isMinion ? { isMinion: true } : {}) },
  });

  bug.wanderInterval = setInterval(() => {
    if (state.phase !== phaseCheck || !state.bugs[id]) return;
    const newPos = randomPosition();
    bug.x = newPos.x;
    bug.y = newPos.y;
    network.broadcast({ type: 'bug-wander', bugId: id, x: newPos.x, y: newPos.y });
  }, escapeTime * 0.45);

  bug.escapeTimer = setTimeout(() => {
    if (!state.bugs[id]) return;
    clearInterval(bug.wanderInterval);
    delete state.bugs[id];

    state.hp -= HP_DAMAGE;
    if (state.hp < 0) state.hp = 0;

    network.broadcast({ type: 'bug-escaped', bugId: id, hp: state.hp });

    onEscapeCheck();
  }, escapeTime);
}

function spawnBug() {
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig();
  if (state.bugsSpawned >= cfg.bugsTotal) return;
  state.bugsSpawned++;

  const game = require('./game');
  spawnEntity({
    phaseCheck: 'playing',
    maxOnScreen: cfg.maxOnScreen,
    escapeTime: cfg.escapeTime,
    isMinion: false,
    onEscapeCheck: () => game.checkGameState(),
  });
}

function spawnMinion() {
  if (state.phase !== 'boss') return;
  const boss = require('./boss');
  const game = require('./game');
  const maxOnScreen = boss.getEffectiveMaxOnScreen();

  spawnEntity({
    phaseCheck: 'boss',
    maxOnScreen,
    escapeTime: BOSS_CONFIG.minionEscapeTime,
    isMinion: true,
    onEscapeCheck: () => game.checkBossGameState(),
  });
}

function clearAllBugs() {
  for (const id of Object.keys(state.bugs)) {
    const bug = state.bugs[id];
    clearTimeout(bug.escapeTimer);
    clearInterval(bug.wanderInterval);
  }
  state.bugs = {};
}

function clearSpawnTimer() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }
}

function startSpawning(rate) {
  spawnTimer = setInterval(spawnBug, rate);
  spawnBug();
}

module.exports = { spawnBug, spawnMinion, clearAllBugs, clearSpawnTimer, startSpawning };
