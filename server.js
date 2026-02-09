const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── MIME types for static file serving ──
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// ── HTTP server ──
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// ── WebSocket server ──
const wss = new WebSocketServer({ server });

// ── Constants ──
const LOGICAL_W = 800;
const LOGICAL_H = 500;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4'];
const ICONS = ['\u{1F431}', '\u{1F436}', '\u{1F430}', '\u{1F98A}', '\u{1F438}', '\u{1F427}', '\u{1F43C}', '\u{1F428}']; // cat,dog,bunny,fox,frog,penguin,panda,koala
const LEVEL_CONFIG = {
  1: { bugsTotal: 8,  escapeTime: 5000, spawnRate: 2200, maxOnScreen: 2 },
  2: { bugsTotal: 12, escapeTime: 3800, spawnRate: 1600, maxOnScreen: 3 },
  3: { bugsTotal: 16, escapeTime: 2800, spawnRate: 1200, maxOnScreen: 4 },
};
const MAX_LEVEL = 3;
const HP_DAMAGE = 15;
const BUG_POINTS = 10;

// ── Game state ──
let state = {
  phase: 'lobby', // lobby | playing | gameover | win
  score: 0,
  hp: 100,
  level: 1,
  bugsRemaining: 0,
  bugsSpawned: 0,
  bugs: {},       // bugId -> { id, x, y, escapeTimer, wanderInterval }
  players: {},    // playerId -> { id, name, color, icon, x, y, score }
};

let nextBugId = 1;
let nextPlayerId = 1;
let colorIndex = 0;
let spawnTimer = null;

// Map ws -> playerId
const wsToPlayer = new Map();

// ── Helpers ──
function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  });
}

function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function randomPosition() {
  const pad = 40;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

function currentLevelConfig() {
  return LEVEL_CONFIG[state.level] || LEVEL_CONFIG[MAX_LEVEL];
}

// ── Bug lifecycle ──
function spawnBug() {
  if (state.phase !== 'playing') return;
  const cfg = currentLevelConfig();
  if (state.bugsSpawned >= cfg.bugsTotal) return;
  if (Object.keys(state.bugs).length >= cfg.maxOnScreen) return;

  const id = 'bug_' + (nextBugId++);
  const pos = randomPosition();
  const bug = { id, x: pos.x, y: pos.y, escapeTimer: null, wanderInterval: null };

  state.bugs[id] = bug;
  state.bugsSpawned++;

  broadcast({ type: 'bug-spawned', bug: { id, x: bug.x, y: bug.y } });

  // Wander
  bug.wanderInterval = setInterval(() => {
    if (state.phase !== 'playing' || !state.bugs[id]) return;
    const newPos = randomPosition();
    bug.x = newPos.x;
    bug.y = newPos.y;
    broadcast({ type: 'bug-wander', bugId: id, x: newPos.x, y: newPos.y });
  }, cfg.escapeTime * 0.45);

  // Escape timer
  bug.escapeTimer = setTimeout(() => {
    if (!state.bugs[id]) return;
    clearInterval(bug.wanderInterval);
    delete state.bugs[id];

    state.hp -= HP_DAMAGE;
    if (state.hp < 0) state.hp = 0;

    broadcast({ type: 'bug-escaped', bugId: id, hp: state.hp });

    checkGameState();
  }, cfg.escapeTime);
}

function clearAllBugs() {
  for (const id of Object.keys(state.bugs)) {
    const bug = state.bugs[id];
    clearTimeout(bug.escapeTimer);
    clearInterval(bug.wanderInterval);
  }
  state.bugs = {};
}

function clearSpawnTimer() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }
}

// ── Game state checks ──
function checkGameState() {
  if (state.phase !== 'playing') return;

  if (state.hp <= 0) {
    state.phase = 'gameover';
    clearSpawnTimer();
    clearAllBugs();
    broadcast({
      type: 'game-over',
      score: state.score,
      level: state.level,
      players: getPlayerScores(),
    });
    return;
  }

  const cfg = currentLevelConfig();
  const allSpawned = state.bugsSpawned >= cfg.bugsTotal;
  const noneAlive = Object.keys(state.bugs).length === 0;

  if (allSpawned && noneAlive) {
    clearSpawnTimer();
    if (state.level >= MAX_LEVEL) {
      state.phase = 'win';
      broadcast({
        type: 'game-win',
        score: state.score,
        players: getPlayerScores(),
      });
    } else {
      broadcast({
        type: 'level-complete',
        level: state.level,
        score: state.score,
      });
      // Start next level after short delay
      setTimeout(() => {
        if (state.phase !== 'playing' && state.phase !== 'lobby') {
          // Game may have been reset
          if (Object.keys(state.players).length === 0) return;
        }
        state.level++;
        startLevel();
      }, 2000);
    }
  }
}

