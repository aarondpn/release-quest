import { ELITE_CONFIG, ELITE_AMBIENT_CONFIG, ROGUELIKE_CONFIG, getDifficultyConfig } from './config.ts';
import { LOGICAL_W, LOGICAL_H } from '../shared/constants.ts';
import { randomPosition, getPlayerScores } from './state.ts';
import { createTimerBag } from './timer-bag.ts';
import { spawnEntity, spawnEliteMinion, clearAllMinions } from './bugs.ts';
import { getKevlarDamageMultiplier } from './shop.ts';
import { mulberry32, hashString } from './rng.ts';
import * as game from './game.ts';
import * as roguelike from './roguelike.ts';
import logger from './logger.ts';
import type { GameContext, EliteConfig, BugEntity, LevelConfigEntry } from './types.ts';

// ── Elite selection ──

export const ELITE_KEYS = Object.keys(ELITE_CONFIG.types);

export function pickElite(seed: number, nodeId: string): string {
  const combined = seed + hashString(nodeId);
  const rng = mulberry32(combined);
  return ELITE_KEYS[Math.floor(rng() * ELITE_KEYS.length)];
}

// ── Elite lifecycle ──

export function startElite(ctx: GameContext, nodeId: string): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  const eliteType = pickElite(state.roguelikeMap.seed, nodeId);
  const node = state.roguelikeMap.nodes.find(n => n.id === nodeId);
  state.level = node ? node.row + 1 : 1;

  startEliteInternal(ctx, eliteType);
}

export function startEliteDirect(ctx: GameContext, eliteType: string): void {
  const { state } = ctx;
  state.level = 1;
  startEliteInternal(ctx, eliteType);
}

function startEliteInternal(ctx: GameContext, eliteType: string): void {
  const { state } = ctx;
  const typeDef = ELITE_CONFIG.types[eliteType];
  if (!typeDef) return;

  const eliteConfig: EliteConfig = {
    eliteType,
    title: typeDef.title,
    icon: typeDef.icon,
    description: typeDef.description,
    scoreMultiplier: typeDef.scoreMultiplier,
    hpDamageMultiplier: typeDef.hpDamageMultiplier,
    wavesTotal: typeDef.wavesTotal,
    wavesSpawned: 0,
  };
  state.eliteConfig = eliteConfig;

  ctx.lifecycle.transition(state, 'playing');

  ctx.events.emit({
    type: 'game-start',
    level: state.level,
    hp: state.hp,
    score: state.score,
    players: getPlayerScores(state),
  });

  ctx.events.emit({
    type: 'elite-start',
    eliteType,
    title: typeDef.title,
    icon: typeDef.icon,
    description: typeDef.description,
    scoreMultiplier: typeDef.scoreMultiplier,
    waveIndex: 0,
    wavesTotal: typeDef.wavesTotal,
  });

  logger.info({ lobbyId: ctx.lobbyId, eliteType, title: typeDef.title }, 'Elite encounter started');

  // Brief delay for banner display, then spawn elite wave
  ctx.timers.lobby.setTimeout('eliteWaveStart', () => {
    spawnEliteWave(ctx);
  }, 2200);
}

function spawnEliteWave(ctx: GameContext): void {
  const { state } = ctx;
  const elite = state.eliteConfig;
  if (!elite) return;

  elite.wavesSpawned++;

  const row = state.level as keyof typeof ROGUELIKE_CONFIG.rowScaling;
  const baseCfg = ROGUELIKE_CONFIG.rowScaling[row] || ROGUELIKE_CONFIG.rowScaling[5];

  switch (elite.eliteType) {
    case 'super-heisenbug':
      spawnSuperHeisenbug(ctx, baseCfg);
      break;
    case 'mega-pipeline':
      spawnMegaPipeline(ctx, baseCfg);
      break;
    case 'memory-leak-cluster':
      spawnMemoryLeakCluster(ctx, baseCfg);
      break;
    case 'merge-conflict-chain':
      spawnMergeConflictWave(ctx, baseCfg, elite.wavesSpawned);
      break;
    default:
      game.startLevel(ctx);
  }

  // Start ambient minion spawning after grace period
  ctx.timers.lobby.setTimeout('eliteAmbientGrace', () => {
    ctx.timers.lobby.setInterval('eliteAmbientSpawn', () => {
      spawnEliteMinion(ctx);
    }, ELITE_AMBIENT_CONFIG.spawnRate);
  }, ELITE_AMBIENT_CONFIG.gracePeriod);
}

// ── Elite wave check (called from checkGameState) ──

