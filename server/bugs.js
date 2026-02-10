const { HP_DAMAGE, BOSS_CONFIG, HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, MERGE_CONFLICT_CONFIG, DEPENDENCY_BUG_CONFIG, LOGICAL_W, LOGICAL_H } = require('./config');
const { randomPosition, currentLevelConfig } = require('./state');
const network = require('./network');

function spawnEntity(ctx, { phaseCheck, maxOnScreen, escapeTime, isMinion, onEscapeCheck, variant }) {
  const { lobbyId, state, counters } = ctx;
  if (state.phase !== phaseCheck) return false;
  if (Object.keys(state.bugs).length >= maxOnScreen) {
    if (ctx.matchLog) {
      ctx.matchLog.log(isMinion ? 'minion-spawn-skip' : 'spawn-skip', {
        reason: 'max-on-screen',
        activeBugs: Object.keys(state.bugs).length,
        maxOnScreen,
      });
    }
    return false;
  }

  const id = 'bug_' + (counters.nextBugId++);
  const pos = randomPosition();
  const bug = { id, x: pos.x, y: pos.y, escapeTimer: null, wanderInterval: null };
  if (isMinion) bug.isMinion = true;

  if (variant) Object.assign(bug, variant);

  bug.escapeTime = escapeTime;
  bug.escapeStartedAt = Date.now();

  state.bugs[id] = bug;

  if (ctx.matchLog) {
    const logData = {
      bugId: id,
      type: isMinion ? 'minion' : (variant && variant.isHeisenbug ? 'heisenbug' : variant && variant.isFeature ? 'feature' : variant && variant.mergeConflict ? 'merge-conflict' : 'normal'),
      activeBugs: Object.keys(state.bugs).length,
    };
    if (!isMinion) {
      logData.bugsSpawned = state.bugsSpawned;
      logData.bugsTotal = currentLevelConfig(state).bugsTotal;
    }
    ctx.matchLog.log(isMinion ? 'minion-spawn' : 'spawn', logData);
  }

  const broadcastPayload = { id, x: bug.x, y: bug.y };
  if (isMinion) broadcastPayload.isMinion = true;
  if (variant) {
    if (variant.isHeisenbug) { broadcastPayload.isHeisenbug = true; broadcastPayload.fleesRemaining = variant.fleesRemaining; }
    if (variant.isFeature) broadcastPayload.isFeature = true;
    if (variant.mergeConflict) {
      broadcastPayload.mergeConflict = variant.mergeConflict;
      broadcastPayload.mergePartner = variant.mergePartner;
      broadcastPayload.mergeSide = variant.mergeSide;
    }
  }

  network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: broadcastPayload });

  bug.wanderInterval = setInterval(() => {
    if (state.phase !== phaseCheck || !state.bugs[id] || state.hammerStunActive) return;
    const newPos = randomPosition();
    bug.x = newPos.x;
    bug.y = newPos.y;
    network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: id, x: newPos.x, y: newPos.y });
  }, escapeTime * 0.45);

  bug._onEscape = () => {
    if (!state.bugs[id]) return;
    clearInterval(bug.wanderInterval);

    // Feature bugs escape peacefully
    if (bug.isFeature) {
      delete state.bugs[id];
      if (ctx.matchLog) {
        ctx.matchLog.log('escape', { bugId: id, type: 'feature', activeBugs: Object.keys(state.bugs).length });
      }
      network.broadcastToLobby(lobbyId, { type: 'feature-escaped', bugId: id });
      onEscapeCheck();
      return;
    }

    // Merge conflict: both escape together, double damage
    if (bug.mergeConflict) {
      const partner = state.bugs[bug.mergePartner];
      const damage = MERGE_CONFLICT_CONFIG.doubleDamage ? HP_DAMAGE * 2 : HP_DAMAGE;
      delete state.bugs[id];
      if (partner) {
        clearTimeout(partner.escapeTimer);
        clearInterval(partner.wanderInterval);
        delete state.bugs[partner.id];
      }
      state.hp -= damage;
      if (state.hp < 0) state.hp = 0;
      if (ctx.matchLog) {
        ctx.matchLog.log('escape', { bugId: id, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
      }
      network.broadcastToLobby(lobbyId, { type: 'merge-conflict-escaped', bugId: id, partnerId: bug.mergePartner, hp: state.hp });
      onEscapeCheck();
      return;
    }

    delete state.bugs[id];
    state.hp -= HP_DAMAGE;
    if (state.hp < 0) state.hp = 0;

    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: id, activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    network.broadcastToLobby(lobbyId, { type: 'bug-escaped', bugId: id, hp: state.hp });
    onEscapeCheck();
  };
  bug.escapeTimer = setTimeout(bug._onEscape, escapeTime);
  return true;
}

function spawnBug(ctx) {
  const { state, counters } = ctx;
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig(state);
  if (state.bugsSpawned >= cfg.bugsTotal) {
    if (ctx.matchLog) {
      ctx.matchLog.log('spawn-skip', { reason: 'all-spawned', bugsSpawned: state.bugsSpawned, bugsTotal: cfg.bugsTotal });
    }
    return;
  }

  const game = require('./game');
  const playerCount = Object.keys(state.players).length;

  // Roll for dependency chain (level 2+, needs room for 3+ bugs)
  const minChain = DEPENDENCY_BUG_CONFIG.minChainLength;
  if (state.level >= DEPENDENCY_BUG_CONFIG.startLevel
    && Object.keys(state.bugs).length + minChain <= cfg.maxOnScreen + minChain
    && state.bugsSpawned + minChain <= cfg.bugsTotal
    && Math.random() < DEPENDENCY_BUG_CONFIG.chance) {
    const maxLen = Math.min(
      DEPENDENCY_BUG_CONFIG.maxChainLength,
      cfg.bugsTotal - state.bugsSpawned
    );
    if (maxLen >= minChain) {
      spawnDependencyChain(ctx, cfg, game, minChain + Math.floor(Math.random() * (maxLen - minChain + 1)));
      return;
    }
  }

  // Roll for merge conflict (2+ players, needs room for 2 bugs)
  if (playerCount >= MERGE_CONFLICT_CONFIG.minPlayers
    && Object.keys(state.bugs).length + 2 <= cfg.maxOnScreen
    && Math.random() < MERGE_CONFLICT_CONFIG.chance) {
    spawnMergeConflict(ctx, cfg, game);
    return;
  }

  // Roll for variant
  let variant = null;

  // Heisenbug: any level
  if (Math.random() < HEISENBUG_CONFIG.chance) {
    variant = { isHeisenbug: true, fleesRemaining: HEISENBUG_CONFIG.maxFlees, lastFleeTime: 0 };
  }
  // Feature-not-a-bug: level 2+
  else if (state.level >= CODE_REVIEW_CONFIG.startLevel && Math.random() < CODE_REVIEW_CONFIG.featureChance) {
    variant = { isFeature: true };
  }

  const escapeTime = variant && variant.isHeisenbug
    ? cfg.escapeTime * HEISENBUG_CONFIG.escapeTimeMultiplier
    : cfg.escapeTime;

  const spawned = spawnEntity(ctx, {
    phaseCheck: 'playing',
    maxOnScreen: cfg.maxOnScreen,
    escapeTime,
    isMinion: false,
    onEscapeCheck: () => game.checkGameState(ctx),
    variant,
  });
  if (spawned) state.bugsSpawned++;
}

function spawnMergeConflict(ctx, cfg, game) {
  const { lobbyId, state, counters } = ctx;
  const conflictId = 'conflict_' + (counters.nextConflictId++);
  const escapeTime = cfg.escapeTime * MERGE_CONFLICT_CONFIG.escapeTimeMultiplier;
  const id1 = 'bug_' + (counters.nextBugId++);
  const id2 = 'bug_' + (counters.nextBugId++);

  // Count both bugs as spawned
  state.bugsSpawned += 2;

  const pos1 = randomPosition();
  const pos2 = randomPosition();

  const bug1 = {
    id: id1, x: pos1.x, y: pos1.y, escapeTimer: null, wanderInterval: null,
    mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };
  const bug2 = {
    id: id2, x: pos2.x, y: pos2.y, escapeTimer: null, wanderInterval: null,
    mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };

  state.bugs[id1] = bug1;
  state.bugs[id2] = bug2;

  network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: {
    id: id1, x: bug1.x, y: bug1.y, mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
  }});
  network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: {
    id: id2, x: bug2.x, y: bug2.y, mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
  }});

  // Wander independently
  bug1.wanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || !state.bugs[id1]) return;
    const np = randomPosition();
    bug1.x = np.x; bug1.y = np.y;
    network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: id1, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  bug2.wanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || !state.bugs[id2]) return;
    const np = randomPosition();
    bug2.x = np.x; bug2.y = np.y;
    network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: id2, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  // Shared escape timer on bug1 — bug1's escape handler handles both
  bug1.escapeTimer = setTimeout(() => {
    if (!state.bugs[id1] && !state.bugs[id2]) return;
    const damage = MERGE_CONFLICT_CONFIG.doubleDamage ? HP_DAMAGE * 2 : HP_DAMAGE;
    if (state.bugs[id1]) { clearInterval(bug1.wanderInterval); delete state.bugs[id1]; }
    if (state.bugs[id2]) { clearTimeout(bug2.escapeTimer); clearInterval(bug2.wanderInterval); delete state.bugs[id2]; }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: id1, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    network.broadcastToLobby(lobbyId, { type: 'merge-conflict-escaped', bugId: id1, partnerId: id2, hp: state.hp });
    game.checkGameState(ctx);
  }, escapeTime);

  // bug2 shares the same escape time
  bug2.escapeTimer = bug1.escapeTimer;
}

