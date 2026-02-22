import type { HandlerContext, MessageHandler } from './types.ts';
import type { PlayerInfo, ServerMessage } from '../types.ts';
import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import { createPlayerLogger, createLobbyLogger } from '../logger.ts';
import { getStateSnapshot } from '../state.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as lobby from '../lobby.ts';
import { getCtxForPlayer, handleLeaveLobby as doLeaveLobby, broadcastLobbyList, augmentLobbies } from '../helpers.ts';
import { initChatForLobby, getLobbyModerator, removePlayerFromChat, broadcastSystemChat } from './chat.ts';

// Returns true if the same registered user (by userId) or the same guest session
// (by guestToken) already occupies a player or spectator slot in the lobby under
// a *different* WebSocket connection (i.e. another tab).
function isSameIdentityInLobby(
  lobbyId: number,
  pid: string,
  playerInfo: Map<string, PlayerInfo>,
): boolean {
  const joining = playerInfo.get(pid);
  if (!joining) return false;
  // No persistent identity → can't detect duplicates
  if (!joining.userId && !joining.guestToken) return false;

  const mem = lobby.getLobbyState(lobbyId);
  if (mem) {
    for (const existingPid of Object.keys(mem.state.players)) {
      if (existingPid === pid) continue;
      const existing = playerInfo.get(existingPid);
      if (!existing) continue;
      if (joining.userId !== undefined && existing.userId === joining.userId) return true;
      if (joining.guestToken !== undefined && existing.guestToken === joining.guestToken) return true;
    }
  }

  for (const existingPid of lobby.getSpectators(lobbyId)) {
    if (existingPid === pid) continue;
    const existing = playerInfo.get(existingPid);
    if (!existing) continue;
    if (joining.userId !== undefined && existing.userId === joining.userId) return true;
    if (joining.guestToken !== undefined && existing.guestToken === joining.guestToken) return true;
  }

  return false;
}

export const handleListLobbies: MessageHandler = ({ ws }) => {
  lobby.listLobbies().then(lobbies => {
    network.send(ws, { type: 'lobby-list', lobbies: augmentLobbies(lobbies) });
  }).catch(() => {
    network.send(ws, { type: 'lobby-error', message: 'Failed to list lobbies' });
  });
};

export const handleCreateLobby: MessageHandler = ({ ws, msg, pid, wss }) => {
  const lobbyName = String(msg.name || '').trim().slice(0, 32) || 'Game Lobby';
  const maxPlayers = parseInt(msg.maxPlayers, 10) || undefined;
  const difficulty = String(msg.difficulty || 'medium').trim();
  const validDifficulties = ['easy', 'medium', 'hard'];
  const finalDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium';
  const customConfig = msg.customConfig || undefined;
  const password = String(msg.password || '').trim() || undefined;
  const gameMode = msg.gameMode === 'roguelike' ? 'roguelike' as const : 'classic' as const;

  const playerLogger = createPlayerLogger(pid);

  lobby.createLobby(lobbyName, maxPlayers, finalDifficulty, customConfig, password, gameMode).then(result => {
    if (result.error) {
      playerLogger.info({ error: result.error }, 'Lobby creation failed');
      network.send(ws, { type: 'lobby-error', message: result.error });
      return;
    }
    playerLogger.info({ lobbyName, lobbyCode: result.lobby!.code, difficulty: finalDifficulty, customConfig: !!customConfig }, 'Lobby created');
    initChatForLobby(result.lobby!.id, pid);
    const lobbyResponse = { ...result.lobby! } as any;
    if (lobbyResponse.settings?.password) {
      lobbyResponse.settings = { ...lobbyResponse.settings };
      delete lobbyResponse.settings.password;
    }
    network.send(ws, { type: 'lobby-created', lobby: lobbyResponse });
    // Broadcast updated lobby list to all unattached clients
    broadcastLobbyList(wss);
  }).catch(() => {
    network.send(ws, { type: 'lobby-error', message: 'Failed to create lobby' });
  });
};

