import { MAX_LEVEL, getDifficultyConfig } from './config.ts';
import { currentLevelConfig, getPlayerScores } from './state.ts';
import * as network from './network.ts';
import * as bugs from './bugs.ts';
import * as boss from './boss.ts';
import * as powerups from './powerups.ts';
import * as stats from './stats.ts';
import { createMatchLog } from './match-logger.ts';
import { startRecording, stopRecording } from './recording.ts';
import * as db from './db.ts';
import type { GameContext } from './types.ts';

function teardownGame(ctx: GameContext): void {
  try {
    bugs.clearSpawnTimer(ctx);
  } catch (err) {
    console.error('Error clearing spawn timer:', err);
  }
  try {
    bugs.clearAllBugs(ctx);
  } catch (err) {
    console.error('Error clearing bugs:', err);
  }
  try {
    boss.clearBossTimers(ctx);
  } catch (err) {
    console.error('Error clearing boss timers:', err);
  }
  try {
    powerups.clearDuck(ctx);
  } catch (err) {
    console.error('Error clearing duck:', err);
  }
  try {
    powerups.clearHammer(ctx);
  } catch (err) {
    console.error('Error clearing hammer:', err);
  }
  try {
    if (ctx.matchLog) { ctx.matchLog.close(); ctx.matchLog = null; }
  } catch (err) {
    console.error('Error closing match log:', err);
  }
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

  // Save recording for logged-in players
  const recording = stopRecording(lobbyId);
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
          console.error('[recording] Failed to save recording:', err);
        });
      }
    }
  }
}

export function startGame(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  teardownGame(ctx);

  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  state.score = 0;
  state.hp = diffConfig.startingHp;
  state.level = 1;
  state.phase = 'playing';
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

  network.broadcastToLobby(lobbyId, {
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
  try {
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
        setTimeout(() => {
          try {
            boss.startBoss(ctx);
          } catch (err) {
            console.error('Error starting boss:', err);
          }
        }, 2000);
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
          try {
            if (state.phase !== 'playing' && state.phase !== 'lobby') {
              if (Object.keys(state.players).length === 0) return;
            }
            state.level++;
            startLevel(ctx);
          } catch (err) {
            console.error('Error starting next level:', err);
          }
        }, 2000);
      }
    }
  } catch (err) {
    console.error('Error in checkGameState:', err);
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
    console.error('Error in checkBossGameState:', err);
  }
}

export function resetToLobby(ctx: GameContext): void {
  const { state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  teardownGame(ctx);
  state.phase = 'lobby';
  state.score = 0;
  state.hp = diffConfig.startingHp;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
}
