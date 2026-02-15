import logger, { createLobbyLogger } from './logger.ts';
import type { MatchLog } from './types.ts';

export function createMatchLog(lobbyId: number): MatchLog {
  const startTime = Date.now();
  const matchLogger = createLobbyLogger(lobbyId.toString());

  return {
    log(event, data) {
      const logEntry = {
        t: Date.now(),
        elapsed: Date.now() - startTime,
        event,
        ...data
      };
      matchLogger.debug(logEntry, 'Match event');
    },
    close() {
      matchLogger.debug('Match ended');
    },
  };
}
