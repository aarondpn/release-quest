import { dom } from './state.js';

let _sendMessage = null;
export function initLeaderboardSend(fn) { _sendMessage = fn; }

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function requestLeaderboard() {
  if (_sendMessage) _sendMessage({ type: 'get-leaderboard' });
}

export function renderLeaderboard(entries) {
  if (!entries || entries.length === 0) {
    dom.leaderboardList.innerHTML = '<div class="leaderboard-empty">No stats yet. Play a game!</div>';
    return;
  }

  const rankIcons = ['gold', 'silver', 'bronze'];

  dom.leaderboardList.innerHTML = entries.map((e, i) => {
    const rankClass = i < 3 ? ' leaderboard-rank-' + rankIcons[i] : '';
    const winRate = e.games_played > 0 ? Math.round((e.games_won / e.games_played) * 100) : 0;
    return '<div class="leaderboard-row' + rankClass + '">' +
      '<span class="leaderboard-rank">' + (i + 1) + '</span>' +
      '<span class="leaderboard-icon">' + escapeHtml(e.icon) + '</span>' +
      '<span class="leaderboard-name">' + escapeHtml(e.display_name) + '</span>' +
      '<span class="leaderboard-score">' + Number(e.total_score).toLocaleString() + '</span>' +
      '<span class="leaderboard-wins">' + e.games_won + 'W</span>' +
      '<span class="leaderboard-winrate">' + winRate + '%</span>' +
    '</div>';
  }).join('');
}

export function showLeaderboardTab() {
  dom.lobbyListPanel.classList.add('hidden');
  dom.leaderboardPanel.classList.remove('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  dom.lobbiesTab.classList.remove('active');
  dom.leaderboardTab.classList.add('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  requestLeaderboard();
}

export function showLobbiesTab() {
  dom.leaderboardPanel.classList.add('hidden');
  dom.lobbyListPanel.classList.remove('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  dom.leaderboardTab.classList.remove('active');
  dom.lobbiesTab.classList.add('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
}
