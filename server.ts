import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

import logger from './server/logger.ts';
import { SERVER_CONFIG, COLORS, ICONS, GUEST_NAMES } from './server/config.ts';
import * as network from './server/network.ts';
import * as db from './server/db.ts';
import * as lobby from './server/lobby.ts';
import * as auth from './server/auth.ts';
import apiRoutes from './server/routes.ts';
import { errorHandler, notFoundHandler } from './server/middleware.ts';
import { setupWebSocketConnection } from './server/websocket-handler.ts';
import { broadcastLobbyList } from './server/helpers.ts';
import { metricsMiddleware, startMetricsServer, wsConnectionOpened, wsConnectionClosed } from './server/metrics.ts';
import type { PlayerInfo } from './server/types.ts';

// ── Global error handlers ──
process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err, stack: err.stack }, 'Uncaught exception');
  // Log but don't exit — try to keep server alive
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
});

// Graceful shutdown handlers
let isShuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info({ signal }, 'Shutting down gracefully');
  
  try {
    // Close all WebSocket connections
    wss.clients.forEach((client: WebSocket) => {
      try {
        client.close(1001, 'Server shutting down');
      } catch (err) {
        logger.error({ err }, 'Error closing client');
      }
    });
    
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database
    try {
      await db.close();
      logger.info('Database closed');
    } catch (err) {
      logger.error({ err }, 'Error closing database');
    }
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global counters for unique player IDs/colors across all lobbies
let nextPlayerId = 1;
let colorIndex = 0;

// Pre-lobby player info: playerId -> { name, color, icon }
const playerInfo = new Map<string, PlayerInfo>();

// ── Express app setup ──
const app = express();
app.disable('x-powered-by');
const httpServer = http.createServer(app);

// Metrics middleware (records HTTP request duration/count)
app.use(metricsMiddleware);

// Static file serving
app.use(express.static(path.join(import.meta.dirname, 'public')));

// API routes
app.use('/api', apiRoutes);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ── WebSocket server ──
const wss = new WebSocketServer({ server: httpServer });
network.init(wss);

// WebSocket connection handler
wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  // Parse session token from query parameters
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionToken = url.searchParams.get('sessionToken');
  
  let playerId: string;
  let color: string;
  let icon: string;
  let name: string;
  let existingUserId: number | null = null;
  let playerSessionToken: string;
  
  // Try to restore session if token provided
  if (sessionToken) {
    try {
      const session = await auth.validatePlayerSession(sessionToken);
      if (session) {
        // Restore from existing session
        playerId = session.playerId;
        name = session.name;
        color = session.color;
        icon = session.icon;
        existingUserId = session.userId;
        playerSessionToken = sessionToken;
        logger.info({ playerId, userId: existingUserId }, 'Player session restored');
      } else {
        // Invalid/expired session, create new
        playerId = 'player_' + (nextPlayerId++);
        color = COLORS[colorIndex % COLORS.length];
        icon = ICONS[colorIndex % ICONS.length];
        colorIndex++;
        name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
        playerSessionToken = await auth.createPlayerSession(playerId, name, color, icon);
      }
    } catch (err) {
      logger.error({ err }, 'Error validating player session');
      playerId = 'player_' + (nextPlayerId++);
      color = COLORS[colorIndex % COLORS.length];
      icon = ICONS[colorIndex % ICONS.length];
      colorIndex++;
      name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
      playerSessionToken = await auth.createPlayerSession(playerId, name, color, icon);
    }
  } else {
    // No session token, create new player and session
    playerId = 'player_' + (nextPlayerId++);
    color = COLORS[colorIndex % COLORS.length];
    icon = ICONS[colorIndex % ICONS.length];
    colorIndex++;
    name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
    playerSessionToken = await auth.createPlayerSession(playerId, name, color, icon);
  }
  
  // If user was authenticated in restored session, override name/icon with user's account info
  if (existingUserId) {
    try {
      const userStats = await db.getUserStats(existingUserId);
      if (userStats) {
        name = userStats.display_name;
        icon = userStats.icon;
      }
    } catch (err) {
      logger.error({ err, userId: existingUserId }, 'Error loading user stats for restored session');
    }
  }

  wsConnectionOpened();
  ws.on('close', () => wsConnectionClosed());

  setupWebSocketConnection(ws, playerId, color, icon, name, playerInfo, wss, playerSessionToken, existingUserId);
});

// ── Startup ──
async function start(): Promise<void> {
  try {
    await db.initialize();
    logger.info('Database initialized');
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message }, 'Database initialization failed');
    logger.warn('Starting without database — lobby persistence disabled');
  }

  // Periodic sweep: destroy any lobbies with 0 members every 30s
  setInterval(() => {
    lobby.sweepEmptyLobbies().then(() => broadcastLobbyList(wss)).catch(() => {});
  }, 30_000);

  // Expire shared replay links older than 30 days (check hourly)
  db.expireOldShares().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old shared replays'); }).catch(() => {});
  setInterval(() => {
    db.expireOldShares().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old shared replays'); }).catch(() => {});
  }, 3_600_000);

  startMetricsServer();

  httpServer.listen(SERVER_CONFIG.port, () => {
    logger.info({ port: SERVER_CONFIG.port }, `Release Quest running on http://localhost:${SERVER_CONFIG.port}`);
  });
}

start();
