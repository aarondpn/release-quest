const db = require('./db');

async function recordGameEnd(state, playerInfo, won) {
  const promises = [];

  for (const pid of Object.keys(state.players)) {
    const info = playerInfo.get(pid);
    if (!info || !info.userId) continue;

    const player = state.players[pid];
    const score = player.score || 0;
    const bugsSquashed = player.bugsSquashed || 0;

    promises.push(
      db.recordGameStats(info.userId, score, won, bugsSquashed)
    );
  }

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[stats] Failed to record stats:', r.reason);
    }
  }
}

module.exports = { recordGameEnd };
