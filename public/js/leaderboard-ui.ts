import { dom } from './state.ts';
import { renderIcon } from './avatars.ts';
import type { SendMessageFn, LeaderboardEntry } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;
export function initLeaderboardSend(fn: SendMessageFn): void { _sendMessage = fn; }

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function requestLeaderboard(): void {
  if (_sendMessage) _sendMessage({ type: 'get-leaderboard' });
}

export function renderLeaderboard(entries: LeaderboardEntry[]): void {
  if (!entries || entries.length === 0) {
    dom.leaderboardList!.innerHTML = '<div class="leaderboard-empty">No stats yet. Play a game!</div>';
    return;
  }

  const rankIcons = ['gold', 'silver', 'bronze'];

  dom.leaderboardList!.innerHTML = entries.map((e, i) => {
    const rankClass = i < 3 ? ' leaderboard-rank-' + rankIcons[i] : '';
    const winRate = e.games_played > 0 ? Math.round((e.games_won / e.games_played) * 100) : 0;
    return '<div class="leaderboard-row' + rankClass + '">' +
      '<span class="leaderboard-rank">' + (i + 1) + '</span>' +
      '<span class="leaderboard-icon">' + renderIcon(e.icon, 16) + '</span>' +
      '<span class="leaderboard-name">' + escapeHtml(e.display_name) + '</span>' +
      '<span class="leaderboard-score">' + Number(e.total_score).toLocaleString() + '</span>' +
      '<span class="leaderboard-wins">' + e.games_won + 'W</span>' +
      '<span class="leaderboard-winrate">' + winRate + '%</span>' +
    '</div>';
  }).join('');
}

export function showLeaderboardTab(): void {
  dom.lobbyListPanel!.classList.add('hidden');
  dom.leaderboardPanel!.classList.remove('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  if (dom.statsCardPanel) dom.statsCardPanel.classList.add('hidden');
  dom.lobbiesTab!.classList.remove('active');
  dom.leaderboardTab!.classList.add('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  if (dom.statsCardTab) dom.statsCardTab.classList.remove('active');
  requestLeaderboard();
}

export function showLobbiesTab(): void {
  dom.leaderboardPanel!.classList.add('hidden');
  dom.lobbyListPanel!.classList.remove('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  if (dom.statsCardPanel) dom.statsCardPanel.classList.add('hidden');
  dom.leaderboardTab!.classList.remove('active');
  dom.lobbiesTab!.classList.add('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  if (dom.statsCardTab) dom.statsCardTab.classList.remove('active');
}
