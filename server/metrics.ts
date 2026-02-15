import http from 'node:http';
import { collectDefaultMetrics, register, Counter, Histogram, Gauge } from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import logger from './logger.ts';
import { getRecordingsCount, getReplayEventsCount, getReplayMouseEventsCount } from './db.ts';

// ── Default metrics (CPU, memory, event loop lag, GC) ──
collectDefaultMetrics();

// ── HTTP metrics ──
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// ── WebSocket metrics ──
export const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Number of active WebSocket connections',
});

export const wsConnectionsTotal = new Counter({
  name: 'ws_connections_total',
  help: 'Total number of WebSocket connections opened',
});

export const wsMessagesReceived = new Counter({
  name: 'ws_messages_received_total',
  help: 'Total number of WebSocket messages received',
  labelNames: ['type'] as const,
});

export const wsMessagesSent = new Counter({
  name: 'ws_messages_sent_total',
  help: 'Total number of WebSocket messages sent',
});

// ── Game metrics ──
export const gameLobbiesActive = new Gauge({
  name: 'game_lobbies_active',
  help: 'Number of active game lobbies',
});

export const gamePlayersOnline = new Gauge({
  name: 'game_players_online',
  help: 'Number of players currently online',
});

export const gameGamesStarted = new Counter({
  name: 'game_games_started_total',
  help: 'Total number of games started',
  labelNames: ['difficulty'] as const,
});

export const gameGamesCompleted = new Counter({
  name: 'game_games_completed_total',
  help: 'Total number of games completed',
  labelNames: ['outcome', 'difficulty'] as const,
});

export const gameBugsSquashed = new Counter({
  name: 'game_bugs_squashed_total',
  help: 'Total number of bugs squashed',
});

// ── Replay metrics (loaded from DB on each scrape) ──
export const replayRecordingsTotal = new Gauge({
  name: 'replay_recordings_total',
  help: 'Total number of recordings saved',
  async collect() {
    try {
      const count = await getRecordingsCount();
      this.set(count);
    } catch (err) {
      logger.error({ err }, 'Failed to collect replay recordings metric');
    }
  },
});

export const replayEventsTotal = new Gauge({
  name: 'replay_events_total',
  help: 'Total number of replay events saved',
  async collect() {
    try {
      const count = await getReplayEventsCount();
      this.set(count);
    } catch (err) {
      logger.error({ err }, 'Failed to collect replay events metric');
    }
  },
});

export const replayMouseEventsTotal = new Gauge({
  name: 'replay_mouse_events_total',
  help: 'Total number of replay mouse movement events saved',
  async collect() {
    try {
      const count = await getReplayMouseEventsCount();
      this.set(count);
    } catch (err) {
      logger.error({ err }, 'Failed to collect replay mouse events metric');
    }
  },
});

// ── Express middleware ──
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationS = durationNs / 1e9;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationS);
  });

  next();
}

// ── Metrics HTTP server on a dedicated port ──
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9091', 10);

export function startMetricsServer(): void {
  const server = http.createServer(async (_req, res) => {
    try {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.statusCode = 500;
      res.end('Error collecting metrics');
    }
  });

  server.listen(METRICS_PORT, () => {
    logger.info({ port: METRICS_PORT }, `Metrics server listening on http://localhost:${METRICS_PORT}/metrics`);
  });
}

// ── WebSocket helpers ──
export function wsConnectionOpened(): void {
  wsConnectionsActive.inc();
  wsConnectionsTotal.inc();
}

export function wsConnectionClosed(): void {
  wsConnectionsActive.dec();
}
