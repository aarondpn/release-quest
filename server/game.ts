import { MAX_LEVEL, getDifficultyConfig } from './config.ts';
import { currentLevelConfig, getPlayerScores } from './state.ts';
import logger, { createLobbyLogger } from './logger.ts';
import * as bugs from './bugs.ts';
import * as boss from './boss.ts';
import * as powerups from './powerups.ts';
import * as stats from './stats.ts';
import { createMatchLog } from './match-logger.ts';
import { startRecording, stopRecording } from './recording.ts';
import * as db from './db.ts';
import { gameGamesStarted, gameGamesCompleted } from './metrics.ts';
import type { GameContext } from './types.ts';

export function endGame(ctx: GameContext, outcome: string, win: boolean): void {
  const { lobbyId, state } = ctx;

  // Log match-end event before teardown closes the log
  if (ctx.matchLog) {
    ctx.matchLog.log('game-end', {
      outcome,
      score: state.score,
      level: state.level,
      duration: Date.now() - (state.gameStartedAt || 0),
    });
  }

  // Capture recording before teardown stops it (via hook)
  const recording = stopRecording(lobbyId);

  ctx.lifecycle.transition(state, win ? 'win' : 'gameover');
  gameGamesCompleted.inc({ outcome: win ? 'win' : 'loss', difficulty: state.difficulty });

  // Teardown clears timers, bugs, powerups, matchLog; recording hook is no-op since already stopped
  ctx.lifecycle.teardown();
  state.boss = null;

  ctx.events.emit({
    type: win ? 'boss-defeated' : 'game-over',
    score: state.score,
    level: state.level,
    players: getPlayerScores(state),
  });
  const hasCustom = state.customConfig && Object.keys(state.customConfig).length > 0;
  if (!hasCustom && ctx.playerInfo) stats.recordGameEnd(state, ctx.playerInfo, win);

  // Save recording for logged-in players
  if (recording && ctx.playerInfo) {
    const players = Object.values(state.players).map(p => {
      const info = ctx.playerInfo.get(p.id);
      return { id: p.id, name: p.name, icon: info?.icon || p.icon, color: p.color, score: p.score };
    });
    const meta = {
      duration_ms: recording.duration_ms,
      outcome: win ? 'win' : 'loss',
      score: state.score,
      difficulty: state.difficulty,
      player_count: Object.keys(state.players).length,
      players,
    };
    for (const pid of Object.keys(state.players)) {
      const info = ctx.playerInfo.get(pid);
      if (info?.userId) {
        db.saveRecording(info.userId, meta, recording.events, recording.mouseMovements).catch(err => {
          const logCtx = createLobbyLogger(lobbyId.toString());
          logCtx.error({ err, userId: info.userId }, 'Failed to save recording');
        });
      }
    }
  }
}

export function startGame(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  ctx.lifecycle.teardown();

  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  state.score = 0;
  state.hp = diffConfig.startingHp;
  state.level = 1;
  ctx.lifecycle.transition(state, 'playing');
  state.boss = null;
  state.gameStartedAt = Date.now();

  ctx.matchLog = createMatchLog(lobbyId);
  startRecording(lobbyId);

  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
    state.players[pid].bugsSquashed = 0;
  }

  ctx.matchLog.log('game-start', {
    lobby: lobbyId,
    players: Object.keys(state.players).length,
  });

  gameGamesStarted.inc({ difficulty: state.difficulty });

  ctx.events.emit({
    type: 'game-start',
    level: 1,
    hp: diffConfig.startingHp,
    score: 0,
    players: getPlayerScores(state),
  });

  startLevel(ctx);

  // Start duck spawning globally (works across levels)
  powerups.startDuckSpawning(ctx);
  powerups.startHammerSpawning(ctx);
}

function startLevel(ctx: GameContext): void {
  const { state } = ctx;
  const cfg = currentLevelConfig(state);
  state.bugsRemaining = cfg.bugsTotal;
  state.bugsSpawned = 0;

  if (ctx.matchLog) {
    ctx.matchLog.log('level-start', {
      level: state.level,
      bugsTotal: cfg.bugsTotal,
      spawnRate: cfg.spawnRate,
      maxOnScreen: cfg.maxOnScreen,
      escapeTime: cfg.escapeTime,
    });
  }

  ctx.events.emit({
    type: 'level-start',
    level: state.level,
    bugsTotal: cfg.bugsTotal,
    hp: state.hp,
    score: state.score,
  });

  bugs.startSpawning(ctx, cfg.spawnRate);
}

export function checkGameState(ctx: GameContext): void {
  try {
    const { state } = ctx;
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
        ctx.events.emit({
          type: 'level-complete',
          level: state.level,
          score: state.score,
        });
        ctx.timers.lobby.setTimeout('levelTransition', () => {
          try {
            boss.startBoss(ctx);
          } catch (err) {
            const logCtx = createLobbyLogger(ctx.lobbyId.toString());
            logCtx.error({ err }, 'Error starting boss');
          }
        }, 2000);
      } else {
        if (ctx.matchLog) {
          ctx.matchLog.log('level-complete', { level: state.level, nextLevel: state.level + 1 });
        }
        ctx.events.emit({
          type: 'level-complete',
          level: state.level,
          score: state.score,
        });
        ctx.timers.lobby.setTimeout('levelTransition', () => {
          try {
            if (state.phase !== 'playing' && state.phase !== 'lobby') {
              if (Object.keys(state.players).length === 0) return;
            }
            state.level++;
            startLevel(ctx);
          } catch (err) {
            const logCtx = createLobbyLogger(ctx.lobbyId.toString());
            logCtx.error({ err }, 'Error starting next level');
          }
        }, 2000);
      }
    }
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId }, 'Error in checkGameState');
  }
}

export function checkBossGameState(ctx: GameContext): void {
  try {
    const { state } = ctx;
    if (state.phase !== 'boss') return;
    if (state.hp <= 0) {
      endGame(ctx, 'loss', false);
    }
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId }, 'Error in checkBossGameState');
  }
}

export function resetToLobby(ctx: GameContext): void {
  const { state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  ctx.lifecycle.teardown();
  ctx.lifecycle.transition(state, 'lobby');
  state.score = 0;
  state.hp = diffConfig.startingHp;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
}
