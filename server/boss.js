const { BOSS_CONFIG } = require('./config');
const { state, randomPosition, getPlayerScores } = require('./state');
const network = require('./network');

let bossTimers = { wander: null, minionSpawn: null, tick: null };

function clearBossTimers() {
  if (bossTimers.wander) { clearInterval(bossTimers.wander); bossTimers.wander = null; }
  if (bossTimers.minionSpawn) { clearInterval(bossTimers.minionSpawn); bossTimers.minionSpawn = null; }
  if (bossTimers.tick) { clearInterval(bossTimers.tick); bossTimers.tick = null; }
}

function getEffectiveSpawnRate() {
  if (!state.boss) return BOSS_CONFIG.minionSpawnRate;
  const base = state.boss.currentSpawnRate;
  if (state.boss.enraged) return Math.min(base, BOSS_CONFIG.enrageMinionSpawnRate);
  return base;
}

function getEffectiveMaxOnScreen() {
  if (!state.boss) return BOSS_CONFIG.minionMaxOnScreen;
  const base = state.boss.currentMaxOnScreen;
  if (state.boss.enraged) return Math.max(base, BOSS_CONFIG.enrageMinionMaxOnScreen + state.boss.extraPlayers);
  return base;
}

function startBoss() {
  const bugs = require('./bugs');
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

  network.broadcast({
    type: 'boss-spawn',
    boss: { hp: state.boss.hp, maxHp: state.boss.maxHp, x: pos.x, y: pos.y, enraged: false },
    hp: state.hp,
    score: state.score,
    timeRemaining: BOSS_CONFIG.timeLimit,
  });

  bossTimers.wander = setInterval(() => {
    if (state.phase !== 'boss' || !state.boss) return;
    const newPos = randomPosition();
    state.boss.x = newPos.x;
    state.boss.y = newPos.y;
    network.broadcast({ type: 'boss-wander', x: newPos.x, y: newPos.y });
  }, BOSS_CONFIG.wanderInterval);

  bossTimers.minionSpawn = setInterval(() => bugs.spawnMinion(), BOSS_CONFIG.minionSpawnRate);
  bossTimers.tick = setInterval(bossTick, 1000);
}

function bossTick() {
  const bugs = require('./bugs');
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
      if (bossTimers.minionSpawn) clearInterval(bossTimers.minionSpawn);
      bossTimers.minionSpawn = setInterval(() => bugs.spawnMinion(), getEffectiveSpawnRate());
    }
  }

  network.broadcast({
    type: 'boss-tick',
    timeRemaining: state.boss.timeRemaining,
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp,
    enraged: state.boss.enraged,
    regenAmount,
    escalated,
  });

  if (state.boss.timeRemaining <= 0) {
    state.phase = 'gameover';
    clearBossTimers();
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

function handleBossClick(pid) {
  const bugs = require('./bugs');
  if (state.phase !== 'boss' || !state.boss) return;
  const player = state.players[pid];
  if (!player) return;

  const now = Date.now();
  if (state.boss.lastClickBy[pid] && now - state.boss.lastClickBy[pid] < BOSS_CONFIG.clickCooldownMs) return;
  state.boss.lastClickBy[pid] = now;

  state.boss.hp -= BOSS_CONFIG.clickDamage;
  if (state.boss.hp < 0) state.boss.hp = 0;

  state.score += BOSS_CONFIG.clickPoints;
  player.score += BOSS_CONFIG.clickPoints;

  let justEnraged = false;
  if (!state.boss.enraged && state.boss.hp <= state.boss.maxHp * BOSS_CONFIG.enrageThreshold) {
    state.boss.enraged = true;
    justEnraged = true;

    if (bossTimers.wander) clearInterval(bossTimers.wander);
    bossTimers.wander = setInterval(() => {
      if (state.phase !== 'boss' || !state.boss) return;
      const newPos = randomPosition();
      state.boss.x = newPos.x;
      state.boss.y = newPos.y;
      network.broadcast({ type: 'boss-wander', x: newPos.x, y: newPos.y });
    }, BOSS_CONFIG.enrageWanderInterval);

    if (bossTimers.minionSpawn) clearInterval(bossTimers.minionSpawn);
    bossTimers.minionSpawn = setInterval(() => bugs.spawnMinion(), getEffectiveSpawnRate());
  }

  network.broadcast({
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
    defeatBoss();
  }
}

function defeatBoss() {
  const bugs = require('./bugs');
  const playerCount = Object.keys(state.players).length;
  if (playerCount > 0) {
    const bonusEach = Math.floor(BOSS_CONFIG.killBonus / playerCount);
    for (const pid of Object.keys(state.players)) {
      state.players[pid].score += bonusEach;
    }
    state.score += BOSS_CONFIG.killBonus;
  }

  clearBossTimers();
  bugs.clearAllBugs();
  state.phase = 'win';

  network.broadcast({
    type: 'boss-defeated',
    score: state.score,
    players: getPlayerScores(),
  });

  state.boss = null;
}

module.exports = { startBoss, bossTick, handleBossClick, defeatBoss, clearBossTimers, getEffectiveSpawnRate, getEffectiveMaxOnScreen };
