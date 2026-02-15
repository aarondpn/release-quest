import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Base logger configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }
    : {}),
});

/**
 * Create a child logger with contextual bindings
 * @param context - Additional context to include in all log messages
 * @example
 * const lobbyLogger = createLogger({ lobbyId: 'abc123' });
 * lobbyLogger.info('Game started'); // Will include lobbyId in output
 */
export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Create a player-scoped logger
 */
export function createPlayerLogger(
  playerId: string,
  additionalContext?: Record<string, unknown>
): pino.Logger {
  return logger.child({ playerId, ...additionalContext });
}

/**
 * Create a lobby-scoped logger
 */
export function createLobbyLogger(
  lobbyId: string,
  additionalContext?: Record<string, unknown>
): pino.Logger {
  return logger.child({ lobbyId, ...additionalContext });
}

/**
 * Create a game-scoped logger with lobby and phase context
 */
export function createGameLogger(
  lobbyId: string,
  phase: string,
  additionalContext?: Record<string, unknown>
): pino.Logger {
  return logger.child({ lobbyId, phase, ...additionalContext });
}

export default logger;
