import { getDifficultyConfig } from './config.ts';
import { randomPosition } from './state.ts';
import * as network from './network.ts';
import * as boss from './boss.ts';
import { getDescriptor } from './entity-types.ts';
import type { GameContext } from './types.ts';

export function startDuckSpawning(ctx: GameContext): void {
  scheduleDuckSpawn(ctx);
}

function scheduleDuckSpawn(ctx: GameContext): void {
  const diffConfig = getDifficultyConfig(ctx.state.difficulty);
  const delay = diffConfig.powerups.rubberDuckIntervalMin +
    Math.random() * (diffConfig.powerups.rubberDuckIntervalMax - diffConfig.powerups.rubberDuckIntervalMin);
  ctx.timers.duckSpawn = setTimeout(() => spawnDuck(ctx), delay);
}

function spawnDuck(ctx: GameContext): void {
  const { lobbyId, state, counters } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
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
  }, diffConfig.powerups.rubberDuckWanderInterval);

  // Despawn after timeout
  ctx.timers.duckDespawn = setTimeout(() => {
    if (!state.rubberDuck) return;
    if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
    state.rubberDuck = null;
    network.broadcastToLobby(lobbyId, { type: 'duck-despawn' });
    scheduleDuckSpawn(ctx);
  }, diffConfig.powerups.rubberDuckDespawnTime);
}

export function collectDuck(ctx: GameContext, pid: string): void {
  const { lobbyId, state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (!state.rubberDuck) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear duck timers
  if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
  if (ctx.timers.duckDespawn) { clearTimeout(ctx.timers.duckDespawn); ctx.timers.duckDespawn = null; }

  // Award points
  state.score += diffConfig.powerups.rubberDuckPoints;
  player.score += diffConfig.powerups.rubberDuckPoints;

  state.rubberDuck = null;

  // Start buff
  state.duckBuff = { expiresAt: Date.now() + diffConfig.powerups.rubberDuckBuffDuration };

  network.broadcastToLobby(lobbyId, {
    type: 'duck-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    buffDuration: diffConfig.powerups.rubberDuckBuffDuration,
  });

  ctx.timers.duckBuff = setTimeout(() => {
    state.duckBuff = null;
    network.broadcastToLobby(lobbyId, { type: 'duck-buff-expired' });
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
  if (ctx.timers.duckSpawn) { clearTimeout(ctx.timers.duckSpawn); ctx.timers.duckSpawn = null; }
  if (ctx.timers.duckWander) { clearInterval(ctx.timers.duckWander); ctx.timers.duckWander = null; }
  if (ctx.timers.duckDespawn) { clearTimeout(ctx.timers.duckDespawn); ctx.timers.duckDespawn = null; }
  if (ctx.timers.duckBuff) { clearTimeout(ctx.timers.duckBuff); ctx.timers.duckBuff = null; }
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
  ctx.timers.hammerSpawn = setTimeout(() => spawnHammer(ctx), delay);
}

function spawnHammer(ctx: GameContext): void {
  const { lobbyId, state, counters } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
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
  }, diffConfig.powerups.hotfixHammerDespawnTime);
}

export function collectHammer(ctx: GameContext, pid: string): void {
  const { lobbyId, state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  if (!state.hotfixHammer) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear hammer timers
  if (ctx.timers.hammerDespawn) { clearTimeout(ctx.timers.hammerDespawn); ctx.timers.hammerDespawn = null; }

  // Award points
  state.score += diffConfig.powerups.hotfixHammerPoints;
  player.score += diffConfig.powerups.hotfixHammerPoints;

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
    stunDuration: diffConfig.powerups.hotfixHammerStunDuration,
  });

  // Resume bugs after stun
  ctx.timers.hammerStun = setTimeout(() => {
    state.hammerStunActive = false;
    resumeAllBugs(ctx);
    resumeBoss(ctx);
    network.broadcastToLobby(lobbyId, { type: 'hammer-stun-expired' });
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
  if (ctx.timers.hammerSpawn) { clearTimeout(ctx.timers.hammerSpawn); ctx.timers.hammerSpawn = null; }
  if (ctx.timers.hammerDespawn) { clearTimeout(ctx.timers.hammerDespawn); ctx.timers.hammerDespawn = null; }
  if (ctx.timers.hammerStun) { clearTimeout(ctx.timers.hammerStun); ctx.timers.hammerStun = null; }
  state.hotfixHammer = null;
  state.hammerStunActive = false;
}
