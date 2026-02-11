import type { MatchLog } from './types.ts';

export function createMatchLog(lobbyId: number): MatchLog {
  const startTime = Date.now();
  const prefix = `[MATCH ${lobbyId}]`;

  return {
    log(event, data) {
      const logEntry = {
        t: Date.now(),
        elapsed: Date.now() - startTime,
        event,
        ...data
      };
      console.log(`${prefix} ${JSON.stringify(logEntry)}`);
    },
    close() {
      console.log(`${prefix} Match ended`);
    },
  };
}