export function onEliteWaveCheck(ctx: GameContext): void {
  const { state } = ctx;
  const elite = state.eliteConfig;
  if (!elite) return;

  // Clean up ambient minion timers and minions between waves
  ctx.timers.lobby.clear('eliteAmbientSpawn');
  ctx.timers.lobby.clear('eliteAmbientGrace');
  clearAllMinions(ctx);

  if (elite.wavesSpawned < elite.wavesTotal) {
    // More waves to go — brief pause then next wave
    ctx.timers.lobby.setTimeout('eliteNextWave', () => {
      spawnEliteWave(ctx);
    }, 1500);
  } else {
    // All waves complete
    completeElite(ctx);
  }
}

function completeElite(ctx: GameContext): void {
  const { state } = ctx;
  const elite = state.eliteConfig;
  if (!elite) return;

  // Ambient cleanup already done by onEliteWaveCheck which calls this

  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;

  logger.info({ lobbyId: ctx.lobbyId, eliteType: elite.eliteType }, 'Elite encounter completed');

  ctx.events.emit({
    type: 'encounter-reward',
    encounterType: 'elite',
    title: elite.title,
    scoreGained: 0,
    freeItem: null,
    totalScore: state.score,
    soloMode,
  });

  if (state.playground) {
    state.eliteConfig = undefined;
    ctx.timers.lobby.setTimeout('playgroundReturn', () => {
      ctx.lifecycle.transition(state, 'lobby');
      ctx.events.emit({ type: 'playground-ready' });
    }, 1500);
    return;
  }

  const delay = soloMode ? 100 : 5000;
  ctx.timers.lobby.setTimeout('eliteRewardDone', () => {
    state.eliteConfig = undefined;
    roguelike.handleNodeComplete(ctx);
  }, delay);
}

export function handleEncounterRewardContinue(ctx: GameContext): void {
  const { state } = ctx;
  // Guard: only proceed if an encounter reward is actually pending
  if (!state.eliteConfig && !state.miniBoss) return;

  ctx.timers.lobby.clear('eliteRewardDone');
  ctx.timers.lobby.clear('miniBossRewardDone');
  ctx.timers.lobby.clear('playgroundReturn');

  state.eliteConfig = undefined;
  state.miniBoss = undefined;

  if (state.playground) {
    ctx.lifecycle.transition(state, 'lobby');
    ctx.events.emit({ type: 'playground-ready' });
    return;
  }

  roguelike.handleNodeComplete(ctx);
}

// ── Elite type: Super-Heisenbug ──

function spawnSuperHeisenbug(ctx: GameContext, baseCfg: LevelConfigEntry): void {
  const { state } = ctx;
  state.bugsRemaining = 1;
  state.bugsSpawned = 1;

  const escapeTime = baseCfg.escapeTime * 0.7;
  const variant: Partial<BugEntity> = {
    isHeisenbug: true,
    fleesRemaining: 5,
  };

  spawnEntity(ctx, {
    phaseCheck: 'playing',
    maxOnScreen: 10,
    escapeTime,
    isMinion: false,
    onEscapeCheck: () => game.checkGameState(ctx),
    variant,
  });

  // Spawn 2 decoy ghosts — routed through spawnEntity so they get full entity lifecycle
  for (let i = 0; i < 2; i++) {
    spawnEntity(ctx, {
      phaseCheck: 'playing',
      maxOnScreen: 10,
      escapeTime: escapeTime * 1.5,
      isMinion: true,
      onEscapeCheck: () => game.checkGameState(ctx),
      variant: { isHeisenbug: true, isDecoy: true, fleesRemaining: 0, lastFleeTime: 0 },
    });
  }
}

// ── Elite type: Mega-Pipeline ──

const MAX_PIPELINE_REGENS = 2;