export const handleJoinLobby: MessageHandler = async ({ ws, msg, pid, playerInfo, wss }) => {
  const lobbyId = parseInt(msg.lobbyId, 10);
  if (!lobbyId) {
    network.send(ws, { type: 'lobby-error', message: 'Invalid lobby ID' });
    return;
  }

  // Check password before joining
  const targetLobby = await db.getLobby(lobbyId);
  if (targetLobby) {
    const lobbyPassword = (targetLobby.settings as any)?.password;
    if (lobbyPassword) {
      if (!msg.password) {
        network.send(ws, { type: 'lobby-error', message: 'This lobby requires a password', needsPassword: true, lobbyId });
        return;
      }
      if (msg.password !== lobbyPassword) {
        network.send(ws, { type: 'lobby-error', message: 'Incorrect password', needsPassword: true, lobbyId });
        return;
      }
    }
  }

  // Prevent the same user/guest from joining in multiple tabs
  if (isSameIdentityInLobby(lobbyId, pid, playerInfo)) {
    network.send(ws, { type: 'lobby-error', message: 'You are already in this lobby in another tab' });
    return;
  }

  // Leave current lobby if in one
  const currentLobbyId = lobby.getLobbyForPlayer(pid);
  if (currentLobbyId) {
    await doLeaveLobby(ws, pid, currentLobbyId, playerInfo);
  }

  const info = playerInfo.get(pid);
  if (!info) return;

  const playerLogger = createPlayerLogger(pid);

  const playerData = {
    id: pid,
    name: info.name,
    color: info.color,
    icon: info.icon,
    x: LOGICAL_W / 2,
    y: LOGICAL_H / 2,
    score: 0,
    bugsSquashed: 0,
    isGuest: !info.userId,
  };

  lobby.joinLobby(lobbyId, pid, playerData).then(result => {
    if (result.error) {
      playerLogger.info({ lobbyId, error: result.error }, 'Lobby join failed');
      network.send(ws, { type: 'lobby-error', message: result.error });
      return;
    }

    network.wsToLobby.set(ws, lobbyId);
    network.addClientToLobby(lobbyId, ws);

    const ctx = getCtxForPlayer(pid, playerInfo);
    if (!ctx) return;

    const lobbyLogger = createLobbyLogger(lobbyId.toString());
    lobbyLogger.info({ playerId: pid, playerCount: Object.keys(ctx.state.players).length }, 'Player joined lobby');

    // Send lobby-joined with full game state (getStateSnapshot returns Record<string, unknown>)
    network.send(ws, {
      type: 'lobby-joined',
      lobbyId,
      lobbyName: result.lobby!.name,
      lobbyCode: result.lobby!.code,
      creatorId: getLobbyModerator(lobbyId),
      ...getStateSnapshot(ctx.state),
    } as ServerMessage);

    // Notify others in the lobby
    network.broadcastToLobby(lobbyId, {
      type: 'player-joined',
      player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0, isGuest: !info.userId },
      playerCount: Object.keys(ctx.state.players).length,
    });

    broadcastSystemChat(lobbyId, `${info.name} joined`);
    broadcastLobbyList(wss);
  }).catch(() => {
    network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
  });
};

export const handleJoinLobbyByCode: MessageHandler = async ({ ws, msg, pid, playerInfo, wss }) => {
  const code = String(msg.code || '').trim().toUpperCase();
  if (!code) {
    network.send(ws, { type: 'lobby-error', message: 'Invalid invite code' });
    return;
  }

  try {
    const targetLobby = await db.getLobbyByCode(code);
    if (!targetLobby) {
      network.send(ws, { type: 'lobby-error', message: 'Lobby not found' });
      return;
    }

    // Check password
    const lobbyPassword = (targetLobby.settings as any)?.password;
    if (lobbyPassword) {
      if (!msg.password) {
        network.send(ws, { type: 'lobby-error', message: 'This lobby requires a password', needsPassword: true, lobbyId: targetLobby.id, code });
        return;
      }
      if (msg.password !== lobbyPassword) {
        network.send(ws, { type: 'lobby-error', message: 'Incorrect password', needsPassword: true, lobbyId: targetLobby.id, code });
        return;
      }
    }

    const lobbyId = targetLobby.id;

    // Prevent the same user/guest from joining in multiple tabs
    if (isSameIdentityInLobby(lobbyId, pid, playerInfo)) {
      network.send(ws, { type: 'lobby-error', message: 'You are already in this lobby in another tab' });
      return;
    }

    // Leave current lobby if in one
    const currentLobbyId = lobby.getLobbyForPlayer(pid);
    if (currentLobbyId) {
      await doLeaveLobby(ws, pid, currentLobbyId, playerInfo);
    }

    const info = playerInfo.get(pid);
    if (!info) return;

    const playerData = {
      id: pid,
      name: info.name,
      color: info.color,
      icon: info.icon,
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      score: 0,
      bugsSquashed: 0,
      isGuest: !info.userId,
    };

    const playerLogger = createPlayerLogger(pid);

    const result = await lobby.joinLobby(lobbyId, pid, playerData);
    if (result.error) {
      playerLogger.info({ code, error: result.error }, 'Join by code failed');
      network.send(ws, { type: 'lobby-error', message: result.error });
      return;
    }

    network.wsToLobby.set(ws, lobbyId);
    network.addClientToLobby(lobbyId, ws);

    const ctx = getCtxForPlayer(pid, playerInfo);
    if (!ctx) return;

    const lobbyLogger = createLobbyLogger(lobbyId.toString());
    lobbyLogger.info({ playerId: pid, code, playerCount: Object.keys(ctx.state.players).length }, 'Player joined via invite code');

    network.send(ws, {
      type: 'lobby-joined',
      lobbyId,
      lobbyName: result.lobby!.name,
      lobbyCode: result.lobby!.code,
      creatorId: getLobbyModerator(lobbyId),
      ...getStateSnapshot(ctx.state),
    } as ServerMessage);

    network.broadcastToLobby(lobbyId, {
      type: 'player-joined',
      player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0, isGuest: !info.userId },
      playerCount: Object.keys(ctx.state.players).length,
    });

    broadcastSystemChat(lobbyId, `${info.name} joined`);
    broadcastLobbyList(wss);
  } catch {
    network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
  }
};

