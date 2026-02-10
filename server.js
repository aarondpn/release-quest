const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { SERVER_CONFIG, LOGICAL_W, LOGICAL_H, COLORS, ICONS, BUG_POINTS, HEISENBUG_CONFIG, CODE_REVIEW_CONFIG, MERGE_CONFLICT_CONFIG } = require('./server/config');
const { randomPosition, getStateSnapshot } = require('./server/state');
const network = require('./server/network');
const db = require('./server/db');
const lobby = require('./server/lobby');
const boss = require('./server/boss');
const game = require('./server/game');
const powerups = require('./server/powerups');
const auth = require('./server/auth');

// Global counters for unique player IDs/colors across all lobbies
let nextPlayerId = 1;
let colorIndex = 0;

// Pre-lobby player info: playerId -> { name, color, icon }
const playerInfo = new Map();

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
const httpServer = http.createServer((req, res) => {
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

// ── Helper to get lobby context for a player ──
function getCtxForPlayer(pid) {
  const lobbyId = lobby.getLobbyForPlayer(pid);
  if (!lobbyId) return null;
  const mem = lobby.getLobbyState(lobbyId);
  if (!mem) return null;
  return { lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers };
}

// ── WebSocket server ──
const wss = new WebSocketServer({ server: httpServer });
network.init(wss);

// ── WebSocket connection handling ──
wss.on('connection', (ws) => {
  const playerId = 'player_' + (nextPlayerId++);
  const color = COLORS[colorIndex % COLORS.length];
  const icon = ICONS[colorIndex % ICONS.length];
  colorIndex++;
  const name = 'Player ' + playerId.split('_')[1];

  playerInfo.set(playerId, { name, color, icon });
  network.wsToPlayer.set(ws, playerId);

  console.log(`[connect] ${playerId} connected (${wss.clients.size} online)`);

  // Send welcome — no game state yet, player must join a lobby first
  network.send(ws, {
    type: 'welcome',
    playerId,
    name,
    color,
    icon,
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const pid = network.wsToPlayer.get(ws);
    if (!pid) return;

    switch (msg.type) {
      case 'register': {
        const username = String(msg.username || '').trim();
        const password = String(msg.password || '');
        const displayName = String(msg.displayName || '').trim().slice(0, 16);
        const icon = msg.icon || undefined;

        auth.register(username, password, displayName, icon).then(result => {
          if (result.error) {
            console.log(`[auth] ${pid} register failed: ${result.error}`);
            network.send(ws, { type: 'auth-result', action: 'register', success: false, error: result.error });
            return;
          }
          console.log(`[auth] ${pid} registered as "${result.user.username}"`);
          const info = playerInfo.get(pid);
          if (info) {
            info.name = result.user.displayName;
            info.icon = result.user.icon;
            info.userId = result.user.id;
          }
          network.send(ws, {
            type: 'auth-result', action: 'register', success: true,
            user: result.user, token: result.token,
          });
          // Update lobby if in one
          const ctx = getCtxForPlayer(pid);
          if (ctx) {
            const player = ctx.state.players[pid];
            if (player) {
              player.name = result.user.displayName;
              player.icon = result.user.icon;
              network.broadcastToLobby(ctx.lobbyId, {
                type: 'player-joined',
                player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score },
                playerCount: Object.keys(ctx.state.players).length,
              });
            }
          }
        }).catch(() => {
          network.send(ws, { type: 'auth-result', action: 'register', success: false, error: 'Registration failed' });
        });
        break;
      }

      case 'login': {
        const username = String(msg.username || '').trim();
        const password = String(msg.password || '');

        auth.login(username, password).then(result => {
          if (result.error) {
            console.log(`[auth] ${pid} login failed for "${username}": ${result.error}`);
            network.send(ws, { type: 'auth-result', action: 'login', success: false, error: result.error });
            return;
          }
          console.log(`[auth] ${pid} logged in as "${result.user.username}"`);
          const info = playerInfo.get(pid);
          if (info) {
            info.name = result.user.displayName;
            info.icon = result.user.icon;
            info.userId = result.user.id;
          }
          network.send(ws, {
            type: 'auth-result', action: 'login', success: true,
            user: result.user, token: result.token,
          });
          const ctx = getCtxForPlayer(pid);
          if (ctx) {
            const player = ctx.state.players[pid];
            if (player) {
              player.name = result.user.displayName;
              player.icon = result.user.icon;
              network.broadcastToLobby(ctx.lobbyId, {
                type: 'player-joined',
                player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score },
                playerCount: Object.keys(ctx.state.players).length,
              });
            }
          }
        }).catch(() => {
          network.send(ws, { type: 'auth-result', action: 'login', success: false, error: 'Login failed' });
        });
        break;
      }

      case 'logout': {
        const token = String(msg.token || '');
        auth.logout(token).then(() => {
          const info = playerInfo.get(pid);
          console.log(`[auth] ${pid} logged out`);
          if (info) {
            delete info.userId;
          }
          network.send(ws, { type: 'auth-result', action: 'logout', success: true });
        }).catch(() => {
          network.send(ws, { type: 'auth-result', action: 'logout', success: true });
        });
        break;
      }

      case 'resume-session': {
        const token = String(msg.token || '');
        auth.validateSession(token).then(user => {
          if (!user) {
            console.log(`[auth] ${pid} session resume failed (expired/invalid)`);
            network.send(ws, { type: 'auth-result', action: 'resume', success: false, error: 'Session expired' });
            return;
          }
          console.log(`[auth] ${pid} resumed session as "${user.username}"`);
          const info = playerInfo.get(pid);
          if (info) {
            info.name = user.displayName;
            info.icon = user.icon;
            info.userId = user.id;
          }
          network.send(ws, {
            type: 'auth-result', action: 'resume', success: true,
            user: { id: user.id, username: user.username, displayName: user.displayName, icon: user.icon },
          });
        }).catch(() => {
          network.send(ws, { type: 'auth-result', action: 'resume', success: false, error: 'Session validation failed' });
        });
        break;
      }

      case 'set-name': {
        const info = playerInfo.get(pid);
        if (!info) break;
        const newName = String(msg.name || '').trim().slice(0, 16);
        if (newName) info.name = newName;
        if (msg.icon && ICONS.includes(msg.icon)) info.icon = msg.icon;

        // If already in a lobby, update there too
        const ctx = getCtxForPlayer(pid);
        if (ctx) {
          const player = ctx.state.players[pid];
          if (player) {
            if (newName) player.name = newName;
            if (msg.icon && ICONS.includes(msg.icon)) player.icon = msg.icon;
            network.broadcastToLobby(ctx.lobbyId, {
              type: 'player-joined',
              player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score },
              playerCount: Object.keys(ctx.state.players).length,
            });
          }
        }
        break;
      }

      case 'list-lobbies': {
        lobby.listLobbies().then(lobbies => {
          network.send(ws, { type: 'lobby-list', lobbies });
        }).catch(err => {
          network.send(ws, { type: 'lobby-error', message: 'Failed to list lobbies' });
        });
        break;
      }

      case 'create-lobby': {
        const lobbyName = String(msg.name || '').trim().slice(0, 32) || 'Game Lobby';
        const maxPlayers = parseInt(msg.maxPlayers, 10) || undefined;

        lobby.createLobby(lobbyName, maxPlayers).then(result => {
          if (result.error) {
            console.log(`[lobby] ${pid} create failed: ${result.error}`);
            network.send(ws, { type: 'lobby-error', message: result.error });
            return;
          }
          console.log(`[lobby] ${pid} created lobby "${lobbyName}" (${result.lobby.code})`);
          network.send(ws, { type: 'lobby-created', lobby: result.lobby });
          // Broadcast updated lobby list to all unattached clients
          broadcastLobbyList();
        }).catch(err => {
          network.send(ws, { type: 'lobby-error', message: 'Failed to create lobby' });
        });
        break;
      }

      case 'join-lobby': {
        const lobbyId = parseInt(msg.lobbyId, 10);
        if (!lobbyId) {
          network.send(ws, { type: 'lobby-error', message: 'Invalid lobby ID' });
          break;
        }

        // Leave current lobby if in one
        const currentLobbyId = lobby.getLobbyForPlayer(pid);
        if (currentLobbyId) {
          await handleLeaveLobby(ws, pid, currentLobbyId);
        }

        const info = playerInfo.get(pid);
        if (!info) break;

        const playerData = {
          id: pid,
          name: info.name,
          color: info.color,
          icon: info.icon,
          x: LOGICAL_W / 2,
          y: LOGICAL_H / 2,
          score: 0,
        };

        lobby.joinLobby(lobbyId, pid, playerData).then(result => {
          if (result.error) {
            console.log(`[lobby] ${pid} join failed (lobby ${lobbyId}): ${result.error}`);
            network.send(ws, { type: 'lobby-error', message: result.error });
            return;
          }

          network.wsToLobby.set(ws, lobbyId);

          const ctx = getCtxForPlayer(pid);
          if (!ctx) return;

          console.log(`[lobby] ${pid} joined lobby ${lobbyId} (${Object.keys(ctx.state.players).length} players)`);

          // Send lobby-joined with full game state
          network.send(ws, {
            type: 'lobby-joined',
            lobbyId,
            lobbyName: result.lobby.name,
            lobbyCode: result.lobby.code,
            ...getStateSnapshot(ctx.state),
          });

          // Notify others in the lobby
          network.broadcastToLobby(lobbyId, {
            type: 'player-joined',
            player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0 },
            playerCount: Object.keys(ctx.state.players).length,
          }, ws);

          broadcastLobbyList();
        }).catch(err => {
          network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
        });
        break;
      }

      case 'leave-lobby': {
        const currentLobbyId = lobby.getLobbyForPlayer(pid);
        if (currentLobbyId) {
          console.log(`[lobby] ${pid} left lobby ${currentLobbyId}`);
          await handleLeaveLobby(ws, pid, currentLobbyId);
          network.send(ws, { type: 'lobby-left' });
          broadcastLobbyList();
        }
        break;
      }

      case 'start-game': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        if (ctx.state.phase === 'lobby' || ctx.state.phase === 'gameover' || ctx.state.phase === 'win') {
          console.log(`[game] ${pid} started game in lobby ${ctx.lobbyId} (${Object.keys(ctx.state.players).length} players)`);
          game.startGame(ctx);
        }
        break;
      }

      case 'click-bug': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        const { state: st } = ctx;
        if (st.phase !== 'playing' && st.phase !== 'boss') break;
        const bugId = msg.bugId;
        const bug = st.bugs[bugId];
        if (!bug) break;

        const player = st.players[pid];
        if (!player) break;

        // Feature-not-a-bug: penalize player
        if (bug.isFeature) {
          clearTimeout(bug.escapeTimer);
          clearInterval(bug.wanderInterval);
          delete st.bugs[bugId];

          st.hp -= CODE_REVIEW_CONFIG.hpPenalty;
          if (st.hp < 0) st.hp = 0;

          network.broadcastToLobby(ctx.lobbyId, {
            type: 'feature-squashed',
            bugId,
            playerId: pid,
            playerColor: player.color,
            hp: st.hp,
          });

          if (st.phase === 'boss') game.checkBossGameState(ctx);
          else game.checkGameState(ctx);
          break;
        }

        // Merge conflict logic
        if (bug.mergeConflict) {
          bug.mergeClicked = true;
          bug.mergeClickedBy = pid;
          bug.mergeClickedAt = Date.now();

          const partner = st.bugs[bug.mergePartner];
          if (partner && partner.mergeClicked && (Date.now() - partner.mergeClickedAt) < MERGE_CONFLICT_CONFIG.resolveWindow) {
            // Both clicked in time — resolve!
            clearTimeout(bug.escapeTimer);
            clearInterval(bug.wanderInterval);
            clearTimeout(partner.escapeTimer);
            clearInterval(partner.wanderInterval);
            if (bug.mergeResetTimer) clearTimeout(bug.mergeResetTimer);
            if (partner.mergeResetTimer) clearTimeout(partner.mergeResetTimer);
            delete st.bugs[bugId];
            delete st.bugs[partner.id];

            // Award bonus to both clickers
            const clickers = new Set([pid, partner.mergeClickedBy]);
            for (const clickerId of clickers) {
              if (st.players[clickerId]) {
                st.players[clickerId].score += MERGE_CONFLICT_CONFIG.bonusPoints;
                st.score += MERGE_CONFLICT_CONFIG.bonusPoints;
              }
            }

            network.broadcastToLobby(ctx.lobbyId, {
              type: 'merge-conflict-resolved',
              bugId,
              partnerId: partner.id,
              clickers: [...clickers],
              score: st.score,
              players: Object.fromEntries(
                [...clickers].filter(c => st.players[c]).map(c => [c, st.players[c].score])
              ),
            });

            if (st.phase === 'boss') game.checkBossGameState(ctx);
            else game.checkGameState(ctx);
          } else {
            // Only one clicked — set timeout for reset
            network.broadcastToLobby(ctx.lobbyId, { type: 'merge-conflict-halfclick', bugId });
            bug.mergeResetTimer = setTimeout(() => {
              if (st.bugs[bugId]) {
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
        delete st.bugs[bugId];

        // Calculate points
        let points = BUG_POINTS;
        if (bug.isHeisenbug) {
          points = BUG_POINTS * HEISENBUG_CONFIG.pointsMultiplier;
        }

        // Duck buff: double points
        if (powerups.isDuckBuffActive(ctx)) {
          points *= 2;
        }

        st.score += points;
        player.score += points;

        network.broadcastToLobby(ctx.lobbyId, {
          type: 'bug-squashed',
          bugId,
          playerId: pid,
          playerColor: player.color,
          score: st.score,
          playerScore: player.score,
          isHeisenbug: bug.isHeisenbug || false,
          points,
        });

        if (st.phase === 'boss') {
          game.checkBossGameState(ctx);
        } else {
          game.checkGameState(ctx);
        }
        break;
      }

      case 'click-boss': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        boss.handleBossClick(ctx, pid);
        break;
      }

      case 'click-duck': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        powerups.collectDuck(ctx, pid);
        break;
      }

      case 'cursor-move': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        const { state: st, lobbyId } = ctx;
        const player = st.players[pid];
        if (!player) break;
        player.x = msg.x;
        player.y = msg.y;
        network.broadcastToLobby(lobbyId, {
          type: 'player-cursor',
          playerId: pid,
          x: msg.x,
          y: msg.y,
        }, ws);

        // Heisenbug flee check
        const now = Date.now();
        for (const bid of Object.keys(st.bugs)) {
          const b = st.bugs[bid];
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

            network.broadcastToLobby(lobbyId, {
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
    }
  });

  ws.on('close', async () => {
    const pid = network.wsToPlayer.get(ws);
    network.wsToPlayer.delete(ws);
    network.wsToLobby.delete(ws);

    if (pid) {
      const currentLobbyId = lobby.getLobbyForPlayer(pid);
      if (currentLobbyId) {
        console.log(`[disconnect] ${pid} left lobby ${currentLobbyId} (disconnected)`);
        await handleLeaveLobby(ws, pid, currentLobbyId);
        broadcastLobbyList();
      }
      playerInfo.delete(pid);
      console.log(`[disconnect] ${pid} disconnected (${wss.clients.size} online)`);
    }
  });
});

async function handleLeaveLobby(ws, pid, lobbyId) {
  const mem = lobby.getLobbyState(lobbyId);
  network.wsToLobby.delete(ws);

  try {
    await lobby.leaveLobby(lobbyId, pid);
  } catch (err) {
    console.error('Error leaving lobby:', err);
  }

  if (mem) {
    const remaining = Object.keys(mem.state.players).length;
    // Notify remaining players
    network.broadcastToLobby(lobbyId, {
      type: 'player-left',
      playerId: pid,
      playerCount: remaining,
    });

    // Reset game if lobby is now empty (destroyLobby already called by leaveLobby)
    if (remaining === 0) {
      game.resetToLobby({ lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers });
    }
  }
}

function broadcastLobbyList() {
  lobby.listLobbies().then(lobbies => {
    // Send to all clients not in a lobby
    const data = JSON.stringify({ type: 'lobby-list', lobbies });
    wss.clients.forEach(client => {
      if (client.readyState === 1 && !network.wsToLobby.has(client)) {
        client.send(data);
      }
    });
  }).catch(() => {});
}

// ── Startup ──
async function start() {
  try {
    await db.initialize();
    console.log('Database initialized');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.log('Starting without database — lobby persistence disabled');
  }

  // Periodic sweep: destroy any lobbies with 0 members every 30s
  setInterval(() => {
    lobby.sweepEmptyLobbies().then(() => broadcastLobbyList()).catch(() => {});
  }, 30_000);

  httpServer.listen(SERVER_CONFIG.port, () => {
    console.log(`Release Quest running on http://localhost:${SERVER_CONFIG.port}`);
  });
}

start();
