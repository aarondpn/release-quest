const { BOSS_CONFIG, RUBBER_DUCK_CONFIG } = require('./config');
const { randomPosition } = require('./state');
const network = require('./network');
const { createTimerBag } = require('./timer-bag');

function ensureBossTimers(ctx) {
  if (!ctx.timers._boss) ctx.timers._boss = createTimerBag();
  return ctx.timers._boss;
}

function clearBossTimers(ctx) {
  if (ctx.timers._boss) {
    ctx.timers._boss.clearAll();
  }
  // Legacy cleanup for any raw timers still on ctx.timers
  if (ctx.timers.bossWander) { clearInterval(ctx.timers.bossWander); ctx.timers.bossWander = null; }
  if (ctx.timers.bossMinionSpawn) { clearInterval(ctx.timers.bossMinionSpawn); ctx.timers.bossMinionSpawn = null; }
  if (ctx.timers.bossTick) { clearInterval(ctx.timers.bossTick); ctx.timers.bossTick = null; }
}

function getEffectiveSpawnRate(ctx) {
  const { state } = ctx;
  if (!state.boss) return BOSS_CONFIG.minionSpawnRate;
  const base = state.boss.currentSpawnRate;
  if (state.boss.enraged) return Math.min(base, BOSS_CONFIG.enrageMinionSpawnRate);
  return base;
}

function getEffectiveMaxOnScreen(ctx) {
  const { state } = ctx;
  if (!state.boss) return BOSS_CONFIG.minionMaxOnScreen;
  const base = state.boss.currentMaxOnScreen;
  if (state.boss.enraged) return Math.max(base, BOSS_CONFIG.enrageMinionMaxOnScreen + state.boss.extraPlayers);
  return base;
}

function setupBossWander(ctx, interval) {
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

function setupMinionSpawning(ctx, rate) {
  const bt = ensureBossTimers(ctx);
  const { state } = ctx;
  bt.setInterval('bossMinionSpawn', () => {
    if (state.hammerStunActive) return;
    require('./bugs').spawnMinion(ctx);
  }, rate);
}

function startBoss(ctx) {
  const { lobbyId, state } = ctx;
  state.phase = 'boss';
  const pos = randomPosition();
  const extra = Math.max(0, Object.keys(state.players).length - 1);
  state.boss = {
    hp: BOSS_CONFIG.hp + extra * 150,
    maxHp: BOSS_CONFIG.hp + extra * 150,
    x: pos.x,
    y: pos.y,
    enraged: false,
    lastClickBy: {},
    timeRemaining: BOSS_CONFIG.timeLimit,
    escalationLevel: 0,
    currentSpawnRate: BOSS_CONFIG.minionSpawnRate,
    currentMaxOnScreen: BOSS_CONFIG.minionMaxOnScreen + extra,
    regenPerSecond: BOSS_CONFIG.regenPerSecond + extra,
    extraPlayers: extra,
  };

  if (ctx.matchLog) {
    ctx.matchLog.log('boss-start', {
      bossHp: state.boss.hp,
      minionSpawnRate: BOSS_CONFIG.minionSpawnRate,
      timeLimit: BOSS_CONFIG.timeLimit,
      players: Object.keys(state.players).length,
    });
  }

  network.broadcastToLobby(lobbyId, {
    type: 'boss-spawn',
    boss: { hp: state.boss.hp, maxHp: state.boss.maxHp, x: pos.x, y: pos.y, enraged: false },
    hp: state.hp,
    score: state.score,
    timeRemaining: BOSS_CONFIG.timeLimit,
  });

  const bt = ensureBossTimers(ctx);
  setupBossWander(ctx, BOSS_CONFIG.wanderInterval);
  setupMinionSpawning(ctx, BOSS_CONFIG.minionSpawnRate);
  bt.setInterval('bossTick', () => bossTick(ctx), 1000);
}

function bossTick(ctx) {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'boss' || !state.boss) return;

  state.boss.timeRemaining--;

  const oldHp = state.boss.hp;
  state.boss.hp = Math.min(state.boss.hp + state.boss.regenPerSecond, state.boss.maxHp);
  const regenAmount = state.boss.hp - oldHp;

  let escalated = false;
  const nextLevel = state.boss.escalationLevel;
  if (nextLevel < BOSS_CONFIG.escalation.length) {
    const threshold = BOSS_CONFIG.escalation[nextLevel];
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
    const game = require('./game');
    game.endGame(ctx, 'loss-timeout', false);
  }
}

function handleBossClick(ctx, pid) {
  const { lobbyId, state } = ctx;
  if (state.phase !== 'boss' || !state.boss) return;
  const player = state.players[pid];
  if (!player) return;

  const now = Date.now();
  if (state.boss.lastClickBy[pid] && now - state.boss.lastClickBy[pid] < BOSS_CONFIG.clickCooldownMs) return;
  state.boss.lastClickBy[pid] = now;

  // Duck buff doubles click damage
  let damage = BOSS_CONFIG.clickDamage;
  const powerups = require('./powerups');
  if (powerups.isDuckBuffActive(ctx)) {
    damage *= RUBBER_DUCK_CONFIG.pointsMultiplier;
  }

  state.boss.hp -= damage;
  if (state.boss.hp < 0) state.boss.hp = 0;

  state.score += BOSS_CONFIG.clickPoints;
  player.score += BOSS_CONFIG.clickPoints;

  let justEnraged = false;
  if (!state.boss.enraged && state.boss.hp <= state.boss.maxHp * BOSS_CONFIG.enrageThreshold) {
    state.boss.enraged = true;
    justEnraged = true;
    setupBossWander(ctx, BOSS_CONFIG.enrageWanderInterval);
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

function defeatBoss(ctx) {
  const game = require('./game');
  const { state } = ctx;
  const playerCount = Object.keys(state.players).length;
  if (playerCount > 0) {
    const bonusEach = Math.floor(BOSS_CONFIG.killBonus / playerCount);
    for (const pid of Object.keys(state.players)) {
      state.players[pid].score += bonusEach;
    }
    state.score += BOSS_CONFIG.killBonus;
  }

  game.endGame(ctx, 'win', true);
}

module.exports = { startBoss, bossTick, handleBossClick, defeatBoss, clearBossTimers, getEffectiveSpawnRate, getEffectiveMaxOnScreen, setupBossWander, setupMinionSpawning };
