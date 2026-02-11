import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket, RawData } from 'ws';

import { SERVER_CONFIG, LOGICAL_W, LOGICAL_H, COLORS, ICONS } from './server/config.ts';
import { getStateSnapshot } from './server/state.ts';
import * as network from './server/network.ts';
import * as db from './server/db.ts';
import * as lobby from './server/lobby.ts';
import * as boss from './server/boss.ts';
import * as game from './server/game.ts';
import * as powerups from './server/powerups.ts';
import * as auth from './server/auth.ts';
import * as entityTypes from './server/entity-types.ts';
import type { GameContext, PlayerInfo } from './server/types.ts';

// Global counters for unique player IDs/colors across all lobbies
let nextPlayerId = 1;
let colorIndex = 0;

// Pre-lobby player info: playerId -> { name, color, icon }
const playerInfo = new Map<string, PlayerInfo>();

// ── MIME types for static file serving ──
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

// ── HTTP server ──
const httpServer = http.createServer((req, res) => {
  const urlPath = req.url!.split('?')[0];
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(import.meta.dirname, 'public', filePath);

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
function getCtxForPlayer(pid: string): GameContext | null {
  const lobbyId = lobby.getLobbyForPlayer(pid);
  if (!lobbyId) return null;
  const mem = lobby.getLobbyState(lobbyId);
  if (!mem) return null;
  const ctx: GameContext = { lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers, matchLog: null, playerInfo };
  // matchLog must persist across ctx instances so logging survives level transitions
  Object.defineProperty(ctx, 'matchLog', {
    get() { return mem.timers._matchLog || null; },
    set(v: unknown) { mem.timers._matchLog = v; },
    enumerable: true,
  });
  return ctx;
}

// ── WebSocket server ──
const wss = new WebSocketServer({ server: httpServer });
network.init(wss);

// ── WebSocket connection handling ──
wss.on('connection', (ws: WebSocket) => {
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

  ws.on('message', async (raw: RawData) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
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
        const regIcon: string | undefined = msg.icon || undefined;

        auth.register(username, password, displayName, regIcon).then(result => {
          if (result.error !== undefined) {
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
          if (result.error !== undefined) {
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
        }).catch(() => {
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
          console.log(`[lobby] ${pid} created lobby "${lobbyName}" (${result.lobby!.code})`);
          network.send(ws, { type: 'lobby-created', lobby: result.lobby });
          // Broadcast updated lobby list to all unattached clients
          broadcastLobbyList();
        }).catch(() => {
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
          bugsSquashed: 0,
        };

        lobby.joinLobby(lobbyId, pid, playerData).then(result => {
          if (result.error) {
            console.log(`[lobby] ${pid} join failed (lobby ${lobbyId}): ${result.error}`);
            network.send(ws, { type: 'lobby-error', message: result.error });
            return;
          }

          network.wsToLobby.set(ws, lobbyId);
          network.addClientToLobby(lobbyId, ws);

          const ctx = getCtxForPlayer(pid);
          if (!ctx) return;

          console.log(`[lobby] ${pid} joined lobby ${lobbyId} (${Object.keys(ctx.state.players).length} players)`);

          // Send lobby-joined with full game state
          network.send(ws, {
            type: 'lobby-joined',
            lobbyId,
            lobbyName: result.lobby!.name,
            lobbyCode: result.lobby!.code,
            ...getStateSnapshot(ctx.state),
          });

          // Notify others in the lobby
          network.broadcastToLobby(lobbyId, {
            type: 'player-joined',
            player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0 },
            playerCount: Object.keys(ctx.state.players).length,
          }, ws);

          broadcastLobbyList();
        }).catch(() => {
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
        const bug = st.bugs[msg.bugId];
        if (!bug) break;
        const descriptor = entityTypes.getDescriptor(bug);
        descriptor.onClick(bug, ctx, pid, msg);
        break;
      }

      case 'click-memory-leak-start': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        const { state: st } = ctx;
        if (st.phase !== 'playing' && st.phase !== 'boss') break;
        const bug = st.bugs[msg.bugId];
        if (!bug || !bug.isMemoryLeak) break;
        entityTypes.getDescriptor(bug).onHoldStart!(bug, ctx, pid);
        break;
      }

      case 'click-memory-leak-complete': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        const { state: st } = ctx;
        if (st.phase !== 'playing' && st.phase !== 'boss') break;
        const bug = st.bugs[msg.bugId];
        if (!bug || !bug.isMemoryLeak) break;
        entityTypes.getDescriptor(bug).onHoldComplete!(bug, ctx, pid);
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

      case 'click-hammer': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        powerups.collectHammer(ctx, pid);
        break;
      }

      case 'get-leaderboard': {
        db.getLeaderboard(10).then(entries => {
          network.send(ws, { type: 'leaderboard', entries });
        }).catch(() => {
          network.send(ws, { type: 'leaderboard', entries: [] });
        });
        break;
      }

      case 'cursor-move': {
        const ctx = getCtxForPlayer(pid);
        if (!ctx) break;
        const { state: st, lobbyId: lid } = ctx;
        const player = st.players[pid];
        if (!player) break;
        player.x = msg.x;
        player.y = msg.y;
        network.broadcastToLobby(lid, {
          type: 'player-cursor',
          playerId: pid,
          x: msg.x,
          y: msg.y,
        }, ws);

        // Heisenbug flee check — dispatch to descriptor
        for (const bid of Object.keys(st.bugs)) {
          const b = st.bugs[bid];
          const desc = entityTypes.getDescriptor(b);
          if (desc.onCursorNear) desc.onCursorNear(b, ctx, pid, msg.x, msg.y);
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

async function handleLeaveLobby(ws: WebSocket, pid: string, lobbyId: number): Promise<void> {
  const mem = lobby.getLobbyState(lobbyId);
  network.wsToLobby.delete(ws);
  network.removeClientFromLobby(lobbyId, ws);

  try {
    await lobby.leaveLobby(lobbyId, pid);
  } catch (err: unknown) {
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
      game.resetToLobby({ lobbyId, state: mem.state, counters: mem.counters, timers: mem.timers, matchLog: null, playerInfo });
    }
  }
}

function broadcastLobbyList(): void {
  lobby.listLobbies().then(lobbies => {
    // Send to all clients not in a lobby
    const data = JSON.stringify({ type: 'lobby-list', lobbies });
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1 && !network.wsToLobby.has(client)) {
        client.send(data);
      }
    });
  }).catch(() => {});
}

// ── Startup ──
async function start(): Promise<void> {
  try {
    await db.initialize();
    console.log('Database initialized');
  } catch (err: unknown) {
    console.error('Database initialization failed:', (err as Error).message);
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
