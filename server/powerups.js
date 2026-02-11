const { RUBBER_DUCK_CONFIG, HOTFIX_HAMMER_CONFIG, BOSS_CONFIG } = require('./config');
const { randomPosition } = require('./state');
const network = require('./network');
const boss = require('./boss');
const { getDescriptor } = require('./entity-types');

function startDuckSpawning(ctx) {
  scheduleDuckSpawn(ctx);
}

function scheduleDuckSpawn(ctx) {
  const delay = RUBBER_DUCK_CONFIG.spawnIntervalMin +
    Math.random() * (RUBBER_DUCK_CONFIG.spawnIntervalMax - RUBBER_DUCK_CONFIG.spawnIntervalMin);
  ctx.timers.duckSpawn = setTimeout(() => spawnDuck(ctx), delay);
}

function spawnDuck(ctx) {
  const { lobbyId, state, counters } = ctx;
  if (state.phase !== 'playing' && state.phase !== 'boss') {
    scheduleDuckSpawn(ctx);
    return;
  }
  if (state.rubberDuck) return; // one at a time

  const id = 'duck_' + (counters.nextDuckId++);
  const pos = randomPosition();

  state.rubberDuck = { id, x: pos.x, y: pos.y };

  network.broadcastToLobby(lobbyId, {
    type: 'duck-spawn',
    duck: { id, x: pos.x, y: pos.y },
  });

  // Wander
  ctx.timers.duckWander = setInterval(() => {
    if (!state.rubberDuck) return;
    const np = randomPosition();
    state.rubberDuck.x = np.x;
    state.rubberDuck.y = np.y;
    network.broadcastToLobby(lobbyId, { type: 'duck-wander', x: np.x, y: np.y });
  }, RUBBER_DUCK_CONFIG.wanderInterval);

  // Despawn after timeout
  ctx.timers.duckDespawn = setTimeout(() => {
    if (!state.rubberDuck) return;
    if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
    state.rubberDuck = null;
    network.broadcastToLobby(lobbyId, { type: 'duck-despawn' });
    scheduleDuckSpawn(ctx);
  }, RUBBER_DUCK_CONFIG.despawnTime);
}

function collectDuck(ctx, pid) {
  const { lobbyId, state } = ctx;
  if (!state.rubberDuck) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear duck timers
  if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
  if (ctx.timers.duckDespawn) { clearTimeout(ctx.timers.duckDespawn); ctx.timers.duckDespawn = null; }

  // Award points
  state.score += RUBBER_DUCK_CONFIG.duckPoints;
  player.score += RUBBER_DUCK_CONFIG.duckPoints;

  state.rubberDuck = null;

  // Start buff
  state.duckBuff = { expiresAt: Date.now() + RUBBER_DUCK_CONFIG.buffDuration };

  network.broadcastToLobby(lobbyId, {
    type: 'duck-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    buffDuration: RUBBER_DUCK_CONFIG.buffDuration,
  });

  ctx.timers.duckBuff = setTimeout(() => {
    state.duckBuff = null;
    network.broadcastToLobby(lobbyId, { type: 'duck-buff-expired' });
  }, RUBBER_DUCK_CONFIG.buffDuration);

  // Schedule next duck
  scheduleDuckSpawn(ctx);
}

function isDuckBuffActive(ctx) {
  const { state } = ctx;
  return state.duckBuff && Date.now() < state.duckBuff.expiresAt;
}

function clearDuck(ctx) {
  const { state } = ctx;
  if (ctx.timers.duckSpawn) { clearTimeout(ctx.timers.duckSpawn); ctx.timers.duckSpawn = null; }
  if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
  if (ctx.timers.duckDespawn) { clearTimeout(ctx.timers.duckDespawn); ctx.timers.duckDespawn = null; }
  if (ctx.timers.duckBuff) { clearTimeout(ctx.timers.duckBuff); ctx.timers.duckBuff = null; }
  state.rubberDuck = null;
  state.duckBuff = null;
}

// ── Hotfix Hammer ──

function startHammerSpawning(ctx) {
  scheduleHammerSpawn(ctx);
}

function scheduleHammerSpawn(ctx) {
  const delay = HOTFIX_HAMMER_CONFIG.spawnIntervalMin +
    Math.random() * (HOTFIX_HAMMER_CONFIG.spawnIntervalMax - HOTFIX_HAMMER_CONFIG.spawnIntervalMin);
  ctx.timers.hammerSpawn = setTimeout(() => spawnHammer(ctx), delay);
}

