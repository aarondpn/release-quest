const { MAX_LEVEL } = require('./config');
const { state, currentLevelConfig, getPlayerScores } = require('./state');
const network = require('./network');
const bugs = require('./bugs');
const boss = require('./boss');

function startGame() {
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.phase = 'playing';
  state.boss = null;
  boss.clearBossTimers();

  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
  }

  bugs.clearSpawnTimer();
  bugs.clearAllBugs();

  network.broadcast({
    type: 'game-start',
    level: 1,
    hp: 100,
    score: 0,
    players: getPlayerScores(),
  });

  startLevel();
}

function startLevel() {
  const cfg = currentLevelConfig();
  state.bugsRemaining = cfg.bugsTotal;
  state.bugsSpawned = 0;
  state.phase = 'playing';

  network.broadcast({
    type: 'level-start',
    level: state.level,
    bugsTotal: cfg.bugsTotal,
    hp: state.hp,
    score: state.score,
  });

  bugs.startSpawning(cfg.spawnRate);
}

function checkGameState() {
  if (state.phase !== 'playing') return;

  if (state.hp <= 0) {
    state.phase = 'gameover';
    bugs.clearSpawnTimer();
    bugs.clearAllBugs();
    network.broadcast({
      type: 'game-over',
      score: state.score,
      level: state.level,
      players: getPlayerScores(),
    });
    return;
  }

  const cfg = currentLevelConfig();
  const allSpawned = state.bugsSpawned >= cfg.bugsTotal;
  const noneAlive = Object.keys(state.bugs).length === 0;

  if (allSpawned && noneAlive) {
    bugs.clearSpawnTimer();
    if (state.level >= MAX_LEVEL) {
      network.broadcast({
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      setTimeout(() => boss.startBoss(), 2000);
    } else {
      network.broadcast({
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      setTimeout(() => {
        if (state.phase !== 'playing' && state.phase !== 'lobby') {
          if (Object.keys(state.players).length === 0) return;
        }
        state.level++;
        startLevel();
      }, 2000);
    }
  }
}

function checkBossGameState() {
  if (state.phase !== 'boss') return;
  if (state.hp <= 0) {
    state.phase = 'gameover';
    boss.clearBossTimers();
    bugs.clearAllBugs();
    state.boss = null;
    network.broadcast({
      type: 'game-over',
      score: state.score,
      level: state.level,
      players: getPlayerScores(),
    });
  }
}

function resetToLobby() {
  state.phase = 'lobby';
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
  bugs.clearSpawnTimer();
  bugs.clearAllBugs();
  boss.clearBossTimers();
}

module.exports = { startGame, startLevel, checkGameState, checkBossGameState, resetToLobby };
