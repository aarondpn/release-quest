import type { HandlerContext, MessageHandler } from './types.ts';
import { LOGICAL_W, LOGICAL_H } from '../config.ts';
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
    };

    const result = await lobby.joinLobby(lobbyId, pid, playerData);
    if (result.error) {
      console.log(`[lobby] ${pid} join-by-code failed (code ${code}): ${result.error}`);
      network.send(ws, { type: 'lobby-error', message: result.error });
      return;
    }

    network.wsToLobby.set(ws, lobbyId);
    network.addClientToLobby(lobbyId, ws);

    const ctx = getCtxForPlayer(pid, playerInfo);
    if (!ctx) return;

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
};

export const handleLeaveLobby: MessageHandler = async ({ ws, pid, playerInfo, wss }) => {
  const currentLobbyId = lobby.getLobbyForPlayer(pid);
  if (currentLobbyId) {
    console.log(`[lobby] ${pid} left lobby ${currentLobbyId}`);
    await doLeaveLobby(ws, pid, currentLobbyId, playerInfo);
    network.send(ws, { type: 'lobby-left' });
    broadcastLobbyList(wss);
  }
};
