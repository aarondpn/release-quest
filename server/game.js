const { MAX_LEVEL } = require('./config');
const { currentLevelConfig, getPlayerScores } = require('./state');
const network = require('./network');
const bugs = require('./bugs');
const boss = require('./boss');
const powerups = require('./powerups');
const stats = require('./stats');

function startGame(ctx) {
  const { lobbyId, state } = ctx;
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.phase = 'playing';
  state.boss = null;
  boss.clearBossTimers(ctx);
  powerups.clearDuck(ctx);

  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
    state.players[pid].bugsSquashed = 0;
  }

  bugs.clearSpawnTimer(ctx);
  bugs.clearAllBugs(ctx);

  network.broadcastToLobby(lobbyId, {
    type: 'game-start',
    level: 1,
    hp: 100,
    score: 0,
    players: getPlayerScores(state),
  });

  startLevel(ctx);

  // Start duck spawning globally (works across levels)
  powerups.startDuckSpawning(ctx);
}

function startLevel(ctx) {
  const { lobbyId, state } = ctx;
  const cfg = currentLevelConfig(state);
  state.bugsRemaining = cfg.bugsTotal;
  state.bugsSpawned = 0;
  state.phase = 'playing';

  network.broadcastToLobby(lobbyId, {
    type: 'level-start',
    level: state.level,
    bugsTotal: cfg.bugsTotal,
    hp: state.hp,
    score: state.score,
  });

  bugs.startSpawning(ctx, cfg.spawnRate);
}

function checkGameState(ctx) {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'playing') return;

  if (state.hp <= 0) {
    state.phase = 'gameover';
    bugs.clearSpawnTimer(ctx);
    bugs.clearAllBugs(ctx);
    powerups.clearDuck(ctx);
    network.broadcastToLobby(lobbyId, {
      type: 'game-over',
      score: state.score,
      level: state.level,
      players: getPlayerScores(state),
    });
    if (ctx.playerInfo) stats.recordGameEnd(state, ctx.playerInfo, false);
    return;
  }

  const cfg = currentLevelConfig(state);
  const allSpawned = state.bugsSpawned >= cfg.bugsTotal;
  const noneAlive = Object.keys(state.bugs).length === 0;

  if (allSpawned && noneAlive) {
    bugs.clearSpawnTimer(ctx);
    if (state.level >= MAX_LEVEL) {
      network.broadcastToLobby(lobbyId, {
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      setTimeout(() => boss.startBoss(ctx), 2000);
    } else {
      network.broadcastToLobby(lobbyId, {
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      setTimeout(() => {
        if (state.phase !== 'playing' && state.phase !== 'lobby') {
          if (Object.keys(state.players).length === 0) return;
        }
        state.level++;
        startLevel(ctx);
      }, 2000);
    }
  }
}

function checkBossGameState(ctx) {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'boss') return;
  if (state.hp <= 0) {
    state.phase = 'gameover';
    boss.clearBossTimers(ctx);
    bugs.clearAllBugs(ctx);
    powerups.clearDuck(ctx);
    state.boss = null;
    network.broadcastToLobby(lobbyId, {
      type: 'game-over',
      score: state.score,
      level: state.level,
      players: getPlayerScores(state),
    });
    if (ctx.playerInfo) stats.recordGameEnd(state, ctx.playerInfo, false);
  }
}

function resetToLobby(ctx) {
  const { state } = ctx;
  state.phase = 'lobby';
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
  bugs.clearSpawnTimer(ctx);
  bugs.clearAllBugs(ctx);
  boss.clearBossTimers(ctx);
  powerups.clearDuck(ctx);
}

module.exports = { startGame, startLevel, checkGameState, checkBossGameState, resetToLobby };
