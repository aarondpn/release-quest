const { HP_DAMAGE, BOSS_CONFIG, HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, MERGE_CONFLICT_CONFIG, PIPELINE_BUG_CONFIG, MEMORY_LEAK_CONFIG, LOGICAL_W, LOGICAL_H } = require('./config');
const { randomPosition, currentLevelConfig } = require('./state');
const network = require('./network');
const { createTimerBag } = require('./timer-bag');
const { getDescriptor, getType } = require('./entity-types');

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
  const bug = { id, x: pos.x, y: pos.y, _timers: createTimerBag() };
  if (isMinion) bug.isMinion = true;

  if (variant) Object.assign(bug, variant);

  bug.escapeTime = escapeTime;
  bug.escapeStartedAt = Date.now();

  state.bugs[id] = bug;

  const descriptor = getDescriptor(bug);
  descriptor.init(bug, ctx, { phaseCheck });

  if (ctx.matchLog) {
    ctx.matchLog.log(isMinion ? 'minion-spawn' : 'spawn', {
      bugId: id,
      type: getType(bug),
      activeBugs: Object.keys(state.bugs).length,
      ...(!isMinion ? { bugsSpawned: state.bugsSpawned, bugsTotal: currentLevelConfig(state).bugsTotal } : {}),
    });
  }

  const broadcastPayload = { id, x: bug.x, y: bug.y };
  if (isMinion) broadcastPayload.isMinion = true;
  Object.assign(broadcastPayload, descriptor.broadcastFields(bug));

  network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: broadcastPayload });

  descriptor.setupTimers(bug, ctx);
  descriptor.createWander(bug, ctx);

  bug._onEscape = () => {
    if (!state.bugs[id]) return;
    descriptor.onEscape(bug, ctx, onEscapeCheck);
  };
  bug._timers.setTimeout('escape', bug._onEscape, escapeTime);
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

  // Roll for pipeline chain (level 2+, needs room for 3+ bugs)
  const minChain = PIPELINE_BUG_CONFIG.minChainLength;
  if (state.level >= PIPELINE_BUG_CONFIG.startLevel
    && Object.keys(state.bugs).length + minChain <= cfg.maxOnScreen + minChain
    && state.bugsSpawned + minChain <= cfg.bugsTotal
    && Math.random() < PIPELINE_BUG_CONFIG.chance) {
    const maxLen = Math.min(
      PIPELINE_BUG_CONFIG.maxChainLength,
      cfg.bugsTotal - state.bugsSpawned
    );
    if (maxLen >= minChain) {
      spawnPipelineChain(ctx, cfg, game, minChain + Math.floor(Math.random() * (maxLen - minChain + 1)));
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
  // Memory leak: any level
  else if (Math.random() < MEMORY_LEAK_CONFIG.chance) {
    variant = { isMemoryLeak: true, growthStage: 0 };
  }
  // Feature-not-a-bug: level 2+
  else if (state.level >= CODE_REVIEW_CONFIG.startLevel && Math.random() < CODE_REVIEW_CONFIG.featureChance) {
    variant = { isFeature: true };
  }

  const escapeTime = variant && variant.isHeisenbug
    ? cfg.escapeTime * HEISENBUG_CONFIG.escapeTimeMultiplier
    : (variant && variant.isMemoryLeak
      ? cfg.escapeTime * MEMORY_LEAK_CONFIG.escapeTimeMultiplier
      : cfg.escapeTime);

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
    id: id1, x: pos1.x, y: pos1.y, _timers: createTimerBag(),
    mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };
  const bug2 = {
    id: id2, x: pos2.x, y: pos2.y, _timers: createTimerBag(),
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
  bug1._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id1]) return;
    const np = randomPosition();
    bug1.x = np.x; bug1.y = np.y;
    network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: id1, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  bug2._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id2]) return;
    const np = randomPosition();
    bug2.x = np.x; bug2.y = np.y;
    network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: id2, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  // Shared escape handler — assigned to _onEscape so hammer stun/resume can restart it
  const escapeHandler = () => {
    if (!state.bugs[id1] && !state.bugs[id2]) return;
    const damage = MERGE_CONFLICT_CONFIG.doubleDamage ? HP_DAMAGE * 2 : HP_DAMAGE;
    if (state.bugs[id1]) { bug1._timers.clearAll(); delete state.bugs[id1]; }
    if (state.bugs[id2]) { bug2._timers.clearAll(); delete state.bugs[id2]; }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: id1, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    network.broadcastToLobby(lobbyId, { type: 'merge-conflict-escaped', bugId: id1, partnerId: id2, hp: state.hp });
    game.checkGameState(ctx);
  };

  bug1._onEscape = escapeHandler;
  bug2._onEscape = escapeHandler;

  bug1._timers.setTimeout('escape', escapeHandler, escapeTime);
  // bug2 shares bug1's escape timer (clearing bug1's clears both)
  bug2._sharedEscapeWith = id1;
}