function spawnMegaPipeline(ctx: GameContext, baseCfg: LevelConfigEntry): void {
  const { state, counters } = ctx;
  const elite = state.eliteConfig;
  const chainLength = 8;
  state.bugsRemaining = chainLength;
  state.bugsSpawned = chainLength;

  if (elite) {
    if (!elite.data) elite.data = {};
    elite.data.pipelineRegens = 0;
  }

  const chainId = 'chain_' + (counters.nextChainId++);
  const escapeTime = baseCfg.escapeTime * 2.0;
  const pad = 40;
  const spacing = 40;

  const startPos = randomPosition();
  const angle = Math.random() * Math.PI * 2;

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

  const snakeSpeed = 30;
  const snakeTickMs = 350;
  const margin = 100;

  const headBug = chainBugs[0];
  headBug._timers.setInterval('chainWander', () => {
    if (state.phase !== 'playing' || state.hammerStunActive) return;
    const chain = state.pipelineChains[chainId];
    if (!chain) { headBug._timers.clear('chainWander'); return; }
    const alive = chain.bugIds.filter(bid => state.bugs[bid]);
    if (alive.length === 0) { headBug._timers.clear('chainWander'); return; }

    const oldPos: Record<string, { x: number; y: number }> = {};
    for (const bid of alive) {
      const b = state.bugs[bid];
      oldPos[bid] = { x: b.x, y: b.y };
    }

    chain.snakeAngle += (Math.random() - 0.5) * 0.5;

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

    for (let i = 1; i < alive.length; i++) {
      const b = state.bugs[alive[i]];
      b.x = oldPos[alive[i - 1]].x;
      b.y = oldPos[alive[i - 1]].y;
    }

    for (const bid of alive) {
      const b = state.bugs[bid];
      ctx.events.emit({ type: 'bug-wander', bugId: bid, x: b.x, y: b.y });
    }
  }, snakeTickMs);

  state.pipelineChains[chainId] = {
    bugIds, nextIndex: 0, length: chainLength,
    headBugId: headBug.id,
    snakeAngle: angle + Math.PI,
  };

  for (const bug of chainBugs) {
    ctx.events.emit({ type: 'bug-spawned', bug: {
      id: bug.id, x: bug.x, y: bug.y,
      isPipeline: true, chainId, chainIndex: bug.chainIndex, chainLength,
    }});
  }

  const escapeHandler = () => {
    const chain = state.pipelineChains[chainId];
    if (!chain) return;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const hBug = state.bugs[chain.headBugId];
    if (hBug) hBug._timers.clear('chainWander');
    const remaining = bugIds.filter(bid => state.bugs[bid]);
    if (remaining.length === 0) return;
    let damage = diffConfig.hpDamage * remaining.length;
    damage = Math.ceil(damage * getKevlarDamageMultiplier(ctx));
    if (state.eliteConfig) damage = Math.ceil(damage * state.eliteConfig.hpDamageMultiplier);
    for (const bid of remaining) {
      if (state.bugs[bid]) {
        state.bugs[bid]._timers.clearAll();
        delete state.bugs[bid];
      }
    }
    delete state.pipelineChains[chainId];
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    ctx.events.emit({
      type: 'pipeline-chain-escaped', chainId, bugIds: remaining, hp: state.hp,
    });
    game.checkGameState(ctx);
  };

  for (const bug of chainBugs) {
    bug._onEscape = escapeHandler;
  }

  headBug._timers.setTimeout('escape', escapeHandler, escapeTime);
  for (const bug of chainBugs) {
    if (bug !== headBug) bug._sharedEscapeWith = headBug.id;
  }

  // Pipeline regen: triggered by pipeline descriptor onClick when a segment is killed
  if (elite) {
    const chain = state.pipelineChains[chainId];
    chain.onSegmentKilled = () => {
      if ((elite.data!.pipelineRegens as number) >= MAX_PIPELINE_REGENS) return;
      if (state.phase !== 'playing') return;
      elite.data!.pipelineRegens = (elite.data!.pipelineRegens as number) + 1;
      const regenIndex = elite.data!.pipelineRegens as number;
      headBug._timers.setTimeout(`regen_${regenIndex}`, () => {
        const ch = state.pipelineChains[chainId];
        if (!ch || state.phase !== 'playing') return;
        const alive = ch.bugIds.filter(bid => state.bugs[bid]);
        if (alive.length === 0) return;

        // Spawn new segment at tail position
        const tailBug = state.bugs[alive[alive.length - 1]];
        if (!tailBug) return;
        const newId = 'bug_' + (counters.nextBugId++);
        const newBug: BugEntity = {
          id: newId, x: tailBug.x, y: tailBug.y,
          _timers: createTimerBag(),
          isPipeline: true, chainId, chainIndex: ch.bugIds.length, chainLength: ch.bugIds.length + 1,
          escapeTime, escapeStartedAt: Date.now(),
        };
        state.bugs[newId] = newBug;
        ch.bugIds.push(newId);
        state.bugsRemaining++;

        newBug._onEscape = escapeHandler;
        newBug._sharedEscapeWith = headBug.id;

        ctx.events.emit({ type: 'bug-spawned', bug: {
          id: newId, x: newBug.x, y: newBug.y,
          isPipeline: true, chainId, chainIndex: newBug.chainIndex, chainLength: ch.bugIds.length,
        }});
      }, 4000);
    };
  }
}

// ── Elite type: Memory Leak Cluster ──

