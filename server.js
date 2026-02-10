const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { LOGICAL_W, LOGICAL_H, COLORS, ICONS, BUG_POINTS } = require('./server/config');
const { state, counters, getStateSnapshot } = require('./server/state');
const network = require('./server/network');
const boss = require('./server/boss');
const game = require('./server/game');

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
  const urlPath = req.url.split('?')[0];
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
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
network.init(wss);

// ── WebSocket connection handling ──
wss.on('connection', (ws) => {
  const playerId = 'player_' + (counters.nextPlayerId++);
  const color = COLORS[counters.colorIndex % COLORS.length];
  const icon = ICONS[counters.colorIndex % ICONS.length];
  counters.colorIndex++;
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

  network.wsToPlayer.set(ws, playerId);

  // Send welcome with full state
  network.send(ws, {
    type: 'welcome',
    playerId,
    name,
    color,
    icon,
    ...getStateSnapshot(),
  });

  // Notify others
  network.broadcast({
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

    const pid = network.wsToPlayer.get(ws);
    if (!pid) return;

    switch (msg.type) {
      case 'start-game': {
        if (state.phase === 'lobby' || state.phase === 'gameover' || state.phase === 'win') {
          game.startGame();
        }
        break;
      }

      case 'click-bug': {
        if (state.phase !== 'playing' && state.phase !== 'boss') break;
        const bugId = msg.bugId;
        const bug = state.bugs[bugId];
        if (!bug) break;

        clearTimeout(bug.escapeTimer);
        clearInterval(bug.wanderInterval);
        delete state.bugs[bugId];

        state.score += BUG_POINTS;
        state.players[pid].score += BUG_POINTS;

        network.broadcast({
          type: 'bug-squashed',
          bugId,
          playerId: pid,
          playerColor: state.players[pid].color,
          score: state.score,
          playerScore: state.players[pid].score,
        });

        if (state.phase === 'boss') {
          game.checkBossGameState();
        } else {
          game.checkGameState();
        }
        break;
      }

      case 'click-boss': {
        boss.handleBossClick(pid);
        break;
      }

      case 'cursor-move': {
        const player = state.players[pid];
        if (!player) break;
        player.x = msg.x;
        player.y = msg.y;
        network.broadcast({
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
          network.broadcast({
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
    const pid = network.wsToPlayer.get(ws);
    network.wsToPlayer.delete(ws);
    if (pid) {
      delete state.players[pid];
      network.broadcast({
        type: 'player-left',
        playerId: pid,
        playerCount: Object.keys(state.players).length,
      });

      if (Object.keys(state.players).length === 0) {
        game.resetToLobby();
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Release Quest running on http://localhost:${PORT}`);
});
