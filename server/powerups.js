const { RUBBER_DUCK_CONFIG, HOTFIX_HAMMER_CONFIG, MEMORY_LEAK_CONFIG, BOSS_CONFIG } = require('./config');
const { randomPosition } = require('./state');
const network = require('./network');
const boss = require('./boss');
const bugs = require('./bugs');

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
    bug.isStunned = true;
    bug.remainingEscapeTime = Math.max(0, bug.escapeTime - (Date.now() - bug.escapeStartedAt));
    if (bug.escapeTimer) { clearTimeout(bug.escapeTimer); bug.escapeTimer = null; }
    if (bug.wanderInterval) { clearInterval(bug.wanderInterval); bug.wanderInterval = null; }
    if (bug.growthInterval) { clearInterval(bug.growthInterval); bug.growthInterval = null; }
  }
}

function resumeAllBugs(ctx) {
  const { lobbyId, state } = ctx;
  const phaseCheck = state.phase;
  for (const bugId in state.bugs) {
    const bug = state.bugs[bugId];
    if (!bug.isStunned) continue;
    bug.isStunned = false;

    const remainingTime = bug.remainingEscapeTime;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    // Restart escape timer
    if (bug._onEscape) {
      bug.escapeTimer = setTimeout(bug._onEscape, remainingTime);
    }

    // Pipeline bugs use chain-level snake wander (self-resumes via hammerStunActive flag)
    if (!bug.isPipeline && remainingTime > 0) {
      bug.wanderInterval = setInterval(() => {
        if (state.phase !== phaseCheck || !state.bugs[bugId] || state.hammerStunActive) return;
        const newPos = randomPosition();
        bug.x = newPos.x;
        bug.y = newPos.y;
        network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
      }, bug.escapeTime * 0.45);
    }

    // Restart memory leak growth
    if (bug.isMemoryLeak && bug.growthStage < MEMORY_LEAK_CONFIG.maxGrowthStage) {
      bug.growthInterval = setInterval(() => {
        if (state.phase !== phaseCheck || !state.bugs[bugId]) return;
        if (bug.growthStage < MEMORY_LEAK_CONFIG.maxGrowthStage) {
          bug.growthStage++;
          network.broadcastToLobby(lobbyId, { type: 'memory-leak-grow', bugId, growthStage: bug.growthStage });
        }
      }, MEMORY_LEAK_CONFIG.growthInterval);
    }
  }
}

function stunBoss(ctx) {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;
  
  // Pause boss wandering
  if (ctx.timers.bossWander) {
    clearInterval(ctx.timers.bossWander);
    ctx.timers.bossWander = null;
    state.boss._wanderPaused = true;
  }
  
  // Pause minion spawning
  if (ctx.timers.bossMinionSpawn) {
    clearInterval(ctx.timers.bossMinionSpawn);
    ctx.timers.bossMinionSpawn = null;
    state.boss._minionSpawnPaused = true;
  }
}

function resumeBoss(ctx) {
  const { lobbyId, state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;

  // Resume boss wandering
  if (state.boss._wanderPaused) {
    const wanderInterval = state.boss.enraged ? BOSS_CONFIG.enrageWanderInterval : BOSS_CONFIG.wanderInterval;
    ctx.timers.bossWander = setInterval(() => {
      if (state.phase !== 'boss' || !state.boss || state.hammerStunActive) return;
      const newPos = randomPosition();
      state.boss.x = newPos.x;
      state.boss.y = newPos.y;
      network.broadcastToLobby(lobbyId, { type: 'boss-wander', x: newPos.x, y: newPos.y });
    }, wanderInterval);
    state.boss._wanderPaused = false;
  }
  
  // Resume minion spawning
  if (state.boss._minionSpawnPaused) {
    const spawnRate = boss.getEffectiveSpawnRate ? boss.getEffectiveSpawnRate(ctx) : BOSS_CONFIG.minionSpawnRate;
    ctx.timers.bossMinionSpawn = setInterval(() => {
      if (state.hammerStunActive) return;
      bugs.spawnMinion(ctx);
    }, spawnRate);
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