function spawnPipelineChain(ctx, cfg, game, chainLength) {
  const { lobbyId, state, counters } = ctx;
  const chainId = 'chain_' + (counters.nextChainId++);
  const escapeTime = cfg.escapeTime * PIPELINE_BUG_CONFIG.escapeTimeMultiplier;
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
      id, x, y, _timers: createTimerBag(),
      isPipeline: true, chainId, chainIndex: i, chainLength,
      escapeTime, escapeStartedAt: Date.now(),
    };
    state.bugs[id] = bug;
    bugIds.push(id);
    chainBugs.push(bug);
  }

  // Snake movement — smooth continuous slithering
  const snakeSpeed = 30;
  const snakeTickMs = 350;
  let snakeAngle = angle + Math.PI;
  const margin = 100;

  // Store chain wander on head bug's timer bag
  const headBug = chainBugs[0];
  headBug._timers.setInterval('chainWander', () => {
    if (state.phase !== 'playing' || state.hammerStunActive) return;
    const chain = state.pipelineChains[chainId];
    if (!chain) { headBug._timers.clear('chainWander'); return; }
    const alive = chain.bugIds.filter(bid => state.bugs[bid]);
    if (alive.length === 0) { headBug._timers.clear('chainWander'); return; }

    // Store old positions
    const oldPos = {};
    for (const bid of alive) {
      const b = state.bugs[bid];
      oldPos[bid] = { x: b.x, y: b.y };
    }

    // Gentle random wander
    chain.snakeAngle += (Math.random() - 0.5) * 0.5;

    // Smooth wall avoidance — steer toward center when near edges
    const head = state.bugs[alive[0]];
    if (head.x < margin || head.x > LOGICAL_W - margin ||
        head.y < margin || head.y > LOGICAL_H - margin) {
      const toCenter = Math.atan2(LOGICAL_H / 2 - head.y, LOGICAL_W / 2 - head.x);
      let diff = toCenter - chain.snakeAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      chain.snakeAngle += diff * 0.15;
    }

    head.x = Math.max(pad, Math.min(LOGICAL_W - pad, head.x + Math.cos(chain.snakeAngle) * snakeSpeed));
    head.y = Math.max(pad, Math.min(LOGICAL_H - pad, head.y + Math.sin(chain.snakeAngle) * snakeSpeed));

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

  state.pipelineChains[chainId] = {
    bugIds, nextIndex: 0, length: chainLength,
    headBugId: headBug.id,
    snakeAngle,
  };

  // Broadcast all spawns
  for (const bug of chainBugs) {
    network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: {
      id: bug.id, x: bug.x, y: bug.y,
      isPipeline: true, chainId, chainIndex: bug.chainIndex, chainLength,
    }});
  }

  // Shared escape timer
  const escapeHandler = () => {
    const chain = state.pipelineChains[chainId];
    if (!chain) return;
    // Clear chain wander from head bug
    const hBug = state.bugs[chain.headBugId];
    if (hBug) hBug._timers.clear('chainWander');
    const remaining = bugIds.filter(bid => state.bugs[bid]);
    if (remaining.length === 0) return;
    const damage = HP_DAMAGE * remaining.length;
    for (const bid of remaining) {
      if (state.bugs[bid]) {
        state.bugs[bid]._timers.clearAll();
        delete state.bugs[bid];
      }
    }
    delete state.pipelineChains[chainId];
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { chainId, type: 'pipeline-chain', bugsLost: remaining.length, hp: state.hp });
    }
    network.broadcastToLobby(lobbyId, {
      type: 'pipeline-chain-escaped', chainId, bugIds: remaining, hp: state.hp,
    });
    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  };

  // Assign _onEscape so hammer stun/resume can restart the escape timer
  for (const bug of chainBugs) {
    bug._onEscape = escapeHandler;
  }

  // All pipeline bugs share head bug's escape timer
  headBug._timers.setTimeout('escape', escapeHandler, escapeTime);
  for (const bug of chainBugs) {
    if (bug !== headBug) bug._sharedEscapeWith = headBug.id;
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
  for (const id of Object.keys(state.bugs)) {
    state.bugs[id]._timers.clearAll();
  }
  state.bugs = {};
  state.pipelineChains = {};
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

module.exports = { spawnBug, spawnMinion, spawnMergeConflict, clearAllBugs, clearSpawnTimer, startSpawning, spawnEntity };
