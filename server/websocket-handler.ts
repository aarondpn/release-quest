import type { WebSocket, RawData } from 'ws';
import type { ZodError } from 'zod';
import type { PlayerInfo } from './types.ts';
import logger, { createPlayerLogger } from './logger.ts';
import * as network from './network.ts';
import * as lobby from './lobby.ts';
import { handleLeaveLobby, broadcastLobbyList } from './helpers.ts';
import { handlers, schemas } from './handlers/index.ts';
import { wsMessagesReceived, gamePlayersOnline } from './metrics.ts';

function formatValidationError(messageType: string, error: ZodError) {
  return {
    type: 'validation-error',
    messageType,
    errors: error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

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
  const handler = handlers[msg.type];
  if (!handler) return;

  const schema = schemas[msg.type];
  if (schema) {
    const result = schema.safeParse(msg);
    if (!result.success) {
      network.send(ws, formatValidationError(msg.type, result.error));
      return;
    }
    msg = result.data;
  }

  await handler({ ws, msg, pid, playerInfo, wss });
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

  const playerLogger = createPlayerLogger(playerId);
  playerLogger.info({ onlineCount: wss.clients.size }, 'Player connected');

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
    playerLogger.error({ err: err.message }, 'WebSocket error');
    try {
      ws.close();
    } catch (closeErr) {
      playerLogger.error({ err: closeErr }, 'Error closing WebSocket after error');
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
      playerLogger.error({ err, messageType: msg.type }, 'Error handling message');
      try {
        network.send(ws, { type: 'error', message: 'Internal server error' });
      } catch (sendErr) {
        playerLogger.error({ err: sendErr }, 'Error sending error message');
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
          const disconnectLogger = createPlayerLogger(pid, { lobbyId: currentLobbyId });
          disconnectLogger.info('Player left lobby (disconnected)');
          await handleLeaveLobby(ws, pid, currentLobbyId, playerInfo);
          broadcastLobbyList(wss);
        }
        playerInfo.delete(pid);
        const playerLogger = createPlayerLogger(pid);
        playerLogger.info({ onlineCount: wss.clients.size }, 'Player disconnected');
      }

      // Broadcast updated online count to all remaining clients
      network.broadcast({ type: 'online-count', count: wss.clients.size });
      gamePlayersOnline.dec();
    } catch (err) {
      logger.error({ err }, 'Error handling WebSocket close');
    }
  });
}
