const { RUBBER_DUCK_CONFIG, BUG_POINTS } = require('./config');
const { state, counters, randomPosition } = require('./state');
const network = require('./network');

let duckSpawnTimer = null;
let duckWanderTimer = null;
let duckDespawnTimer = null;
let duckBuffTimer = null;

function startDuckSpawning() {
  scheduleDuckSpawn();
}

function scheduleDuckSpawn() {
  const delay = RUBBER_DUCK_CONFIG.spawnIntervalMin +
    Math.random() * (RUBBER_DUCK_CONFIG.spawnIntervalMax - RUBBER_DUCK_CONFIG.spawnIntervalMin);
  duckSpawnTimer = setTimeout(spawnDuck, delay);
}

function spawnDuck() {
  if (state.phase !== 'playing' && state.phase !== 'boss') {
    scheduleDuckSpawn();
    return;
  }
  if (state.rubberDuck) return; // one at a time

  const id = 'duck_' + (counters.nextDuckId++);
  const pos = randomPosition();

  state.rubberDuck = { id, x: pos.x, y: pos.y };

  network.broadcast({
    type: 'duck-spawn',
    duck: { id, x: pos.x, y: pos.y },
  });

  // Wander
  duckWanderTimer = setInterval(() => {
    if (!state.rubberDuck) return;
    const np = randomPosition();
    state.rubberDuck.x = np.x;
    state.rubberDuck.y = np.y;
    network.broadcast({ type: 'duck-wander', x: np.x, y: np.y });
  }, RUBBER_DUCK_CONFIG.wanderInterval);

  // Despawn after timeout
  duckDespawnTimer = setTimeout(() => {
    if (!state.rubberDuck) return;
    clearInterval(duckWanderTimer);
    duckWanderTimer = null;
    state.rubberDuck = null;
    network.broadcast({ type: 'duck-despawn' });
    scheduleDuckSpawn();
  }, RUBBER_DUCK_CONFIG.despawnTime);
}

function collectDuck(pid) {
  if (!state.rubberDuck) return;
  const player = state.players[pid];
  if (!player) return;

  // Clear duck timers
  if (duckWanderTimer) { clearInterval(duckWanderTimer); duckWanderTimer = null; }
  if (duckDespawnTimer) { clearTimeout(duckDespawnTimer); duckDespawnTimer = null; }

  // Award points
  state.score += RUBBER_DUCK_CONFIG.duckPoints;
  player.score += RUBBER_DUCK_CONFIG.duckPoints;

  state.rubberDuck = null;

  // Start buff
  state.duckBuff = { expiresAt: Date.now() + RUBBER_DUCK_CONFIG.buffDuration };

  network.broadcast({
    type: 'duck-collected',
    playerId: pid,
    playerColor: player.color,
    score: state.score,
    playerScore: player.score,
    buffDuration: RUBBER_DUCK_CONFIG.buffDuration,
  });

  duckBuffTimer = setTimeout(() => {
    state.duckBuff = null;
    network.broadcast({ type: 'duck-buff-expired' });
  }, RUBBER_DUCK_CONFIG.buffDuration);

  // Schedule next duck
  scheduleDuckSpawn();
}

function isDuckBuffActive() {
  return state.duckBuff && Date.now() < state.duckBuff.expiresAt;
}

function clearDuck() {
  if (duckSpawnTimer) { clearTimeout(duckSpawnTimer); duckSpawnTimer = null; }
  if (duckWanderTimer) { clearInterval(duckWanderTimer); duckWanderTimer = null; }
  if (duckDespawnTimer) { clearTimeout(duckDespawnTimer); duckDespawnTimer = null; }
  if (duckBuffTimer) { clearTimeout(duckBuffTimer); duckBuffTimer = null; }
  state.rubberDuck = null;
  state.duckBuff = null;
}

module.exports = { startDuckSpawning, collectDuck, isDuckBuffActive, clearDuck };