function spawnMemoryLeakCluster(ctx: GameContext, baseCfg: LevelConfigEntry): void {
  const { state } = ctx;
  const elite = state.eliteConfig;
  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;

  // Solo: 2 leaks with more escape time (hold mechanic requires undivided attention)
  // Multi: 3 leaks at normal pace
  const count = soloMode ? 2 : 3;
  const escapeTime = baseCfg.escapeTime * (soloMode ? 2.0 : 1.3);
  const maxTotal = soloMode ? 4 : 5;

  state.bugsRemaining = count;
  state.bugsSpawned = count;

  if (elite) {
    if (!elite.data) elite.data = {};
    elite.data.leakDuplications = 0;
  }

  // Capture bug counter before spawning so we can derive the IDs deterministically
  const firstBugNum = ctx.counters.nextBugId;

  for (let i = 0; i < count; i++) {
    const variant: Partial<BugEntity> = {
      isMemoryLeak: true,
      growthStage: 0,
    };
    spawnEntity(ctx, {
      phaseCheck: 'playing',
      maxOnScreen: count + 1,
      escapeTime,
      isMinion: false,
      onEscapeCheck: () => game.checkGameState(ctx),
      variant,
    });
  }

  // Schedule duplication for each original after 6s
  if (elite) {
    const spawnedBugIds: string[] = [];
    for (let i = firstBugNum; i < ctx.counters.nextBugId; i++) {
      spawnedBugIds.push('bug_' + i);
    }

    for (const origId of spawnedBugIds) {
      ctx.timers.lobby.setTimeout(`leakDup_${origId}`, () => {
        if (!state.eliteConfig || state.phase !== 'playing') return;
        const orig = state.bugs[origId];
        if (!orig || !orig.isMemoryLeak) return;

        // Count current memory leaks (non-minion)
        const currentLeaks = Object.values(state.bugs).filter(b => b.isMemoryLeak).length;
        if (currentLeaks >= maxTotal) return;

        // Spawn duplicate
        const remainingTime = Math.max(1000, (orig.escapeTime - (Date.now() - orig.escapeStartedAt)) * 0.7);
        const dupVariant: Partial<BugEntity> = {
          isMemoryLeak: true,
          growthStage: orig.growthStage || 0,
        };
        spawnEntity(ctx, {
          phaseCheck: 'playing',
          maxOnScreen: maxTotal + ELITE_AMBIENT_CONFIG.maxOnScreen + 1,
          escapeTime: remainingTime,
          isMinion: false,
          onEscapeCheck: () => game.checkGameState(ctx),
          variant: dupVariant,
        });
        state.bugsRemaining++;
        state.bugsSpawned++;
        elite.data!.leakDuplications = ((elite.data!.leakDuplications as number) || 0) + 1;
      }, 6000);
    }
  }
}

// ── Elite type: Merge Conflict Chain ──

function spawnMergeConflictWave(ctx: GameContext, baseCfg: LevelConfigEntry, waveNum: number): void {
  const { state, counters } = ctx;
  const elite = state.eliteConfig;

  state.bugsRemaining = 2;
  state.bugsSpawned = 2;

  // Init merge teleport tracking data
  if (elite) {
    if (!elite.data) elite.data = {};
    const waveKey = `mergeTeleports_wave${waveNum}`;
    elite.data[waveKey] = 0;
  }

  const escapeTime = baseCfg.escapeTime * 1.2;

  const conflictId = 'conflict_' + (counters.nextConflictId++);
  const id1 = 'bug_' + (counters.nextBugId++);
  const id2 = 'bug_' + (counters.nextBugId++);

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

  ctx.events.emit({ type: 'bug-spawned', bug: {
    id: id1, x: bug1.x, y: bug1.y, mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
  }});
  ctx.events.emit({ type: 'bug-spawned', bug: {
    id: id2, x: bug2.x, y: bug2.y, mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
  }});

  bug1._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id1]) return;
    const np = randomPosition();
    bug1.x = np.x; bug1.y = np.y;
    ctx.events.emit({ type: 'bug-wander', bugId: id1, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  bug2._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id2]) return;
    const np = randomPosition();
    bug2.x = np.x; bug2.y = np.y;
    ctx.events.emit({ type: 'bug-wander', bugId: id2, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  const escapeHandler = () => {
    if (!state.bugs[id1] && !state.bugs[id2]) return;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    let damage = diffConfig.hpDamage * 2;
    damage = Math.ceil(damage * getKevlarDamageMultiplier(ctx));
    if (state.eliteConfig) damage = Math.ceil(damage * state.eliteConfig.hpDamageMultiplier);
    if (state.bugs[id1]) { bug1._timers.clearAll(); delete state.bugs[id1]; }
    if (state.bugs[id2]) { bug2._timers.clearAll(); delete state.bugs[id2]; }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    ctx.events.emit({ type: 'merge-conflict-escaped', bugId: id1, partnerId: id2, hp: state.hp });
    game.checkGameState(ctx);
  };

  bug1._onEscape = escapeHandler;
  bug2._onEscape = escapeHandler;
  bug1._timers.setTimeout('escape', escapeHandler, escapeTime);
  bug2._sharedEscapeWith = id1;
}
