import { getDifficultyConfig, HEISENBUG_MECHANICS, CODE_REVIEW_MECHANICS, MERGE_CONFLICT_MECHANICS, PIPELINE_BUG_MECHANICS, MEMORY_LEAK_MECHANICS, LOGICAL_W, LOGICAL_H } from './config.ts';
import { randomPosition, currentLevelConfig } from './state.ts';
import * as network from './network.ts';
import { createTimerBag } from './timer-bag.ts';
import { getDescriptor, getType } from './entity-types.ts';
import * as game from './game.ts';
import * as bossModule from './boss.ts';
import type { GameContext, BugEntity, SpawnEntityOptions } from './types.ts';

function spawnEntity(ctx: GameContext, opts: SpawnEntityOptions): boolean {
  const { lobbyId, state, counters } = ctx;
  if (state.phase !== opts.phaseCheck) return false;
  if (Object.keys(state.bugs).length >= opts.maxOnScreen) {
    if (ctx.matchLog) {
      ctx.matchLog.log(opts.isMinion ? 'minion-spawn-skip' : 'spawn-skip', {
        reason: 'max-on-screen',
        activeBugs: Object.keys(state.bugs).length,
        maxOnScreen: opts.maxOnScreen,
      });
    }
    return false;
  }

  const id = 'bug_' + (counters.nextBugId++);
  const pos = randomPosition();
  const bug: BugEntity = { id, x: pos.x, y: pos.y, _timers: createTimerBag(), escapeTime: opts.escapeTime, escapeStartedAt: Date.now() };
  if (opts.isMinion) bug.isMinion = true;

  if (opts.variant) Object.assign(bug, opts.variant);

  state.bugs[id] = bug;

  const descriptor = getDescriptor(bug);
  descriptor.init(bug, ctx, { phaseCheck: opts.phaseCheck });

  if (ctx.matchLog) {
    ctx.matchLog.log(opts.isMinion ? 'minion-spawn' : 'spawn', {
      bugId: id,
      type: getType(bug),
      activeBugs: Object.keys(state.bugs).length,
      ...(!opts.isMinion ? { bugsSpawned: state.bugsSpawned, bugsTotal: currentLevelConfig(state).bugsTotal } : {}),
    });
  }

  const broadcastPayload: Record<string, unknown> = { id, x: bug.x, y: bug.y };
  if (opts.isMinion) broadcastPayload.isMinion = true;
  Object.assign(broadcastPayload, descriptor.broadcastFields(bug));

  network.broadcastToLobby(lobbyId, { type: 'bug-spawned', bug: broadcastPayload });

  descriptor.setupTimers(bug, ctx);
  descriptor.createWander(bug, ctx);

  bug._onEscape = () => {
    if (!state.bugs[id]) return;
    descriptor.onEscape(bug, ctx, opts.onEscapeCheck);
  };
  bug._timers.setTimeout('escape', bug._onEscape, opts.escapeTime);
  return true;
}

