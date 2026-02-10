const { HP_DAMAGE, BOSS_CONFIG, HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, MERGE_CONFLICT_CONFIG } = require('./config');
const { state, counters, randomPosition, currentLevelConfig } = require('./state');
const network = require('./network');

let spawnTimer = null;

function spawnEntity({ phaseCheck, maxOnScreen, escapeTime, isMinion, onEscapeCheck, variant }) {
  if (state.phase !== phaseCheck) return;
  if (Object.keys(state.bugs).length >= maxOnScreen) return;

  const id = 'bug_' + (counters.nextBugId++);
  const pos = randomPosition();
  const bug = { id, x: pos.x, y: pos.y, escapeTimer: null, wanderInterval: null };
  if (isMinion) bug.isMinion = true;

  if (variant) Object.assign(bug, variant);

  bug.escapeTime = escapeTime;
  bug.escapeStartedAt = Date.now();

  state.bugs[id] = bug;

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

  network.broadcast({ type: 'bug-spawned', bug: broadcastPayload });

  bug.wanderInterval = setInterval(() => {
    if (state.phase !== phaseCheck || !state.bugs[id]) return;
    const newPos = randomPosition();
    bug.x = newPos.x;
    bug.y = newPos.y;
    network.broadcast({ type: 'bug-wander', bugId: id, x: newPos.x, y: newPos.y });
  }, escapeTime * 0.45);

  bug.escapeTimer = setTimeout(() => {
    if (!state.bugs[id]) return;
    clearInterval(bug.wanderInterval);

    // Feature bugs escape peacefully
    if (bug.isFeature) {
      delete state.bugs[id];
      network.broadcast({ type: 'feature-escaped', bugId: id });
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
      network.broadcast({ type: 'merge-conflict-escaped', bugId: id, partnerId: bug.mergePartner, hp: state.hp });
      onEscapeCheck();
      return;
    }

    delete state.bugs[id];
    state.hp -= HP_DAMAGE;
    if (state.hp < 0) state.hp = 0;

    network.broadcast({ type: 'bug-escaped', bugId: id, hp: state.hp });
    onEscapeCheck();
  }, escapeTime);
}

function spawnBug() {
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig();
  if (state.bugsSpawned >= cfg.bugsTotal) return;
  state.bugsSpawned++;

  const game = require('./game');
  const playerCount = Object.keys(state.players).length;

  // Roll for merge conflict (2+ players, not on level 1 for variety)
  if (playerCount >= MERGE_CONFLICT_CONFIG.minPlayers && Math.random() < MERGE_CONFLICT_CONFIG.chance) {
    spawnMergeConflict(cfg, game);
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

  spawnEntity({
    phaseCheck: 'playing',
    maxOnScreen: cfg.maxOnScreen,
    escapeTime,
    isMinion: false,
    onEscapeCheck: () => game.checkGameState(),
    variant,
  });
}

function spawnMergeConflict(cfg, game) {
  const conflictId = 'conflict_' + (counters.nextConflictId++);
  const escapeTime = cfg.escapeTime * MERGE_CONFLICT_CONFIG.escapeTimeMultiplier;
  const id1 = 'bug_' + (counters.nextBugId++);
  const id2 = 'bug_' + (counters.nextBugId++);

  // We need an extra bugsSpawned since merge creates 2 bugs from 1 spawn call
  if (state.bugsSpawned < cfg.bugsTotal) state.bugsSpawned++;

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

  network.broadcast({ type: 'bug-spawned', bug: {
    id: id1, x: bug1.x, y: bug1.y, mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
  }});
  network.broadcast({ type: 'bug-spawned', bug: {
    id: id2, x: bug2.x, y: bug2.y, mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
  }});

  // Wander independently
  bug1.wanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || !state.bugs[id1]) return;
    const np = randomPosition();
    bug1.x = np.x; bug1.y = np.y;
    network.broadcast({ type: 'bug-wander', bugId: id1, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  bug2.wanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || !state.bugs[id2]) return;
    const np = randomPosition();
    bug2.x = np.x; bug2.y = np.y;
    network.broadcast({ type: 'bug-wander', bugId: id2, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  // Shared escape timer on bug1 — bug1's escape handler handles both
  bug1.escapeTimer = setTimeout(() => {
    if (!state.bugs[id1] && !state.bugs[id2]) return;
    const damage = MERGE_CONFLICT_CONFIG.doubleDamage ? HP_DAMAGE * 2 : HP_DAMAGE;
    if (state.bugs[id1]) { clearInterval(bug1.wanderInterval); delete state.bugs[id1]; }
    if (state.bugs[id2]) { clearTimeout(bug2.escapeTimer); clearInterval(bug2.wanderInterval); delete state.bugs[id2]; }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    network.broadcast({ type: 'merge-conflict-escaped', bugId: id1, partnerId: id2, hp: state.hp });
    game.checkGameState();
  }, escapeTime);

  // bug2 shares the same escape time
  bug2.escapeTimer = bug1.escapeTimer;
}

function spawnMinion() {
  if (state.phase !== 'boss') return;
  const bossModule = require('./boss');
  const game = require('./game');
  const maxOnScreen = bossModule.getEffectiveMaxOnScreen();

  // Roll for feature variant during boss phase
  let variant = null;
  if (Math.random() < CODE_REVIEW_CONFIG.bossPhaseChance) {
    variant = { isFeature: true };
  }

  spawnEntity({
    phaseCheck: 'boss',
    maxOnScreen,
    escapeTime: BOSS_CONFIG.minionEscapeTime,
    isMinion: true,
    onEscapeCheck: () => game.checkBossGameState(),
    variant,
  });
}

function clearAllBugs() {
  for (const id of Object.keys(state.bugs)) {
    const bug = state.bugs[id];
    clearTimeout(bug.escapeTimer);
    clearInterval(bug.wanderInterval);
    if (bug.mergeResetTimer) clearTimeout(bug.mergeResetTimer);
  }
  state.bugs = {};
}

function clearSpawnTimer() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }
}

function startSpawning(rate) {
  spawnTimer = setInterval(spawnBug, rate);
  spawnBug();
}

module.exports = { spawnBug, spawnMinion, spawnMergeConflict, clearAllBugs, clearSpawnTimer, startSpawning, spawnEntity };