function spawnDependencyChain(ctx, cfg, game, chainLength) {
  const { lobbyId, state, counters } = ctx;
  const chainId = 'chain_' + (counters.nextChainId++);
  const escapeTime = cfg.escapeTime * DEPENDENCY_BUG_CONFIG.escapeTimeMultiplier;
  const pad = 40;

  state.bugsSpawned += chainLength;

  // Position bugs in a snake-like line
  const startPos = randomPosition();
  const angle = Math.random() * Math.PI * 2;
  const spacing = 40;

  const bugIds = [];
  const chainBugs = [];
  for (let i = 0; i < chainLength; i++) {
    const id = 'bug_' + (counters.nextBugId++);
    const x = Math.max(pad, Math.min(LOGICAL_W - pad, startPos.x + Math.cos(angle) * spacing * i));
    const y = Math.max(pad, Math.min(LOGICAL_H - pad, startPos.y + Math.sin(angle) * spacing * i));
    const bug = {
      id, x, y, escapeTimer: null, wanderInterval: null,
      isDependency: true, chainId, chainIndex: i, chainLength,
      escapeTime, escapeStartedAt: Date.now(),
    };
    state.bugs[id] = bug;
    bugIds.push(id);
    chainBugs.push(bug);
  }

  // Snake movement — continuous slithering
  const snakeSpeed = 40;
  const snakeTickMs = 350;
  let snakeAngle = angle + Math.PI; // start heading opposite to tail direction

  const chainWanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || state.hammerStunActive) return;
    const chain = state.dependencyChains[chainId];
    if (!chain) { clearInterval(chainWanderInterval); return; }
    const alive = chain.bugIds.filter(bid => state.bugs[bid]);
    if (alive.length === 0) { clearInterval(chainWanderInterval); return; }

    // Store old positions
    const oldPos = {};
    for (const bid of alive) {
      const b = state.bugs[bid];
      oldPos[bid] = { x: b.x, y: b.y };
    }

    // Head slithers forward: random turn + wall bounce
    chain.snakeAngle += (Math.random() - 0.5) * 0.8;
    const head = state.bugs[alive[0]];
    let nx = head.x + Math.cos(chain.snakeAngle) * snakeSpeed;
    let ny = head.y + Math.sin(chain.snakeAngle) * snakeSpeed;

    // Bounce off walls
    if (nx < pad) { chain.snakeAngle = Math.PI - chain.snakeAngle; nx = pad; }
    else if (nx > LOGICAL_W - pad) { chain.snakeAngle = Math.PI - chain.snakeAngle; nx = LOGICAL_W - pad; }
    if (ny < pad) { chain.snakeAngle = -chain.snakeAngle; ny = pad; }
    else if (ny > LOGICAL_H - pad) { chain.snakeAngle = -chain.snakeAngle; ny = LOGICAL_H - pad; }

    head.x = nx;
    head.y = ny;

    // Each subsequent bug follows the previous one
    for (let i = 1; i < alive.length; i++) {
      const b = state.bugs[alive[i]];
      b.x = oldPos[alive[i - 1]].x;
      b.y = oldPos[alive[i - 1]].y;
    }

    // Broadcast all position updates
    for (const bid of alive) {
      const b = state.bugs[bid];
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: bid, x: b.x, y: b.y });
    }
  }, snakeTickMs);

  state.dependencyChains[chainId] = {
    bugIds, nextIndex: 0, length: chainLength,
    wanderInterval: chainWanderInterval,
    snakeAngle,
  };

  // Broadcast all spawns
  for (const bug of chainBugs) {
    network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: {
      id: bug.id, x: bug.x, y: bug.y,
      isDependency: true, chainId, chainIndex: bug.chainIndex, chainLength,
    }});
  }

  // Shared escape timer
  const escapeHandler = () => {
    const chain = state.dependencyChains[chainId];
    if (!chain) return;
    clearInterval(chain.wanderInterval);
    const remaining = bugIds.filter(bid => state.bugs[bid]);
    if (remaining.length === 0) return;
    const damage = HP_DAMAGE * remaining.length;
    for (const bid of remaining) {
      if (state.bugs[bid]) delete state.bugs[bid];
    }
    delete state.dependencyChains[chainId];
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { chainId, type: 'dependency-chain', bugsLost: remaining.length, hp: state.hp });
    }
    network.broadcastToLobby(lobbyId, {
      type: 'dependency-chain-escaped', chainId, bugIds: remaining, hp: state.hp,
    });
    game.checkGameState(ctx);
  };

  const timer = setTimeout(escapeHandler, escapeTime);
  for (const bug of chainBugs) {
    bug.escapeTimer = timer;
  }
}

