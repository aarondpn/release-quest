import { getDifficultyConfig } from './config.ts';
import { randomPosition, awardScore } from './state.ts';
import * as boss from './boss.ts';
import * as roles from './roles.ts';
import { getDescriptor } from './entity-types/index.ts';
import { hasAnyPlayerBuff } from './shop.ts';
import type { GameContext } from './types.ts';

export function startDuckSpawning(ctx: GameContext): void {
  scheduleDuckSpawn(ctx);
}

function scheduleDuckSpawn(ctx: GameContext): void {
  const diffConfig = getDifficultyConfig(ctx.state.difficulty);
  const spawnMultiplier = roles.getTeamPowerupSpawnMultiplier(ctx.state);
  let delay = (diffConfig.powerups.rubberDuckIntervalMin +
    Math.random() * (diffConfig.powerups.rubberDuckIntervalMax - diffConfig.powerups.rubberDuckIntervalMin)) * spawnMultiplier;
  if (hasAnyPlayerBuff(ctx, 'turbo-duck')) delay *= 0.5;
  delay = Math.round(delay);
  ctx.timers.lobby.setTimeout('duckSpawn', () => spawnDuck(ctx), delay);
}

function spawnDuck(ctx: GameContext): void {
  const { state, counters } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (state.phase !== 'playing' && state.phase !== 'boss') {
    scheduleDuckSpawn(ctx);
    return;
  }
  if (state.rubberDuck) return; // one at a time

  const id = 'duck_' + (counters.nextDuckId++);
  const pos = randomPosition();

  state.rubberDuck = { id, x: pos.x, y: pos.y };

  ctx.events.emit({
    type: 'duck-spawn',
    duck: { id, x: pos.x, y: pos.y },
  });

  // Wander
  ctx.timers.lobby.setInterval('duckWander', () => {
    if (!state.rubberDuck) return;
    const np = randomPosition();
    state.rubberDuck.x = np.x;
    state.rubberDuck.y = np.y;
    ctx.events.emit({ type: 'duck-wander', x: np.x, y: np.y });
  }, diffConfig.powerups.rubberDuckWanderInterval);

  // Despawn after timeout
  ctx.timers.lobby.setTimeout('duckDespawn', () => {
    if (!state.rubberDuck) return;
    ctx.timers.lobby.clear('duckWander');
    state.rubberDuck = null;
    ctx.events.emit({ type: 'duck-despawn' });
    scheduleDuckSpawn(ctx);
  }, diffConfig.powerups.rubberDuckDespawnTime);
}

