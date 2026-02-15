import type { HandlerContext, MessageHandler } from './types.ts';
import { LOGICAL_W, LOGICAL_H } from '../config.ts';
import { createPlayerLogger, createLobbyLogger } from '../logger.ts';
import { getStateSnapshot } from '../state.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';
import * as lobby from '../lobby.ts';
import { getCtxForPlayer, handleLeaveLobby as doLeaveLobby, broadcastLobbyList, augmentLobbies } from '../helpers.ts';

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

  const playerLogger = createPlayerLogger(pid);

  lobby.createLobby(lobbyName, maxPlayers, finalDifficulty, customConfig).then(result => {
    if (result.error) {
      playerLogger.info({ error: result.error }, 'Lobby creation failed');
      network.send(ws, { type: 'lobby-error', message: result.error });
      return;
    }
    playerLogger.info({ lobbyName, lobbyCode: result.lobby!.code, difficulty: finalDifficulty, customConfig: !!customConfig }, 'Lobby created');
    network.send(ws, { type: 'lobby-created', lobby: result.lobby });
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
      player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0, isGuest: !info.userId },
      playerCount: Object.keys(ctx.state.players).length,
    }, ws);

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

    const lobbyId = targetLobby.id;

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
      ...getStateSnapshot(ctx.state),
    });

    network.broadcastToLobby(lobbyId, {
      type: 'player-joined',
      player: { id: pid, name: info.name, color: info.color, icon: info.icon, score: 0, isGuest: !info.userId },
      playerCount: Object.keys(ctx.state.players).length,
    }, ws);

    broadcastLobbyList(wss);
  } catch {
    network.send(ws, { type: 'lobby-error', message: 'Failed to join lobby' });
  }
};

export const handleLeaveLobby: MessageHandler = async ({ ws, pid, playerInfo, wss }) => {
  const currentLobbyId = lobby.getLobbyForPlayer(pid);
  if (currentLobbyId) {
    const lobbyLogger = createLobbyLogger(currentLobbyId.toString());
    lobbyLogger.info({ playerId: pid }, 'Player left lobby');
    await doLeaveLobby(ws, pid, currentLobbyId, playerInfo);
    network.send(ws, { type: 'lobby-left' });
    broadcastLobbyList(wss);
  }
};
