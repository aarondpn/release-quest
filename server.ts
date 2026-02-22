import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

import logger from './server/logger.ts';
import { SERVER_CONFIG, DEV_MODE, COLORS, GUEST_NAMES } from './server/config.ts';
import { STANDARD_ICONS as ICONS } from './shared/constants.ts';
import * as network from './server/network.ts';
import * as db from './server/db.ts';
import * as lobby from './server/lobby.ts';
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
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:;");
  next();
});
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
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 16 * 1024,
  verifyClient: (info, cb) => {
    if (DEV_MODE) return cb(true);
    const origin = info.origin || info.req.headers.origin || '';
    const host = info.req.headers.host || '';
    if (!origin) return cb(true);
    try {
      if (new URL(origin).host === host) {
        cb(true);
      } else {
        cb(false, 403, 'Forbidden');
      }
    } catch {
      cb(false, 403, 'Forbidden');
    }
  },
});
network.init(wss);

// Track connections per IP
const connectionsPerIp = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 10;

// WebSocket connection handler
wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress || '';
  const currentCount = connectionsPerIp.get(ip) || 0;
  if (currentCount >= MAX_CONNECTIONS_PER_IP) {
    ws.close(1008, 'Too many connections');
    return;
  }
  connectionsPerIp.set(ip, currentCount + 1);

  const playerId = 'player_' + (nextPlayerId++);
  const color = COLORS[colorIndex % COLORS.length];
  const icon = ICONS[colorIndex % ICONS.length];
  colorIndex++;
  const name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];

  wsConnectionOpened();
  ws.on('close', () => {
    const count = connectionsPerIp.get(ip) || 1;
    if (count <= 1) {
      connectionsPerIp.delete(ip);
    } else {
      connectionsPerIp.set(ip, count - 1);
    }
    wsConnectionClosed();
  });

  setupWebSocketConnection(ws, playerId, color, icon, name, playerInfo, wss);
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

  // Expire shared replay links, guest sessions, and expired quests (check hourly)
  db.expireOldShares().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old shared replays'); }).catch(() => {});
  db.expireGuestSessions().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old guest sessions'); }).catch(() => {});
  db.cleanupExpiredQuests().then(n => { if (n > 0) logger.info({ count: n }, 'Cleaned up expired quests'); }).catch(() => {});
  setInterval(() => {
    db.expireOldShares().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old shared replays'); }).catch(() => {});
    db.expireGuestSessions().then(n => { if (n > 0) logger.info({ count: n }, 'Expired old guest sessions'); }).catch(() => {});
    db.cleanupExpiredQuests().then(n => { if (n > 0) logger.info({ count: n }, 'Cleaned up expired quests'); }).catch(() => {});
  }, 3_600_000);

  startMetricsServer();

  httpServer.listen(SERVER_CONFIG.port, () => {
    logger.info({ port: SERVER_CONFIG.port }, `Release Quest running on http://localhost:${SERVER_CONFIG.port}`);
  });
}

start();
