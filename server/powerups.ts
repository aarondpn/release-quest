import { getDifficultyConfig } from './config.ts';
import { randomPosition } from './state.ts';
import * as boss from './boss.ts';
import { getDescriptor } from './entity-types/index.ts';
import type { GameContext } from './types.ts';

export function startDuckSpawning(ctx: GameContext): void {
  scheduleDuckSpawn(ctx);
}

function scheduleDuckSpawn(ctx: GameContext): void {
  const diffConfig = getDifficultyConfig(ctx.state.difficulty);
  const delay = diffConfig.powerups.rubberDuckIntervalMin +
    Math.random() * (diffConfig.powerups.rubberDuckIntervalMax - diffConfig.powerups.rubberDuckIntervalMin);
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
  state.score += diffConfig.powerups.rubberDuckPoints;
  player.score += diffConfig.powerups.rubberDuckPoints;

  state.rubberDuck = null;

  // Start buff
  state.duckBuff = { expiresAt: Date.now() + diffConfig.powerups.rubberDuckBuffDuration };

  ctx.events.emit({
    type: 'duck-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    buffDuration: diffConfig.powerups.rubberDuckBuffDuration,
  });

  ctx.timers.lobby.setTimeout('duckBuff', () => {
    state.duckBuff = null;
    ctx.events.emit({ type: 'duck-buff-expired' });
  }, diffConfig.powerups.rubberDuckBuffDuration);

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
  const delay = diffConfig.powerups.hotfixHammerIntervalMin +
    Math.random() * (diffConfig.powerups.hotfixHammerIntervalMax - diffConfig.powerups.hotfixHammerIntervalMin);
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
  state.score += diffConfig.powerups.hotfixHammerPoints;
  player.score += diffConfig.powerups.hotfixHammerPoints;

  state.hotfixHammer = null;

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
    stunDuration: diffConfig.powerups.hotfixHammerStunDuration,
  });

  // Resume bugs after stun
  ctx.timers.lobby.setTimeout('hammerStun', () => {
    state.hammerStunActive = false;
    resumeAllBugs(ctx);
    resumeBoss(ctx);
    ctx.events.emit({ type: 'hammer-stun-expired' });
  }, diffConfig.powerups.hotfixHammerStunDuration);

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
}

export function resumeBoss(ctx: GameContext): void {
  const { state } = ctx;
  if (!state.boss || state.phase !== 'boss') return;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;

  if (state.boss._wanderPaused) {
    const wanderInterval = state.boss.enraged ? bossConfig.enrageWanderInterval : bossConfig.wanderInterval;
    boss.setupBossWander(ctx, wanderInterval);
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
