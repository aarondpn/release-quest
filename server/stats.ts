import logger from './logger.ts';
import * as db from './db.ts';
import * as network from './network.ts';
import * as quests from './quests.ts';
import type { GameState, PlayerInfo } from './types.ts';

export async function recordGameEnd(state: GameState, playerInfo: Map<string, PlayerInfo>, won: boolean): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const pid of Object.keys(state.players)) {
    const info = playerInfo.get(pid);
    if (!info || !info.userId) continue;

    const player = state.players[pid];
    const score = player.score || 0;
    const bugsSquashed = player.bugsSquashed || 0;

    promises.push(
      db.recordGameStats(info.userId, score, won, bugsSquashed)
    );

    // Process quest progress asynchronously
    quests.processQuestProgress(info.userId, { score, won, bugsSquashed }).then(updates => {
      if (updates.length === 0) return;
      const ws = network.getWsForPlayer(pid);
      if (ws) {
        network.send(ws, { type: 'quest-progress', updates });
      }
    }).catch(err => {
      logger.error({ err, userId: info.userId }, 'Failed to process quest progress');
    });
  }

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'rejected') {
      logger.error({ err: r.reason }, 'Failed to record game stats');
    }
  }
}
