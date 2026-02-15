import type { HandlerContext, MessageHandler } from './types.ts';
import { ALL_ICONS } from '../config.ts';
import { createPlayerLogger } from '../logger.ts';
import * as network from '../network.ts';
import * as auth from '../auth.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleRegister: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');
  const displayName = String(msg.displayName || '').trim().slice(0, 16);
  const regIcon: string | undefined = msg.icon && ALL_ICONS.includes(msg.icon) ? msg.icon : undefined;

  const playerLogger = createPlayerLogger(pid);

  auth.register(username, password, displayName, regIcon).then(async result => {
    if (result.error !== undefined) {
      playerLogger.info({ username, error: result.error }, 'Registration failed');
      network.send(ws, { type: 'auth-result', action: 'register', success: false, error: result.error });
      return;
    }
    playerLogger.info({ username: result.user.username, displayName: result.user.displayName }, 'User registered');
    const info = playerInfo.get(pid);
    if (info) {
      info.name = result.user.displayName;
      info.icon = result.user.icon;
      info.userId = result.user.id;
    }
    // Link player session to user
    const playerSessionToken = network.playerToSessionToken.get(pid);
    if (playerSessionToken) {
      try {
        await auth.linkPlayerSessionToUser(playerSessionToken, result.user.id);
        // Update session with user's display name and icon
        await auth.updatePlayerSessionInfo(playerSessionToken, result.user.displayName, result.user.icon);
      } catch (err) {
        playerLogger.error({ err }, 'Failed to link player session to user');
      }
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
};

export const handleLogin: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');

  const playerLogger = createPlayerLogger(pid);

  auth.login(username, password).then(async result => {
    if (result.error !== undefined) {
      playerLogger.info({ username, error: result.error }, 'Login failed');
      network.send(ws, { type: 'auth-result', action: 'login', success: false, error: result.error });
      return;
    }
    playerLogger.info({ username: result.user.username, displayName: result.user.displayName }, 'User logged in');
    const info = playerInfo.get(pid);
    if (info) {
      info.name = result.user.displayName;
      info.icon = result.user.icon;
      info.userId = result.user.id;
    }
    // Link player session to user
    const playerSessionToken = network.playerToSessionToken.get(pid);
    if (playerSessionToken) {
      try {
        await auth.linkPlayerSessionToUser(playerSessionToken, result.user.id);
        // Update session with user's display name and icon
        await auth.updatePlayerSessionInfo(playerSessionToken, result.user.displayName, result.user.icon);
      } catch (err) {
        playerLogger.error({ err }, 'Failed to link player session to user');
      }
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
};

export const handleLogout: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const token = String(msg.token || '');
  const playerLogger = createPlayerLogger(pid);
  
  auth.logout(token).then(() => {
    const info = playerInfo.get(pid);
    playerLogger.info('User logged out');
    if (info) {
      delete info.userId;
    }
    network.send(ws, { type: 'auth-result', action: 'logout', success: true });
  }).catch(() => {
    network.send(ws, { type: 'auth-result', action: 'logout', success: true });
  });
};

export const handleResumeSession: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const token = String(msg.token || '');
  const playerLogger = createPlayerLogger(pid);
  
  auth.validateSession(token).then(async user => {
    if (!user) {
      playerLogger.info('Session resume failed (expired/invalid)');
      network.send(ws, { type: 'auth-result', action: 'resume', success: false, error: 'Session expired' });
      return;
    }
    playerLogger.info({ username: user.username, displayName: user.displayName }, 'Session resumed');
    const info = playerInfo.get(pid);
    if (info) {
      info.name = user.displayName;
      info.icon = user.icon;
      info.userId = user.id;
    }
    // Link player session to user
    const playerSessionToken = network.playerToSessionToken.get(pid);
    if (playerSessionToken) {
      try {
        await auth.linkPlayerSessionToUser(playerSessionToken, user.id);
        // Update session with user's display name and icon
        await auth.updatePlayerSessionInfo(playerSessionToken, user.displayName, user.icon);
      } catch (err) {
        playerLogger.error({ err }, 'Failed to link player session to user');
      }
    }
    network.send(ws, {
      type: 'auth-result', action: 'resume', success: true,
      user: { id: user.id, username: user.username, displayName: user.displayName, icon: user.icon },
    });
  }).catch(() => {
    network.send(ws, { type: 'auth-result', action: 'resume', success: false, error: 'Session validation failed' });
  });
};
