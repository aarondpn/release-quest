const { RUBBER_DUCK_CONFIG, BUG_POINTS } = require('./config');
const { randomPosition } = require('./state');
const network = require('./network');

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

module.exports = { startDuckSpawning, collectDuck, isDuckBuffActive, clearDuck };
