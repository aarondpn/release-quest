import { getDifficultyConfig } from './config.ts';
import { randomPosition, currentLevelConfig } from './state.ts';
import { createTimerBag } from './timer-bag.ts';
import { getDescriptor, getType, getPlugins } from './entity-types/index.ts';
import { hasAnyPlayerBuff } from './shop.ts';
import * as game from './game.ts';
import * as bossModule from './boss.ts';
import type { GameContext, BugEntity, SpawnEntityOptions } from './types.ts';

function spawnEntity(ctx: GameContext, opts: SpawnEntityOptions): boolean {
  const { state, counters } = ctx;
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
  if (bug.isFeature && hasAnyPlayerBuff(ctx, 'eagle-eye')) broadcastPayload.eagleEye = true;

  ctx.events.emit({ type: 'bug-spawned', bug: broadcastPayload });

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
  const { state } = ctx;
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig(state);
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (state.bugsSpawned >= cfg.bugsTotal) {
    if (ctx.matchLog) {
      ctx.matchLog.log('spawn-skip', { reason: 'all-spawned', bugsSpawned: state.bugsSpawned, bugsTotal: cfg.bugsTotal });
    }
    return;
  }

  const plugins = getPlugins();
  const specialBugs = diffConfig.specialBugs;

  // Multi-entity types first
  for (const p of plugins) {
    if (p.spawn.mode !== 'multi') continue;
    if (p.spawn.startLevelKey && state.level < specialBugs[p.spawn.startLevelKey]) continue;
    if (Math.random() >= specialBugs[p.spawn.chanceKey]) continue;
    if (p.spawn.trySpawn(ctx, cfg)) return;
  }

  // Single-entity variants
  let variant: Partial<BugEntity> | null = null;
  let escapeTimeMultiplier = 1;
  for (const p of plugins) {
    if (p.spawn.mode !== 'single') continue;
    if (p.spawn.startLevelKey && state.level < specialBugs[p.spawn.startLevelKey]) continue;
    if (Math.random() >= specialBugs[p.spawn.chanceKey]) continue;
    if (p.spawn.canSpawn && !p.spawn.canSpawn(ctx)) continue;
    variant = p.spawn.createVariant(ctx);
    escapeTimeMultiplier = p.escapeTimeMultiplier ?? 1;
    break;
  }

  const spawned = spawnEntity(ctx, {
    phaseCheck: 'playing',
    maxOnScreen: cfg.maxOnScreen,
    escapeTime: cfg.escapeTime * escapeTimeMultiplier,
    isMinion: false,
    onEscapeCheck: () => game.checkGameState(ctx),
    variant,
  });
  if (spawned) state.bugsSpawned++;
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

export function clearAllMinions(ctx: GameContext): void {
  const { state } = ctx;
  const minionIds = Object.keys(state.bugs).filter(id => state.bugs[id].isMinion);
  for (const id of minionIds) {
    state.bugs[id]._timers.clearAll();
    delete state.bugs[id];
  }
  if (minionIds.length > 0) {
    ctx.events.emit({ type: 'minions-cleared', bugIds: minionIds });
  }
}

export function spawnMinionAtPosition(ctx: GameContext, x: number, y: number): void {
  const { state, counters } = ctx;
  if (state.phase !== 'boss') return;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);

  const id = 'bug_' + (counters.nextBugId++);
  const bug: BugEntity = {
    id, x, y,
    _timers: createTimerBag(),
    escapeTime: diffConfig.boss.minionEscapeTime,
    escapeStartedAt: Date.now(),
    isMinion: true,
  };

  state.bugs[id] = bug;

  const descriptor = getDescriptor(bug);
  descriptor.init(bug, ctx, { phaseCheck: 'boss' });

  const broadcastPayload: Record<string, unknown> = { id, x: bug.x, y: bug.y, isMinion: true };
  Object.assign(broadcastPayload, descriptor.broadcastFields(bug));
  ctx.events.emit({ type: 'bug-spawned', bug: broadcastPayload });

  descriptor.setupTimers(bug, ctx);
  descriptor.createWander(bug, ctx);

  bug._onEscape = () => {
    if (!state.bugs[id]) return;
    descriptor.onEscape(bug, ctx, () => game.checkBossGameState(ctx));
  };
  bug._timers.setTimeout('escape', bug._onEscape, diffConfig.boss.minionEscapeTime);
}

export function clearSpawnTimer(ctx: GameContext): void {
  ctx.timers.lobby.clear('spawnTimer');
}

export function startSpawning(ctx: GameContext, rate: number): void {
  ctx.timers.lobby.setInterval('spawnTimer', () => spawnBug(ctx), rate);
  spawnBug(ctx);
}

export { spawnBug, spawnEntity };