function startLevel() {
  const cfg = currentLevelConfig();
  state.bugsRemaining = cfg.bugsTotal;
  state.bugsSpawned = 0;
  state.phase = 'playing';

  broadcast({
    type: 'level-start',
    level: state.level,
    bugsTotal: cfg.bugsTotal,
    hp: state.hp,
    score: state.score,
  });

  spawnTimer = setInterval(spawnBug, cfg.spawnRate);
  spawnBug(); // immediate first
}

function startGame() {
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.phase = 'playing';

  // Reset per-player scores
  for (const pid of Object.keys(state.players)) {
    state.players[pid].score = 0;
  }

  clearSpawnTimer();
  clearAllBugs();

  broadcast({
    type: 'game-start',
    level: 1,
    hp: 100,
    score: 0,
    players: getPlayerScores(),
  });

  startLevel();
}

function resetToLobby() {
  state.phase = 'lobby';
  state.score = 0;
  state.hp = 100;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  clearSpawnTimer();
  clearAllBugs();
}

function getPlayerScores() {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    score: p.score,
  }));
}

function getStateSnapshot() {
  return {
    phase: state.phase,
    score: state.score,
    hp: state.hp,
    level: state.level,
    bugsRemaining: currentLevelConfig().bugsTotal - state.bugsSpawned + Object.keys(state.bugs).length,
    bugs: Object.values(state.bugs).map(b => ({ id: b.id, x: b.x, y: b.y })),
    players: getPlayerScores(),
  };
}

// ── WebSocket connection handling ──
wss.on('connection', (ws) => {
  const playerId = 'player_' + (nextPlayerId++);
  const color = COLORS[colorIndex % COLORS.length];
  const icon = ICONS[colorIndex % ICONS.length];
  colorIndex++;
  const name = 'Player ' + playerId.split('_')[1];

  state.players[playerId] = {
    id: playerId,
    name,
    color,
    icon,
    x: LOGICAL_W / 2,
    y: LOGICAL_H / 2,
    score: 0,
  };

  wsToPlayer.set(ws, playerId);

  // Send welcome with full state
  send(ws, {
    type: 'welcome',
    playerId,
    name,
    color,
    icon,
    ...getStateSnapshot(),
  });

  // Notify others
  broadcast({
    type: 'player-joined',
    player: { id: playerId, name, color, icon, score: 0 },
    playerCount: Object.keys(state.players).length,
  }, ws);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const pid = wsToPlayer.get(ws);
    if (!pid) return;

    switch (msg.type) {
      case 'start-game': {
        if (state.phase === 'lobby' || state.phase === 'gameover' || state.phase === 'win') {
          startGame();
        }
        break;
      }

      case 'click-bug': {
        if (state.phase !== 'playing') break;
        const bugId = msg.bugId;
        const bug = state.bugs[bugId];
        if (!bug) break; // already dead or doesn't exist

        // First click wins
        clearTimeout(bug.escapeTimer);
        clearInterval(bug.wanderInterval);
        delete state.bugs[bugId];

        state.score += BUG_POINTS;
        state.players[pid].score += BUG_POINTS;

        broadcast({
          type: 'bug-squashed',
          bugId,
          playerId: pid,
          playerColor: state.players[pid].color,
          score: state.score,
          playerScore: state.players[pid].score,
        });

        checkGameState();
        break;
      }

      case 'cursor-move': {
        const player = state.players[pid];
        if (!player) break;
        player.x = msg.x;
        player.y = msg.y;
        broadcast({
          type: 'player-cursor',
          playerId: pid,
          x: msg.x,
          y: msg.y,
        }, ws);
        break;
      }

      case 'set-name': {
        const player = state.players[pid];
        if (!player) break;
        const newName = String(msg.name || '').trim().slice(0, 16);
        if (newName) player.name = newName;
        if (msg.icon && ICONS.includes(msg.icon)) player.icon = msg.icon;
        if (newName || msg.icon) {
          broadcast({
            type: 'player-joined',
            player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score },
            playerCount: Object.keys(state.players).length,
          });
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const pid = wsToPlayer.get(ws);
    wsToPlayer.delete(ws);
    if (pid) {
      delete state.players[pid];
      broadcast({
        type: 'player-left',
        playerId: pid,
        playerCount: Object.keys(state.players).length,
      });

      // If all players left, reset
      if (Object.keys(state.players).length === 0) {
        resetToLobby();
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Release Quest running on http://localhost:${PORT}`);
});