export function collectDuck(ctx: GameContext, pid: string): void {
  const { state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (!state.rubberDuck) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear duck timers
  ctx.timers.lobby.clear('duckWander');
  ctx.timers.lobby.clear('duckDespawn');

  // Award points
  awardScore(ctx, pid, diffConfig.powerups.rubberDuckPoints);

  state.rubberDuck = null;

  // DevOps passive: extend buff duration
  const durationMultiplier = roles.getPowerupDurationMultiplier(state, pid);
  const buffDuration = Math.round(diffConfig.powerups.rubberDuckBuffDuration * durationMultiplier);

  // Start buff
  state.duckBuff = { expiresAt: Date.now() + buffDuration };

  ctx.events.emit({
    type: 'duck-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    buffDuration,
  });

  ctx.timers.lobby.setTimeout('duckBuff', () => {
    state.duckBuff = null;
    ctx.events.emit({ type: 'duck-buff-expired' });
  }, buffDuration);

  // Schedule next duck
  scheduleDuckSpawn(ctx);
}

export function isDuckBuffActive(ctx: GameContext): boolean {
  const { state } = ctx;
  return !!(state.duckBuff && Date.now() < state.duckBuff.expiresAt);
}

export function clearDuck(ctx: GameContext): void {
  const { state } = ctx;
  ctx.timers.lobby.clear('duckSpawn');
  ctx.timers.lobby.clear('duckWander');
  ctx.timers.lobby.clear('duckDespawn');
  ctx.timers.lobby.clear('duckBuff');
  state.rubberDuck = null;
  state.duckBuff = null;
}

// ── Hotfix Hammer ──

export function startHammerSpawning(ctx: GameContext): void {
  scheduleHammerSpawn(ctx);
}

function scheduleHammerSpawn(ctx: GameContext): void {
  const diffConfig = getDifficultyConfig(ctx.state.difficulty);
  const spawnMultiplier = roles.getTeamPowerupSpawnMultiplier(ctx.state);
  const delay = Math.round((diffConfig.powerups.hotfixHammerIntervalMin +
    Math.random() * (diffConfig.powerups.hotfixHammerIntervalMax - diffConfig.powerups.hotfixHammerIntervalMin)) * spawnMultiplier);
  ctx.timers.lobby.setTimeout('hammerSpawn', () => spawnHammer(ctx), delay);
}

function spawnHammer(ctx: GameContext): void {
  const { state, counters } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (state.phase !== 'playing' && state.phase !== 'boss') {
    scheduleHammerSpawn(ctx);
    return;
  }
  if (state.hotfixHammer) return; // one at a time

  const id = 'hammer_' + (counters.nextHammerId++);
  const pos = randomPosition();

  state.hotfixHammer = { id, x: pos.x, y: pos.y };

  ctx.events.emit({
    type: 'hammer-spawn',
    hammer: { id, x: pos.x, y: pos.y },
  });

  // Despawn after timeout
  ctx.timers.lobby.setTimeout('hammerDespawn', () => {
    if (!state.hotfixHammer) return;
    state.hotfixHammer = null;
    ctx.events.emit({ type: 'hammer-despawn' });
    scheduleHammerSpawn(ctx);
  }, diffConfig.powerups.hotfixHammerDespawnTime);
}

export function collectHammer(ctx: GameContext, pid: string): void {
  const { state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (!state.hotfixHammer) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear hammer timers
  ctx.timers.lobby.clear('hammerDespawn');

  // Award points
  awardScore(ctx, pid, diffConfig.powerups.hotfixHammerPoints);

  state.hotfixHammer = null;

  // DevOps passive: extend stun duration
  const durationMultiplier = roles.getPowerupDurationMultiplier(state, pid);
  const stunDuration = Math.round(diffConfig.powerups.hotfixHammerStunDuration * durationMultiplier);

  // Stun all bugs and boss
  state.hammerStunActive = true;
  stunAllBugs(ctx);
  stunBoss(ctx);

  ctx.events.emit({
    type: 'hammer-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    stunDuration,
  });

  // Resume bugs after stun
  ctx.timers.lobby.setTimeout('hammerStun', () => {
    state.hammerStunActive = false;
    resumeAllBugs(ctx);
    resumeBoss(ctx);
    ctx.events.emit({ type: 'hammer-stun-expired' });
  }, stunDuration);

  // Schedule next hammer
  scheduleHammerSpawn(ctx);
}

function stunAllBugs(ctx: GameContext): void {
  const { state } = ctx;
  for (const bugId in state.bugs) {
    const bug = state.bugs[bugId];
    getDescriptor(bug).onStun(bug, ctx);
  }
}

function resumeAllBugs(ctx: GameContext): void {
  const { state } = ctx;
  for (const bugId in state.bugs) {
    const bug = state.bugs[bugId];
    if (!bug.isStunned) continue;
    getDescriptor(bug).onResume(bug, ctx);
  }
}

export function stunBoss(ctx: GameContext): void {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;

  // Pause boss wandering and minion spawning via TimerBag
  if (ctx.timers.boss.has('bossWander')) {
    ctx.timers.boss.clear('bossWander');
    state.boss._wanderPaused = true;
  }
  if (ctx.timers.boss.has('bossMinionSpawn')) {
    ctx.timers.boss.clear('bossMinionSpawn');
    state.boss._minionSpawnPaused = true;
  }

  // Notify active plugin of stun
  const plugin = boss.getActivePlugin();
  if (plugin) plugin.onStun(ctx);
}

export function resumeBoss(ctx: GameContext): void {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;

  // Notify active plugin of resume (adjusts shield/wipe timings)
  const plugin = boss.getActivePlugin();
  if (plugin) plugin.onResume(ctx);

  if (state.boss._wanderPaused) {
    // Phase 3 mega-bug anchors to center — don't resume wandering
    const data = state.boss.data;
    const isAnchored = data.phase === 3;
    if (!isAnchored) {
      const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
      const wanderInterval = (data.phase === 2)
        ? bossConfig.bossPhases.phase2WanderInterval
        : bossConfig.wanderInterval;
      boss.setupBossWander(ctx, wanderInterval);
    }
    state.boss._wanderPaused = false;
  }

  if (state.boss._minionSpawnPaused) {
    const spawnRate = boss.getEffectiveSpawnRate(ctx);
    boss.setupMinionSpawning(ctx, spawnRate);
    state.boss._minionSpawnPaused = false;
  }
}

export function clearHammer(ctx: GameContext): void {
  const { state } = ctx;
  ctx.timers.lobby.clear('hammerSpawn');
  ctx.timers.lobby.clear('hammerDespawn');
  ctx.timers.lobby.clear('hammerStun');
  state.hotfixHammer = null;
  state.hammerStunActive = false;
}
