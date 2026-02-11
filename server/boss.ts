import { getDifficultyConfig, RUBBER_DUCK_CONFIG } from './config.ts';
import { randomPosition } from './state.ts';
import * as network from './network.ts';
import { createTimerBag } from './timer-bag.ts';
import * as bugs from './bugs.ts';
import * as game from './game.ts';
import * as powerups from './powerups.ts';
import type { GameContext } from './types.ts';

function ensureBossTimers(ctx: GameContext) {
  if (!ctx.timers._boss) ctx.timers._boss = createTimerBag();
  return ctx.timers._boss;
}

export function clearBossTimers(ctx: GameContext): void {
  if (ctx.timers._boss) {
    ctx.timers._boss.clearAll();
  }
  // Legacy cleanup for any raw timers still on ctx.timers
  if (ctx.timers.bossWander) { clearInterval(ctx.timers.bossWander); ctx.timers.bossWander = null; }
  if (ctx.timers.bossMinionSpawn) { clearInterval(ctx.timers.bossMinionSpawn); ctx.timers.bossMinionSpawn = null; }
  if (ctx.timers.bossTick) { clearInterval(ctx.timers.bossTick); ctx.timers.bossTick = null; }
}

export function getEffectiveSpawnRate(ctx: GameContext): number {
  const { state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  if (!state.boss) return bossConfig.minionSpawnRate;
  const base = state.boss.currentSpawnRate;
  if (state.boss.enraged) return Math.min(base, bossConfig.enrageMinionSpawnRate);
  return base;
}

export function getEffectiveMaxOnScreen(ctx: GameContext): number {
  const { state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  if (!state.boss) return bossConfig.minionMaxOnScreen;
  const base = state.boss.currentMaxOnScreen;
  if (state.boss.enraged) return Math.max(base, bossConfig.enrageMinionMaxOnScreen + state.boss.extraPlayers);
  return base;
}

export function setupBossWander(ctx: GameContext, interval: number): void {
  const bt = ensureBossTimers(ctx);
  const { lobbyId, state } = ctx;
  bt.setInterval('bossWander', () => {
    if (state.phase !== 'boss' || !state.boss || state.hammerStunActive) return;
    const newPos = randomPosition();
    state.boss.x = newPos.x;
    state.boss.y = newPos.y;
    network.broadcastToLobby(lobbyId, { type: 'boss-wander', x: newPos.x, y: newPos.y });
  }, interval);
}

export function setupMinionSpawning(ctx: GameContext, rate: number): void {
  const bt = ensureBossTimers(ctx);
  bt.setInterval('bossMinionSpawn', () => {
    if (ctx.state.hammerStunActive) return;
    bugs.spawnMinion(ctx);
  }, rate);
}

export function startBoss(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  state.phase = 'boss';
  const pos = randomPosition();
  const extra = Math.max(0, Object.keys(state.players).length - 1);
  state.boss = {
    hp: bossConfig.hp + extra * 150,
    maxHp: bossConfig.hp + extra * 150,
    x: pos.x,
    y: pos.y,
    enraged: false,
    lastClickBy: {},
    timeRemaining: bossConfig.timeLimit,
    escalationLevel: 0,
    currentSpawnRate: bossConfig.minionSpawnRate,
    currentMaxOnScreen: bossConfig.minionMaxOnScreen + extra,
    regenPerSecond: bossConfig.regenPerSecond + extra,
    extraPlayers: extra,
  };

  if (ctx.matchLog) {
    ctx.matchLog.log('boss-start', {
      bossHp: state.boss.hp,
      minionSpawnRate: bossConfig.minionSpawnRate,
      timeLimit: bossConfig.timeLimit,
      players: Object.keys(state.players).length,
    });
  }

  network.broadcastToLobby(lobbyId, {
    type: 'boss-spawn',
    boss: { hp: state.boss.hp, maxHp: state.boss.maxHp, x: pos.x, y: pos.y, enraged: false },
    hp: state.hp,
    score: state.score,
    timeRemaining: bossConfig.timeLimit,
  });

  const bt = ensureBossTimers(ctx);
  setupBossWander(ctx, bossConfig.wanderInterval);
  setupMinionSpawning(ctx, bossConfig.minionSpawnRate);
  bt.setInterval('bossTick', () => bossTick(ctx), 1000);
}

function bossTick(ctx: GameContext): void {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'boss' || !state.boss) return;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;

  state.boss.timeRemaining--;

  const oldHp = state.boss.hp;
  state.boss.hp = Math.min(state.boss.hp + state.boss.regenPerSecond, state.boss.maxHp);
  const regenAmount = state.boss.hp - oldHp;

  let escalated = false;
  const nextLevel = state.boss.escalationLevel;
  if (nextLevel < bossConfig.escalation.length) {
    const threshold = bossConfig.escalation[nextLevel];
    if (state.boss.timeRemaining <= threshold.timeRemaining) {
      state.boss.escalationLevel++;
      state.boss.currentSpawnRate = threshold.spawnRate;
      state.boss.currentMaxOnScreen = threshold.maxOnScreen + state.boss.extraPlayers;
      escalated = true;
      if (ctx.matchLog) {
        ctx.matchLog.log('boss-escalation', {
          escalationLevel: state.boss.escalationLevel,
          newSpawnRate: threshold.spawnRate,
          newMaxOnScreen: state.boss.currentMaxOnScreen,
          timeRemaining: state.boss.timeRemaining,
        });
      }
      setupMinionSpawning(ctx, getEffectiveSpawnRate(ctx));
    }
  }

  network.broadcastToLobby(lobbyId, {
    type: 'boss-tick',
    timeRemaining: state.boss.timeRemaining,
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp,
    enraged: state.boss.enraged,
    regenAmount,
    escalated,
  });

  if (state.boss.timeRemaining <= 0) {
    game.endGame(ctx, 'loss-timeout', false);
  }
}

export function handleBossClick(ctx: GameContext, pid: string): void {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'boss' || !state.boss) return;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  const player = state.players[pid];
  if (!player) return;

  const now = Date.now();
  if (state.boss.lastClickBy[pid] && now - state.boss.lastClickBy[pid] < bossConfig.clickCooldownMs) return;
  state.boss.lastClickBy[pid] = now;

  // Duck buff doubles click damage
  let damage = bossConfig.clickDamage;
  if (powerups.isDuckBuffActive(ctx)) {
    damage *= RUBBER_DUCK_CONFIG.pointsMultiplier;
  }

  state.boss.hp -= damage;
  if (state.boss.hp < 0) state.boss.hp = 0;

  state.score += bossConfig.clickPoints;
  player.score += bossConfig.clickPoints;

  let justEnraged = false;
  if (!state.boss.enraged && state.boss.hp <= state.boss.maxHp * bossConfig.enrageThreshold) {
    state.boss.enraged = true;
    justEnraged = true;
    setupBossWander(ctx, bossConfig.enrageWanderInterval);
    setupMinionSpawning(ctx, getEffectiveSpawnRate(ctx));
  }

  if (ctx.matchLog) {
    ctx.matchLog.log('boss-hit', {
      player: pid,
      damage,
      bossHp: state.boss.hp,
      enraged: state.boss.enraged,
    });
  }

  network.broadcastToLobby(lobbyId, {
    type: 'boss-hit',
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp,
    enraged: state.boss.enraged,
    justEnraged,
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
  });

  if (state.boss.hp <= 0) {
    defeatBoss(ctx);
  }
}

function defeatBoss(ctx: GameContext): void {
  const { state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  const playerCount = Object.keys(state.players).length;
  if (playerCount > 0) {
    const bonusEach = Math.floor(bossConfig.killBonus / playerCount);
    for (const pid of Object.keys(state.players)) {
      state.players[pid].score += bonusEach;
    }
    state.score += bossConfig.killBonus;
  }

  game.endGame(ctx, 'win', true);
}