function spawnHammer(ctx) {
  const { lobbyId, state, counters } = ctx;
  if (state.phase !== 'playing' && state.phase !== 'boss') {
    scheduleHammerSpawn(ctx);
    return;
  }
  if (state.hotfixHammer) return; // one at a time

  const id = 'hammer_' + (counters.nextHammerId++);  
  const pos = randomPosition();

  state.hotfixHammer = { id, x: pos.x, y: pos.y };

  network.broadcastToLobby(lobbyId, {
    type: 'hammer-spawn',
    hammer: { id, x: pos.x, y: pos.y },
  });

  // Despawn after timeout
  ctx.timers.hammerDespawn = setTimeout(() => {
    if (!state.hotfixHammer) return;
    state.hotfixHammer = null;
    network.broadcastToLobby(lobbyId, { type: 'hammer-despawn' });
    scheduleHammerSpawn(ctx);
  }, HOTFIX_HAMMER_CONFIG.despawnTime);
}

function collectHammer(ctx, pid) {
  const { lobbyId, state } = ctx;
  if (!state.hotfixHammer) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear hammer timers
  if (ctx.timers.hammerDespawn) { clearTimeout(ctx.timers.hammerDespawn); ctx.timers.hammerDespawn = null; }

  // Award points
  state.score += HOTFIX_HAMMER_CONFIG.hammerPoints;
  player.score += HOTFIX_HAMMER_CONFIG.hammerPoints;

  state.hotfixHammer = null;

  // Stun all bugs and boss
  state.hammerStunActive = true;
  stunAllBugs(ctx);
  stunBoss(ctx);

  network.broadcastToLobby(lobbyId, {
    type: 'hammer-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    stunDuration: HOTFIX_HAMMER_CONFIG.stunDuration,
  });

  // Resume bugs after stun
  ctx.timers.hammerStun = setTimeout(() => {
    state.hammerStunActive = false;
    resumeAllBugs(ctx);
    resumeBoss(ctx);
    network.broadcastToLobby(lobbyId, { type: 'hammer-stun-expired' });
  }, HOTFIX_HAMMER_CONFIG.stunDuration);

  // Schedule next hammer
  scheduleHammerSpawn(ctx);
}

function stunAllBugs(ctx) {
  const { state } = ctx;
  for (const bugId in state.bugs) {
    const bug = state.bugs[bugId];
    getDescriptor(bug).onStun(bug, ctx);
  }
}

function resumeAllBugs(ctx) {
  const { state } = ctx;
  for (const bugId in state.bugs) {
    const bug = state.bugs[bugId];
    if (!bug.isStunned) continue;
    getDescriptor(bug).onResume(bug, ctx);
  }
}

function stunBoss(ctx) {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;

  // Pause boss wandering and minion spawning via TimerBag
  if (ctx.timers._boss) {
    if (ctx.timers._boss.has('bossWander')) {
      ctx.timers._boss.clear('bossWander');
      state.boss._wanderPaused = true;
    }
    if (ctx.timers._boss.has('bossMinionSpawn')) {
      ctx.timers._boss.clear('bossMinionSpawn');
      state.boss._minionSpawnPaused = true;
    }
  }
}

function resumeBoss(ctx) {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;

  if (state.boss._wanderPaused) {
    const wanderInterval = state.boss.enraged ? BOSS_CONFIG.enrageWanderInterval : BOSS_CONFIG.wanderInterval;
    boss.setupBossWander(ctx, wanderInterval);
    state.boss._wanderPaused = false;
  }

  if (state.boss._minionSpawnPaused) {
    const spawnRate = boss.getEffectiveSpawnRate(ctx);
    boss.setupMinionSpawning(ctx, spawnRate);
    state.boss._minionSpawnPaused = false;
  }
}

function clearHammer(ctx) {
  const { state } = ctx;
  if (ctx.timers.hammerSpawn) { clearTimeout(ctx.timers.hammerSpawn); ctx.timers.hammerSpawn = null; }
  if (ctx.timers.hammerDespawn) { clearTimeout(ctx.timers.hammerDespawn); ctx.timers.hammerDespawn = null; }
  if (ctx.timers.hammerStun) { clearTimeout(ctx.timers.hammerStun); ctx.timers.hammerStun = null; }
  state.hotfixHammer = null;
  state.hammerStunActive = false;
}

module.exports = { startDuckSpawning, collectDuck, isDuckBuffActive, clearDuck, startHammerSpawning, collectHammer, clearHammer, stunBoss, resumeBoss };