function spawnMinion(ctx) {
  const { state } = ctx;
  if (state.phase !== 'boss') return;
  const bossModule = require('./boss');
  const game = require('./game');
  const maxOnScreen = bossModule.getEffectiveMaxOnScreen(ctx);

  // Roll for feature variant during boss phase
  let variant = null;
  if (Math.random() < CODE_REVIEW_CONFIG.bossPhaseChance) {
    variant = { isFeature: true };
  }

  spawnEntity(ctx, {
    phaseCheck: 'boss',
    maxOnScreen,
    escapeTime: BOSS_CONFIG.minionEscapeTime,
    isMinion: true,
    onEscapeCheck: () => game.checkBossGameState(ctx),
    variant,
  });
}

function clearAllBugs(ctx) {
  const { state } = ctx;
  for (const chainId of Object.keys(state.dependencyChains)) {
    const chain = state.dependencyChains[chainId];
    if (chain.wanderInterval) clearInterval(chain.wanderInterval);
  }
  for (const id of Object.keys(state.bugs)) {
    const bug = state.bugs[id];
    clearTimeout(bug.escapeTimer);
    clearInterval(bug.wanderInterval);
    if (bug.mergeResetTimer) clearTimeout(bug.mergeResetTimer);
  }
  state.bugs = {};
  state.dependencyChains = {};
}

function clearSpawnTimer(ctx) {
  if (ctx.timers.spawnTimer) {
    clearInterval(ctx.timers.spawnTimer);
    ctx.timers.spawnTimer = null;
  }
}

function startSpawning(ctx, rate) {
  ctx.timers.spawnTimer = setInterval(() => spawnBug(ctx), rate);
  spawnBug(ctx);
}

module.exports = { spawnBug, spawnMinion, spawnMergeConflict, spawnDependencyChain, clearAllBugs, clearSpawnTimer, startSpawning, spawnEntity };
