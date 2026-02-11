import { MAX_LEVEL } from './config.ts';
import { currentLevelConfig, getPlayerScores } from './state.ts';
import * as network from './network.ts';
import * as bugs from './bugs.ts';
import * as boss from './boss.ts';
import * as powerups from './powerups.ts';
import * as stats from './stats.ts';
import { createMatchLog } from './match-logger.ts';
import type { GameContext } from './types.ts';

function teardownGame(ctx: GameContext): void {
  bugs.clearSpawnTimer(ctx);
  bugs.clearAllBugs(ctx);
  boss.clearBossTimers(ctx);
  powerups.clearDuck(ctx);
  powerups.clearHammer(ctx);
  if (ctx.matchLog) { ctx.matchLog.close(); ctx.matchLog = null; }
}

export function endGame(ctx: GameContext, outcome: string, win: boolean): void {
  const { lobbyId, state } = ctx;
  if (ctx.matchLog) {
    ctx.matchLog.log('game-end', {
      outcome,
      score: state.score,
      level: state.level,
      duration: Date.now() - (state.gameStartedAt || 0),
    });
  }
  state.phase = win ? 'win' : 'gameover';
  teardownGame(ctx);
  state.boss = null;
  network.broadcastToLobby(lobbyId, {
    type: win ? 'boss-defeated' : 'game-over',
    score: state.score,
    level: state.level,
    players: getPlayerScores(state),
  });
  if (ctx.playerInfo) stats.recordGameEnd(state, ctx.playerInfo, win);
}

export function startGame(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  teardownGame(ctx);

  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.phase = 'playing';
  state.boss = null;
  state.gameStartedAt = Date.now();

  ctx.matchLog = createMatchLog(lobbyId);

  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
    state.players[pid].bugsSquashed = 0;
  }

  ctx.matchLog.log('game-start', {
    lobby: lobbyId,
    players: Object.keys(state.players).length,
  });

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
  powerups.startHammerSpawning(ctx);
}

function startLevel(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  const cfg = currentLevelConfig(state);
  state.bugsRemaining = cfg.bugsTotal;
  state.bugsSpawned = 0;
  state.phase = 'playing';

  if (ctx.matchLog) {
    ctx.matchLog.log('level-start', {
      level: state.level,
      bugsTotal: cfg.bugsTotal,
      spawnRate: cfg.spawnRate,
      maxOnScreen: cfg.maxOnScreen,
      escapeTime: cfg.escapeTime,
    });
  }

  network.broadcastToLobby(lobbyId, {
    type: 'level-start',
    level: state.level,
    bugsTotal: cfg.bugsTotal,
    hp: state.hp,
    score: state.score,
  });

  bugs.startSpawning(ctx, cfg.spawnRate);
}

export function checkGameState(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'playing') return;

  if (state.hp <= 0) {
    endGame(ctx, 'loss', false);
    return;
  }

  const cfg = currentLevelConfig(state);
  const allSpawned = state.bugsSpawned >= cfg.bugsTotal;
  const noneAlive = Object.keys(state.bugs).length === 0;

  if (allSpawned && noneAlive) {
    bugs.clearSpawnTimer(ctx);
    if (state.level >= MAX_LEVEL) {
      if (ctx.matchLog) {
        ctx.matchLog.log('level-complete', { level: state.level, next: 'boss' });
      }
      network.broadcastToLobby(lobbyId, {
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      setTimeout(() => boss.startBoss(ctx), 2000);
    } else {
      if (ctx.matchLog) {
        ctx.matchLog.log('level-complete', { level: state.level, nextLevel: state.level + 1 });
      }
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

export function checkBossGameState(ctx: GameContext): void {
  const { state } = ctx;
  if (state.phase !== 'boss') return;
  if (state.hp <= 0) {
    endGame(ctx, 'loss', false);
  }
}

export function resetToLobby(ctx: GameContext): void {
  const { state } = ctx;
  teardownGame(ctx);
  state.phase = 'lobby';
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
}