export const handleJoinSpectate: MessageHandler = async ({ ws, msg, pid, playerInfo }) => {
  const lobbyId = parseInt(msg.lobbyId, 10);
  if (!lobbyId) {
    network.send(ws, { type: 'lobby-error', message: 'Invalid lobby ID' });
    return;
  }

  // Reject if already a player in any lobby
  if (lobby.getLobbyForPlayer(pid)) {
    network.send(ws, { type: 'lobby-error', message: 'Leave your current lobby before spectating' });
    return;
  }

  // Prevent the same user/guest from spectating in multiple tabs
  if (isSameIdentityInLobby(lobbyId, pid, playerInfo)) {
    network.send(ws, { type: 'lobby-error', message: 'You are already in this lobby in another tab' });
    return;
  }

  // If already spectating this same lobby, reject
  if (lobby.getSpectatorLobby(pid) === lobbyId) {
    network.send(ws, { type: 'lobby-error', message: 'Already spectating this lobby' });
    return;
  }

  // Auto-leave any other spectated lobby first
  const currentSpectatingId = lobby.getSpectatorLobby(pid);
  if (currentSpectatingId) {
    lobby.removeSpectator(currentSpectatingId, pid);
    network.wsToLobby.delete(ws);
    network.removeClientFromLobby(currentSpectatingId, ws);
  }

  const targetLobby = await db.getLobby(lobbyId);
  if (!targetLobby) {
    network.send(ws, { type: 'lobby-error', message: 'Lobby not found' });
    return;
  }
  if (targetLobby.status !== 'active') {
    network.send(ws, { type: 'lobby-error', message: 'Lobby is no longer active' });
    return;
  }

  const lobbyPassword = (targetLobby.settings as any)?.password;
  if (lobbyPassword) {
    if (!msg.password) {
      network.send(ws, { type: 'lobby-error', message: 'This lobby requires a password', needsPassword: true, lobbyId });
      return;
    }
    if (msg.password !== lobbyPassword) {
      network.send(ws, { type: 'lobby-error', message: 'Incorrect password', needsPassword: true, lobbyId });
      return;
    }
  }

  const mem = lobby.getLobbyState(lobbyId);
  if (!mem) {
    network.send(ws, { type: 'lobby-error', message: 'Lobby not found' });
    return;
  }

  lobby.addSpectator(lobbyId, pid);
  network.wsToLobby.set(ws, lobbyId);
  network.addClientToLobby(lobbyId, ws);

  const lobbyLogger = createLobbyLogger(lobbyId.toString());
  lobbyLogger.info({ playerId: pid }, 'Spectator joined lobby');

  const { password: _pw, ...safeSettings } = (targetLobby.settings as any) || {};
  network.send(ws, {
    type: 'spectator-joined',
    lobbyId,
    lobbyName: targetLobby.name,
    lobbyCode: targetLobby.code,
    hasCustomSettings: !!(safeSettings?.customConfig && Object.keys(safeSettings.customConfig).length > 0),
    ...getStateSnapshot(mem.state),
  } as ServerMessage);

  const specSet = lobby.getSpectators(lobbyId);
  network.broadcastToLobby(lobbyId, {
    type: 'spectator-count',
    count: specSet.size,
    spectators: [...specSet].map(id => {
      const sInfo = playerInfo.get(id);
      return { id, name: sInfo?.name || 'Unknown', icon: sInfo?.icon || '👁' };
    }),
  });
};

export const handleLeaveSpectate: MessageHandler = ({ ws, pid, playerInfo }) => {
  const lobbyId = lobby.getSpectatorLobby(pid);
  if (!lobbyId) return;

  lobby.removeSpectator(lobbyId, pid);
  network.wsToLobby.delete(ws);
  network.removeClientFromLobby(lobbyId, ws);

  network.send(ws, { type: 'lobby-left' });

  const specSet = lobby.getSpectators(lobbyId);
  network.broadcastToLobby(lobbyId, {
    type: 'spectator-count',
    count: specSet.size,
    spectators: [...specSet].map(id => {
      const sInfo = playerInfo.get(id);
      return { id, name: sInfo?.name || 'Unknown', icon: sInfo?.icon || '👁' };
    }),
  });

  const lobbyLogger = createLobbyLogger(lobbyId.toString());
  lobbyLogger.info({ playerId: pid }, 'Spectator left lobby');
};

export const handleLeaveLobby: MessageHandler = async ({ ws, pid, playerInfo, wss }) => {
  const currentLobbyId = lobby.getLobbyForPlayer(pid);
  if (currentLobbyId) {
    const lobbyLogger = createLobbyLogger(currentLobbyId.toString());
    lobbyLogger.info({ playerId: pid }, 'Player left lobby');
    const info = playerInfo.get(pid);
    broadcastSystemChat(currentLobbyId, `${info?.name || 'Unknown'} left`);
    removePlayerFromChat(currentLobbyId, pid);
    await doLeaveLobby(ws, pid, currentLobbyId, playerInfo);
    network.send(ws, { type: 'lobby-left' });
    broadcastLobbyList(wss);
  }
};