function spawnBug(ctx: GameContext): void {
  const { state, counters } = ctx;
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig(state);
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (state.bugsSpawned >= cfg.bugsTotal) {
    if (ctx.matchLog) {
      ctx.matchLog.log('spawn-skip', { reason: 'all-spawned', bugsSpawned: state.bugsSpawned, bugsTotal: cfg.bugsTotal });
    }
    return;
  }

  const playerCount = Object.keys(state.players).length;

  // Roll for pipeline chain (level 2+, needs room for 3+ bugs)
  const minChain = PIPELINE_BUG_CONFIG.minChainLength;
  if (state.level >= diffConfig.specialBugs.pipelineBugStartLevel
    && Object.keys(state.bugs).length + minChain <= cfg.maxOnScreen + minChain
    && state.bugsSpawned + minChain <= cfg.bugsTotal
    && Math.random() < diffConfig.specialBugs.pipelineBugChance) {
    const maxLen = Math.min(
      PIPELINE_BUG_CONFIG.maxChainLength,
      cfg.bugsTotal - state.bugsSpawned
    );
    if (maxLen >= minChain) {
      spawnPipelineChain(ctx, cfg, minChain + Math.floor(Math.random() * (maxLen - minChain + 1)));
      return;
    }
  }

  // Roll for merge conflict (2+ players, needs room for 2 bugs)
  if (playerCount >= MERGE_CONFLICT_CONFIG.minPlayers
    && Object.keys(state.bugs).length + 2 <= cfg.maxOnScreen
    && Math.random() < diffConfig.specialBugs.mergeConflictChance) {
    spawnMergeConflict(ctx, cfg);
    return;
  }

  // Roll for variant
  let variant: Partial<BugEntity> | null = null;

  // Heisenbug: any level
  if (Math.random() < diffConfig.specialBugs.heisenbugChance) {
    variant = { isHeisenbug: true, fleesRemaining: HEISENBUG_CONFIG.maxFlees, lastFleeTime: 0 };
  }
  // Memory leak: any level (cap scales with player count so there's always a free player)
  else if (Math.random() < diffConfig.specialBugs.memoryLeakChance
    && Object.values(state.bugs).filter(b => b.isMemoryLeak).length < Math.max(1, playerCount - 1)) {
    variant = { isMemoryLeak: true, growthStage: 0 };
  }
  // Feature-not-a-bug: level 2+
  else if (state.level >= diffConfig.specialBugs.codeReviewStartLevel && Math.random() < diffConfig.specialBugs.codeReviewChance) {
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

function spawnMergeConflict(ctx: GameContext, cfg: { escapeTime: number; maxOnScreen: number; bugsTotal: number; spawnRate: number }): void {
  const { lobbyId, state, counters } = ctx;
  const conflictId = 'conflict_' + (counters.nextConflictId++);
  const escapeTime = cfg.escapeTime * MERGE_CONFLICT_CONFIG.escapeTimeMultiplier;
  const id1 = 'bug_' + (counters.nextBugId++);
  const id2 = 'bug_' + (counters.nextBugId++);

  // Count both bugs as spawned
  state.bugsSpawned += 2;

  const pos1 = randomPosition();
  const pos2 = randomPosition();

  const bug1: BugEntity = {
    id: id1, x: pos1.x, y: pos1.y, _timers: createTimerBag(),
    mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };
  const bug2: BugEntity = {
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
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const damage = MERGE_CONFLICT_CONFIG.doubleDamage ? diffConfig.hpDamage * 2 : diffConfig.hpDamage;
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

function spawnPipelineChain(ctx: GameContext, cfg: { escapeTime: number; maxOnScreen: number; bugsTotal: number; spawnRate: number }, chainLength: number): void {
  const { lobbyId, state, counters } = ctx;
  const chainId = 'chain_' + (counters.nextChainId++);
  const escapeTime = cfg.escapeTime * PIPELINE_BUG_CONFIG.escapeTimeMultiplier;
  const pad = 40;

  state.bugsSpawned += chainLength;

  // Position bugs in a snake-like line
  const startPos = randomPosition();
  const angle = Math.random() * Math.PI * 2;
  const spacing = 40;

  const bugIds: string[] = [];
  const chainBugs: BugEntity[] = [];
  for (let i = 0; i < chainLength; i++) {
    const id = 'bug_' + (counters.nextBugId++);
    const x = Math.max(pad, Math.min(LOGICAL_W - pad, startPos.x + Math.cos(angle) * spacing * i));
    const y = Math.max(pad, Math.min(LOGICAL_H - pad, startPos.y + Math.sin(angle) * spacing * i));
    const bug: BugEntity = {
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
    const oldPos: Record<string, { x: number; y: number }> = {};
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
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    // Clear chain wander from head bug
    const hBug = state.bugs[chain.headBugId];
    if (hBug) hBug._timers.clear('chainWander');
    const remaining = bugIds.filter(bid => state.bugs[bid]);
    if (remaining.length === 0) return;
    const damage = diffConfig.hpDamage * remaining.length;
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

export function spawnMinion(ctx: GameContext): void {
  const { state } = ctx;
  if (state.phase !== 'boss') return;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  const maxOnScreen = bossModule.getEffectiveMaxOnScreen(ctx);

  // Roll for feature variant during boss phase
  let variant: Partial<BugEntity> | null = null;
  if (Math.random() < diffConfig.specialBugs.codeReviewChance * 0.67) { // slightly lower during boss
    variant = { isFeature: true };
  }

  spawnEntity(ctx, {
    phaseCheck: 'boss',
    maxOnScreen,
    escapeTime: diffConfig.boss.minionEscapeTime,
    isMinion: true,
    onEscapeCheck: () => game.checkBossGameState(ctx),
    variant,
  });
}

export function clearAllBugs(ctx: GameContext): void {
  const { state } = ctx;
  for (const id of Object.keys(state.bugs)) {
    state.bugs[id]._timers.clearAll();
  }
  state.bugs = {};
  state.pipelineChains = {};
}

export function clearSpawnTimer(ctx: GameContext): void {
  if (ctx.timers.spawnTimer) {
    clearInterval(ctx.timers.spawnTimer);
    ctx.timers.spawnTimer = null;
  }
}

export function startSpawning(ctx: GameContext, rate: number): void {
  ctx.timers.spawnTimer = setInterval(() => spawnBug(ctx), rate);
  spawnBug(ctx);
}

export { spawnBug, spawnMergeConflict, spawnEntity };
