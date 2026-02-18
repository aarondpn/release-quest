import type { HandlerContext, MessageHandler } from './types.ts';
import { ALL_ICONS, ICONS, GUEST_NAMES } from '../config.ts';
import { createPlayerLogger } from '../logger.ts';
import * as network from '../network.ts';
import * as auth from '../auth.ts';
import * as db from '../db.ts';
import { getCtxForPlayer } from '../helpers.ts';

const authRateLimitBuckets = new Map<string, number[]>();
const AUTH_RATE_LIMIT_MAX = 5;
const AUTH_RATE_LIMIT_WINDOW_MS = 30_000;

function isAuthRateLimited(pid: string): boolean {
  const now = Date.now();
  let bucket = authRateLimitBuckets.get(pid);
  if (!bucket) {
    bucket = [];
    authRateLimitBuckets.set(pid, bucket);
  }
  while (bucket.length > 0 && bucket[0] <= now - AUTH_RATE_LIMIT_WINDOW_MS) {
    bucket.shift();
  }
  if (bucket.length >= AUTH_RATE_LIMIT_MAX) {
    return true;
  }
  bucket.push(now);
  return false;
}

export function cleanupAuthRateLimit(pid: string): void {
  authRateLimitBuckets.delete(pid);
}

export const handleRegister: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  if (isAuthRateLimited(pid)) {
    network.send(ws, { type: 'auth-result', action: 'register', success: false, error: 'Too many attempts. Please wait.' });
    return;
  }

  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');
  const displayName = String(msg.displayName || '').trim().slice(0, 16);
  const regIcon: string | undefined = msg.icon && ALL_ICONS.includes(msg.icon) ? msg.icon : undefined;

  const playerLogger = createPlayerLogger(pid);

  auth.register(username, password, displayName, regIcon).then(result => {
    if (result.error !== undefined) {
      playerLogger.info({ username, error: result.error }, 'Registration failed');
      network.send(ws, { type: 'auth-result', action: 'register', success: false, error: result.error });
      return;
    }
    playerLogger.info({ username: result.user.username, displayName: result.user.displayName }, 'User registered');
    const info = playerInfo.get(pid);
    if (info) {
      if (info.guestToken) {
        db.deleteGuestSession(info.guestToken).catch(() => {});
        delete info.guestToken;
      }
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
        player.isGuest = false;
        network.broadcastToLobby(ctx.lobbyId, {
          type: 'player-joined',
          player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score, isGuest: false },
          playerCount: Object.keys(ctx.state.players).length,
        });
      }
    }
  }).catch(() => {
    network.send(ws, { type: 'auth-result', action: 'register', success: false, error: 'Registration failed' });
  });
};

export const handleLogin: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  if (isAuthRateLimited(pid)) {
    network.send(ws, { type: 'auth-result', action: 'login', success: false, error: 'Too many attempts. Please wait.' });
    return;
  }

  const username = String(msg.username || '').trim();
  const password = String(msg.password || '');

  const playerLogger = createPlayerLogger(pid);

  auth.login(username, password).then(result => {
    if (result.error !== undefined) {
      playerLogger.info({ username, error: result.error }, 'Login failed');
      network.send(ws, { type: 'auth-result', action: 'login', success: false, error: result.error });
      return;
    }
    playerLogger.info({ username: result.user.username, displayName: result.user.displayName }, 'User logged in');
    const info = playerInfo.get(pid);
    if (info) {
      if (info.guestToken) {
        db.deleteGuestSession(info.guestToken).catch(() => {});
        delete info.guestToken;
      }
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
        player.isGuest = false;
        network.broadcastToLobby(ctx.lobbyId, {
          type: 'player-joined',
          player: { id: pid, name: player.name, color: player.color, icon: player.icon, score: player.score, isGuest: false },
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
      // Clean up guest session if one exists
      if (info.guestToken) {
        db.deleteGuestSession(info.guestToken).catch(() => {});
        delete info.guestToken;
      }
      delete info.userId;
      // Reset to fresh random guest identity
      info.name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
      info.icon = ICONS[Math.floor(Math.random() * ICONS.length)];
    }
    network.send(ws, {
      type: 'auth-result', action: 'logout', success: true,
      name: info?.name, icon: info?.icon,
    });
  }).catch(() => {
    network.send(ws, { type: 'auth-result', action: 'logout', success: true });
  });
};

export const handleResumeGuest: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const token = msg.token ? String(msg.token) : '';
  const playerLogger = createPlayerLogger(pid);

  const resume = async () => {
    const info = playerInfo.get(pid);
    if (!info) return;

    // If token provided, try to restore existing guest session
    if (token) {
      const session = await auth.validateGuestSession(token);
      if (session) {
        info.name = session.name;
        info.icon = session.icon;
        info.guestToken = session.token;
        playerLogger.info('Guest session resumed');
        network.send(ws, {
          type: 'guest-session', success: true, resumed: true,
          name: session.name, icon: session.icon, token: session.token,
        });
        return;
      }
    }

    // No token or invalid/expired — create a new guest session with current name/icon
    const session = await auth.createGuestSession(info.name, info.icon);
    info.guestToken = session.token;
    playerLogger.info('Guest session created');
    network.send(ws, {
      type: 'guest-session', success: true, resumed: false,
      name: session.name, icon: session.icon, token: session.token,
    });
  };

  resume().catch(() => {
    network.send(ws, { type: 'guest-session', success: false });
  });
};

export const handleResumeSession: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const token = String(msg.token || '');
  const playerLogger = createPlayerLogger(pid);
  
  auth.validateSession(token).then(user => {
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
    network.send(ws, {
      type: 'auth-result', action: 'resume', success: true,
      user: { id: user.id, username: user.username, displayName: user.displayName, icon: user.icon },
    });
  }).catch(() => {
    network.send(ws, { type: 'auth-result', action: 'resume', success: false, error: 'Session validation failed' });
  });
};
