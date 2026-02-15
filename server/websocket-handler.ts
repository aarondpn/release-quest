import type { WebSocket, RawData } from 'ws';
import type { PlayerInfo } from './types.ts';
import { LOGICAL_W, LOGICAL_H, ICONS, PREMIUM_ICON_IDS, ALL_ICONS } from './config.ts';
import { getStateSnapshot } from './state.ts';
import * as network from './network.ts';
import * as db from './db.ts';
import * as lobby from './lobby.ts';
import * as boss from './boss.ts';
import * as game from './game.ts';
import * as powerups from './powerups.ts';
import * as auth from './auth.ts';
import * as entityTypes from './entity-types.ts';
import { getCtxForPlayer, handleLeaveLobby, broadcastLobbyList, augmentLobbies } from './helpers.ts';
import { wsMessagesReceived, gamePlayersOnline } from './metrics.ts';

/**
 * Handle incoming WebSocket messages
 */
export async function handleMessage(
  ws: WebSocket,
  msg: any,
  pid: string,
  playerInfo: Map<string, PlayerInfo>,
  wss: any
): Promise<void> {
  switch (msg.type) {
    case 'register': {
      const username = String(msg.username || '').trim();
      const password = String(msg.password || '');
      const displayName = String(msg.displayName || '').trim().slice(0, 16);
      const regIcon: string | undefined = msg.icon && ALL_ICONS.includes(msg.icon) ? msg.icon : undefined;

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
        const ctx = getCtxForPlayer(pid, playerInfo);
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
        const ctx = getCtxForPlayer(pid, playerInfo);
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
      if (msg.icon && PREMIUM_ICON_IDS.includes(msg.icon) && info.userId) info.icon = msg.icon;

      // Persist changes to database for logged-in users
      if (info.userId) {
        if (newName) db.updateUserDisplayName(info.userId, newName).catch(() => {});
        if (msg.icon && ALL_ICONS.includes(msg.icon)) db.updateUserIcon(info.userId, info.icon).catch(() => {});
      }

      // If already in a lobby, update there too
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (ctx) {
        const player = ctx.state.players[pid];
        if (player) {
          if (newName) player.name = newName;
          if (msg.icon && ICONS.includes(msg.icon)) player.icon = msg.icon;
          if (msg.icon && PREMIUM_ICON_IDS.includes(msg.icon) && info.userId) player.icon = msg.icon;
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
        network.send(ws, { type: 'lobby-list', lobbies: augmentLobbies(lobbies) });
      }).catch(() => {
        network.send(ws, { type: 'lobby-error', message: 'Failed to list lobbies' });
      });
      break;
    }

    case 'create-lobby': {
      const lobbyName = String(msg.name || '').trim().slice(0, 32) || 'Game Lobby';
      const maxPlayers = parseInt(msg.maxPlayers, 10) || undefined;
      const difficulty = String(msg.difficulty || 'medium').trim();
      const validDifficulties = ['easy', 'medium', 'hard'];
      const finalDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium';
      const customConfig = msg.customConfig || undefined;

      lobby.createLobby(lobbyName, maxPlayers, finalDifficulty, customConfig).then(result => {
        if (result.error) {
          console.log(`[lobby] ${pid} create failed: ${result.error}`);
          network.send(ws, { type: 'lobby-error', message: result.error });
          return;
        }
        console.log(`[lobby] ${pid} created lobby "${lobbyName}" (${result.lobby!.code}) difficulty: ${finalDifficulty}${customConfig ? ' (custom)' : ''}`);
        network.send(ws, { type: 'lobby-created', lobby: result.lobby });
        // Broadcast updated lobby list to all unattached clients
        broadcastLobbyList(wss);
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
        await handleLeaveLobby(ws, pid, currentLobbyId, playerInfo);
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

        const ctx = getCtxForPlayer(pid, playerInfo);
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

        broadcastLobbyList(wss);
      }).catch(() => {
        network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
      });
      break;
    }

    case 'join-lobby-by-code': {
      const code = String(msg.code || '').trim().toUpperCase();
      if (!code) {
        network.send(ws, { type: 'lobby-error', message: 'Invalid invite code' });
        break;
      }

      try {
        const targetLobby = await db.getLobbyByCode(code);
        if (!targetLobby) {
          network.send(ws, { type: 'lobby-error', message: 'Lobby not found' });
          break;
        }

        const lobbyId = targetLobby.id;

        // Leave current lobby if in one
        const currentLobbyId = lobby.getLobbyForPlayer(pid);
        if (currentLobbyId) {
          await handleLeaveLobby(ws, pid, currentLobbyId, playerInfo);
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

        const result = await lobby.joinLobby(lobbyId, pid, playerData);
        if (result.error) {
          console.log(`[lobby] ${pid} join-by-code failed (code ${code}): ${result.error}`);
          network.send(ws, { type: 'lobby-error', message: result.error });
          break;
        }

        network.wsToLobby.set(ws, lobbyId);
        network.addClientToLobby(lobbyId, ws);

        const ctx = getCtxForPlayer(pid, playerInfo);
        if (!ctx) break;

        console.log(`[lobby] ${pid} joined lobby ${lobbyId} via invite code ${code} (${Object.keys(ctx.state.players).length} players)`);

        network.send(ws, {
          type: 'lobby-joined',
          lobbyId,
          lobbyName: result.lobby!.name,
          lobbyCode: result.lobby!.code,
          ...getStateSnapshot(ctx.state),
        });

        network.broadcastToLobby(lobbyId, {
          type: 'player-joined',
          player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0 },
          playerCount: Object.keys(ctx.state.players).length,
        }, ws);

        broadcastLobbyList(wss);
      } catch {
        network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
      }
      break;
    }

    case 'leave-lobby': {
      const currentLobbyId = lobby.getLobbyForPlayer(pid);
      if (currentLobbyId) {
        console.log(`[lobby] ${pid} left lobby ${currentLobbyId}`);
        await handleLeaveLobby(ws, pid, currentLobbyId, playerInfo);
        network.send(ws, { type: 'lobby-left' });
        broadcastLobbyList(wss);
      }
      break;
    }

    case 'start-game': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      if (ctx.state.phase === 'lobby' || ctx.state.phase === 'gameover' || ctx.state.phase === 'win') {
        console.log(`[game] ${pid} started game in lobby ${ctx.lobbyId} (${Object.keys(ctx.state.players).length} players)`);
        game.startGame(ctx);
      }
      break;
    }

    case 'click-bug': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') break;
      const bug = st.bugs[msg.bugId];
      if (!bug) break;
      const descriptor = entityTypes.getDescriptor(bug);
      descriptor.onClick(bug, ctx, pid, msg);
      break;
    }

    case 'click-breakpoint': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') break;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isInfiniteLoop) break;
      entityTypes.handleBreakpointClick(bug, ctx, pid);
      break;
    }

    case 'click-memory-leak-start': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') break;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isMemoryLeak) break;
      entityTypes.getDescriptor(bug).onHoldStart!(bug, ctx, pid);
      break;
    }

    case 'click-memory-leak-complete': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') break;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isMemoryLeak) break;
      entityTypes.getDescriptor(bug).onHoldComplete!(bug, ctx, pid);
      break;
    }

    case 'click-boss': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      boss.handleBossClick(ctx, pid);
      break;
    }

    case 'click-duck': {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) break;
      powerups.collectDuck(ctx, pid);
      break;
    }

    case 'click-hammer': {
      const ctx = getCtxForPlayer(pid, playerInfo);
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

    case 'get-my-stats': {
      const info = playerInfo.get(pid);
      if (!info?.userId) {
        network.send(ws, { type: 'my-stats', stats: null });
        break;
      }
      db.getUserStats(info.userId).then(stats => {
        network.send(ws, { type: 'my-stats', stats });
      }).catch(() => {
        network.send(ws, { type: 'my-stats', stats: null });
      });
      break;
    }

    case 'get-recordings': {
      const info = playerInfo.get(pid);
      if (!info?.userId) {
        network.send(ws, { type: 'recordings-list', recordings: [] });
        break;
      }
      db.getRecordingsList(info.userId).then(recordings => {
        network.send(ws, { type: 'recordings-list', recordings });
      }).catch(() => {
        network.send(ws, { type: 'recording-error', message: 'Failed to load recordings' });
      });
      break;
    }

    case 'share-recording': {
      const info = playerInfo.get(pid);
      if (!info?.userId) {
        network.send(ws, { type: 'recording-error', message: 'Not logged in' });
        break;
      }
      const recordingId = parseInt(msg.id, 10);
      if (!recordingId) {
        network.send(ws, { type: 'recording-error', message: 'Invalid recording ID' });
        break;
      }
      db.shareRecording(recordingId, info.userId).then(shareToken => {
        if (!shareToken) {
          network.send(ws, { type: 'recording-error', message: 'Recording not found' });
          return;
        }
        network.send(ws, { type: 'recording-shared', id: recordingId, shareToken });
      }).catch(() => {
        network.send(ws, { type: 'recording-error', message: 'Failed to share recording' });
      });
      break;
    }

    case 'unshare-recording': {
      const info = playerInfo.get(pid);
      if (!info?.userId) {
        network.send(ws, { type: 'recording-error', message: 'Not logged in' });
        break;
      }
      const recordingId = parseInt(msg.id, 10);
      if (!recordingId) {
        network.send(ws, { type: 'recording-error', message: 'Invalid recording ID' });
        break;
      }
      db.unshareRecording(recordingId, info.userId).then(success => {
        if (!success) {
          network.send(ws, { type: 'recording-error', message: 'Recording not found or not shared' });
          return;
        }
        network.send(ws, { type: 'recording-unshared', id: recordingId });
      }).catch(() => {
        network.send(ws, { type: 'recording-error', message: 'Failed to unshare recording' });
      });
      break;
    }

    case 'cursor-move': {
      const ctx = getCtxForPlayer(pid, playerInfo);
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
}

/**
 * Setup WebSocket connection handler
 */
export function setupWebSocketConnection(
  ws: WebSocket,
  playerId: string,
  color: string,
  icon: string,
  name: string,
  playerInfo: Map<string, PlayerInfo>,
  wss: any
) {
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
    onlineCount: wss.clients.size,
  });

  // Broadcast updated online count to all clients
  network.broadcast({ type: 'online-count', count: wss.clients.size });
  gamePlayersOnline.inc();

  // WebSocket error handler
  ws.on('error', (err: Error) => {
    console.error(`[ws-error] ${playerId}:`, err.message);
    try {
      ws.close();
    } catch (closeErr) {
      console.error('Error closing WebSocket after error:', closeErr);
    }
  });

  // Message handler
  ws.on('message', async (raw: RawData) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const pid = network.wsToPlayer.get(ws);
    if (!pid) return;

    wsMessagesReceived.inc({ type: msg.type || 'unknown' });

    try {
      await handleMessage(ws, msg, pid, playerInfo, wss);
    } catch (err) {
      console.error(`[msg-error] ${pid} handling ${msg.type}:`, err);
      try {
        network.send(ws, { type: 'error', message: 'Internal server error' });
      } catch (sendErr) {
        console.error('Error sending error message:', sendErr);
      }
    }
  });

  // Close handler
  ws.on('close', async () => {
    try {
      const pid = network.wsToPlayer.get(ws);
      network.wsToPlayer.delete(ws);
      network.wsToLobby.delete(ws);

      if (pid) {
        const currentLobbyId = lobby.getLobbyForPlayer(pid);
        if (currentLobbyId) {
          console.log(`[disconnect] ${pid} left lobby ${currentLobbyId} (disconnected)`);
          await handleLeaveLobby(ws, pid, currentLobbyId, playerInfo);
          broadcastLobbyList(wss);
        }
        playerInfo.delete(pid);
        console.log(`[disconnect] ${pid} disconnected (${wss.clients.size} online)`);
      }

      // Broadcast updated online count to all remaining clients
      network.broadcast({ type: 'online-count', count: wss.clients.size });
      gamePlayersOnline.dec();
    } catch (err) {
      console.error('Error handling WebSocket close:', err);
    }
  });
}
