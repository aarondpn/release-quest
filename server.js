const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { LOGICAL_W, LOGICAL_H, COLORS, ICONS, BUG_POINTS, HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, MERGE_CONFLICT_CONFIG } = require('./server/config');
const { state, counters, randomPosition, getStateSnapshot } = require('./server/state');
const network = require('./server/network');
const boss = require('./server/boss');
const game = require('./server/game');

// Lazy-loaded modules (created after game starts)
let powerups;
function getPowerups() { if (!powerups) powerups = require('./server/powerups'); return powerups; }

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

        const player = state.players[pid];
        if (!player) break;

        // Feature-not-a-bug: penalize player
        if (bug.isFeature) {
          clearTimeout(bug.escapeTimer);
          clearInterval(bug.wanderInterval);
          delete state.bugs[bugId];

          state.hp -= CODE_REVIEW_CONFIG.hpPenalty;
          if (state.hp < 0) state.hp = 0;

          network.broadcast({
            type: 'feature-squashed',
            bugId,
            playerId: pid,
            playerColor: player.color,
            hp: state.hp,
          });

          if (state.phase === 'boss') game.checkBossGameState();
          else game.checkGameState();
          break;
        }

        // Merge conflict logic
        if (bug.mergeConflict) {
          bug.mergeClicked = true;
          bug.mergeClickedBy = pid;
          bug.mergeClickedAt = Date.now();

          const partner = state.bugs[bug.mergePartner];
          if (partner && partner.mergeClicked && (Date.now() - partner.mergeClickedAt) < MERGE_CONFLICT_CONFIG.resolveWindow) {
            // Both clicked in time — resolve!
            clearTimeout(bug.escapeTimer);
            clearInterval(bug.wanderInterval);
            clearTimeout(partner.escapeTimer);
            clearInterval(partner.wanderInterval);
            if (bug.mergeResetTimer) clearTimeout(bug.mergeResetTimer);
            if (partner.mergeResetTimer) clearTimeout(partner.mergeResetTimer);
            delete state.bugs[bugId];
            delete state.bugs[partner.id];

            // Award bonus to both clickers
            const clickers = new Set([pid, partner.mergeClickedBy]);
            for (const clickerId of clickers) {
              if (state.players[clickerId]) {
                state.players[clickerId].score += MERGE_CONFLICT_CONFIG.bonusPoints;
                state.score += MERGE_CONFLICT_CONFIG.bonusPoints;
              }
            }

            network.broadcast({
              type: 'merge-conflict-resolved',
              bugId,
              partnerId: partner.id,
              clickers: [...clickers],
              score: state.score,
              players: Object.fromEntries(
                [...clickers].filter(c => state.players[c]).map(c => [c, state.players[c].score])
              ),
            });

            if (state.phase === 'boss') game.checkBossGameState();
            else game.checkGameState();
          } else {
            // Only one clicked — set timeout for reset
            network.broadcast({ type: 'merge-conflict-halfclick', bugId });
            bug.mergeResetTimer = setTimeout(() => {
              if (state.bugs[bugId]) {
                bug.mergeClicked = false;
                bug.mergeClickedBy = null;
                bug.mergeClickedAt = 0;
              }
            }, MERGE_CONFLICT_CONFIG.resolveWindow);
          }
          break;
        }

        // Normal bug / Heisenbug / Clone squash
        clearTimeout(bug.escapeTimer);
        clearInterval(bug.wanderInterval);
        delete state.bugs[bugId];

        // Calculate points
        let points = BUG_POINTS;
        if (bug.isHeisenbug) {
          points = BUG_POINTS * HEISENBUG_CONFIG.pointsMultiplier;
        }

        // Duck buff: double points
        if (getPowerups().isDuckBuffActive()) {
          points *= 2;
        }

        state.score += points;
        player.score += points;

        network.broadcast({
          type: 'bug-squashed',
          bugId,
          playerId: pid,
          playerColor: player.color,
          score: state.score,
          playerScore: player.score,
          isHeisenbug: bug.isHeisenbug || false,
          points,
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

      case 'click-duck': {
        getPowerups().collectDuck(pid);
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

        // Heisenbug flee check
        const now = Date.now();
        for (const bid of Object.keys(state.bugs)) {
          const b = state.bugs[bid];
          if (!b || !b.isHeisenbug || b.fleesRemaining <= 0) continue;
          if (now - b.lastFleeTime < HEISENBUG_CONFIG.fleeCooldown) continue;

          const dx = b.x - msg.x;
          const dy = b.y - msg.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < HEISENBUG_CONFIG.fleeRadius) {
            const newPos = randomPosition();
            b.x = newPos.x;
            b.y = newPos.y;
            b.fleesRemaining--;
            b.lastFleeTime = now;

            network.broadcast({
              type: 'bug-flee',
              bugId: bid,
              x: newPos.x,
              y: newPos.y,
              fleesRemaining: b.fleesRemaining,
            });
          }
        }

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
