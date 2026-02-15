import type { WebSocket, WebSocketServer } from 'ws';
import logger from './logger.ts';
import { recordEvent } from './recording.ts';
import { wsMessagesSent } from './metrics.ts';

let wss: WebSocketServer | null = null;
export const wsToPlayer = new Map<WebSocket, string>();
export const wsToLobby = new Map<WebSocket, number>();
export const lobbyClients = new Map<number, Set<WebSocket>>();

export function init(server: WebSocketServer): void {
  wss = server;
}

export function addClientToLobby(lobbyId: number, ws: WebSocket): void {
  let set = lobbyClients.get(lobbyId);
  if (!set) {
    set = new Set();
    lobbyClients.set(lobbyId, set);
  }
  set.add(ws);
}

export function removeClientFromLobby(lobbyId: number, ws: WebSocket): void {
  const set = lobbyClients.get(lobbyId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      lobbyClients.delete(lobbyId);
    }
  }
}

export function broadcast(msg: Record<string, unknown>, exclude?: WebSocket): void {
  try {
    const data = JSON.stringify(msg);
    wss!.clients.forEach(client => {
      try {
        if (client !== exclude && client.readyState === 1) {
          client.send(data);
          wsMessagesSent.inc();
        }
      } catch (err) {
        logger.error({ err }, 'Error broadcasting to client');
      }
    });
  } catch (err) {
    logger.error({ err }, 'Error in broadcast');
  }
}

export function broadcastToLobby(lobbyId: number, msg: Record<string, unknown>, exclude?: WebSocket): void {
  try {
    const set = lobbyClients.get(lobbyId);
    if (!set) return;
    const data = JSON.stringify(msg);
    for (const client of set) {
      try {
        if (client !== exclude && client.readyState === 1) {
          client.send(data);
          wsMessagesSent.inc();
        }
      } catch (err) {
        logger.error({ err, lobbyId }, 'Error broadcasting to lobby client');
      }
    }
    recordEvent(lobbyId, msg);
  } catch (err) {
    logger.error({ err, lobbyId }, 'Error in broadcastToLobby');
  }
}

export function send(ws: WebSocket, msg: Record<string, unknown>): void {
  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
      wsMessagesSent.inc();
    }
  } catch (err) {
    logger.error({ err }, 'Error sending message to client');
  }
}
