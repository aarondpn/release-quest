import { getDifficultyConfig } from './config.ts';
import { randomPosition, awardScore, calcScore } from './state.ts';
import logger from './logger.ts';
import * as bugs from './bugs.ts';
import * as game from './game.ts';
import * as powerups from './powerups.ts';
import { getDefaultBossType, getBossType } from './boss-types/index.ts';
import type { GameContext, BossTypePluginInterface } from './types.ts';

let activePlugin: BossTypePluginInterface | null = null;

export function getActivePlugin(): BossTypePluginInterface | null {
  return activePlugin;
}

export function clearBossTimers(ctx: GameContext): void {
  ctx.timers.boss.clearAll();
}

export function getEffectiveSpawnRate(ctx: GameContext): number {
  if (!ctx.state.boss || !activePlugin) {
    const bossConfig = getDifficultyConfig(ctx.state.difficulty, ctx.state.customConfig).boss;
    return bossConfig.minionSpawnRate;
  }
  return activePlugin.getSpawnRate(ctx);
}

export function getEffectiveMaxOnScreen(ctx: GameContext): number {
  if (!ctx.state.boss || !activePlugin) {
    const bossConfig = getDifficultyConfig(ctx.state.difficulty, ctx.state.customConfig).boss;
    return bossConfig.minionMaxOnScreen;
  }
  return activePlugin.getMaxOnScreen(ctx);
}

export function setupBossWander(ctx: GameContext, interval: number): void {
  try {
    const { state } = ctx;
    ctx.timers.boss.setInterval('bossWander', () => {
      try {
        if (state.phase !== 'boss' || !state.boss || state.hammerStunActive) return;
        const newPos = randomPosition();
        state.boss.x = newPos.x;
        state.boss.y = newPos.y;
        ctx.events.emit({ type: 'boss-wander', x: newPos.x, y: newPos.y });
      } catch (err) {
        logger.error({ err, lobbyId: ctx.lobbyId }, 'Error in bossWander');
      }
    }, interval);
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId }, 'Error setting up boss wander');
  }
}

export function setupMinionSpawning(ctx: GameContext, rate: number): void {
  try {
    ctx.timers.boss.setInterval('bossMinionSpawn', () => {
      try {
        if (ctx.state.hammerStunActive) return;
        bugs.spawnMinion(ctx);
      } catch (err) {
        logger.error({ err, lobbyId: ctx.lobbyId }, 'Error spawning minion');
      }
    }, rate);
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId }, 'Error setting up minion spawning');
  }
}

export function startBoss(ctx: GameContext, typeKey?: string): void {
  const { state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;

  activePlugin = typeKey ? getBossType(typeKey) : getDefaultBossType();
  ctx.lifecycle.transition(state, 'boss');

  state.boss = activePlugin.init(ctx, bossConfig);

  if (ctx.matchLog) {
    ctx.matchLog.log('boss-start', {
      bossType: activePlugin.typeKey,
      bossHp: state.boss.hp,
      minionSpawnRate: bossConfig.minionSpawnRate,
      timeLimit: bossConfig.timeLimit,
      players: Object.keys(state.players).length,
    });
  }

  const broadcastExtra = activePlugin.broadcastFields(ctx);
  ctx.events.emit({
    type: 'boss-spawn',
    boss: {
      hp: state.boss.hp,
      maxHp: state.boss.maxHp,
      x: state.boss.x,
      y: state.boss.y,
      ...broadcastExtra,
    },
    hp: state.hp,
    score: state.score,
    timeRemaining: bossConfig.timeLimit,
  });

  setupBossWander(ctx, bossConfig.wanderInterval);
  setupMinionSpawning(ctx, activePlugin.getSpawnRate(ctx));
  ctx.timers.boss.setInterval('bossTick', () => bossTick(ctx), 1000);
}

function bossTick(ctx: GameContext): void {
  try {
    const { state } = ctx;
    if (state.phase !== 'boss' || !state.boss || !activePlugin) return;

    state.boss.timeRemaining--;

    // Delegate tick behavior to plugin (regen, shields, screen wipes, etc.)
    activePlugin.onTick(ctx);

    const broadcastExtra = activePlugin.broadcastFields(ctx);
    ctx.events.emit({
      type: 'boss-tick',
      timeRemaining: state.boss.timeRemaining,
      bossHp: state.boss.hp,
      bossMaxHp: state.boss.maxHp,
      ...broadcastExtra,
    });

    if (state.boss.timeRemaining <= 0) {
      game.endGame(ctx, 'loss-timeout', false);
    }
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId }, 'Error in bossTick');
  }
}

export function handleBossClick(ctx: GameContext, pid: string): void {
  try {
    const { state } = ctx;
    if (state.phase !== 'boss' || !state.boss || !activePlugin) return;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const bossConfig = diffConfig.boss;
    const player = state.players[pid];
    if (!player) return;

    const now = Date.now();
    if (state.boss.lastClickBy[pid] && now - state.boss.lastClickBy[pid] < bossConfig.clickCooldownMs) return;
    state.boss.lastClickBy[pid] = now;

    // Duck buff doubles click damage
    let damage = bossConfig.clickDamage;
    if (powerups.isDuckBuffActive(ctx)) {
      damage *= diffConfig.powerups.rubberDuckPointsMultiplier;
    }

    const result = activePlugin.onClick(ctx, pid, damage);

    if (result.blocked) {
      ctx.events.emit({
        type: 'boss-hit-blocked',
        playerId: pid,
        playerColor: player.color,
        bossHp: state.boss.hp,
        bossMaxHp: state.boss.maxHp,
        ...(result.emit || {}),
        ...activePlugin.broadcastFields(ctx),
      });
      return;
    }

    const clickPoints = awardScore(ctx, pid, bossConfig.clickPoints);

    if (ctx.matchLog) {
      try {
        ctx.matchLog.log('boss-hit', {
          player: pid,
          damage: result.damageApplied,
          bossHp: state.boss.hp,
        });
      } catch (err) {
        logger.error({ err, lobbyId: ctx.lobbyId }, 'Error logging boss hit');
      }
    }

    const broadcastExtra = activePlugin.broadcastFields(ctx);
    ctx.events.emit({
      type: 'boss-hit',
      bossHp: state.boss.hp,
      bossMaxHp: state.boss.maxHp,
      damage: result.damageApplied,
      playerId: pid,
      playerColor: player.color,
      score: state.score,
      playerScore: player.score,
      ...broadcastExtra,
    });

    if (state.boss.hp <= 0) {
      activePlugin.onDefeat(ctx);
      defeatBoss(ctx);
    }
  } catch (err) {
    logger.error({ err, lobbyId: ctx.lobbyId, playerId: pid }, 'Error in handleBossClick');
  }
}

function defeatBoss(ctx: GameContext): void {
  const { state } = ctx;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  const killBonus = calcScore(state, bossConfig.killBonus);
  const playerCount = Object.keys(state.players).length;
  if (playerCount > 0) {
    const bonusEach = Math.floor(killBonus / playerCount);
    for (const pid of Object.keys(state.players)) {
      state.players[pid].score += bonusEach;
    }
    state.score += killBonus;
  }

  game.endGame(ctx, 'win', true);
}
