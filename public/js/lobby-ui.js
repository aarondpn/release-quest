import { dom, clientState } from './state.js';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// sendMessage is injected lazily to avoid circular dependency with network.js
let _sendMessage = null;
export function initLobbySend(fn) { _sendMessage = fn; }

export function showLobbyBrowser() {
  dom.lobbyBrowser.classList.remove('hidden');
  dom.lobbyError.classList.add('hidden');
  // Reset to lobbies tab
  if (dom.lobbyListPanel) dom.lobbyListPanel.classList.remove('hidden');
  if (dom.leaderboardPanel) dom.leaderboardPanel.classList.add('hidden');
  if (dom.lobbiesTab) dom.lobbiesTab.classList.add('active');
  if (dom.leaderboardTab) dom.leaderboardTab.classList.remove('active');
  if (_sendMessage) _sendMessage({ type: 'list-lobbies' });
}

export function hideLobbyBrowser() {
  dom.lobbyBrowser.classList.add('hidden');
}

export function renderLobbyList(lobbies) {
  clientState.lobbies = lobbies;
  if (!lobbies || lobbies.length === 0) {
    dom.lobbyList.innerHTML = '<div class="lobby-list-empty">No lobbies yet. Create one!</div>';
    return;
  }
  dom.lobbyList.innerHTML = lobbies.map(l => {
    const full = l.player_count >= l.max_players;
    const difficulty = (l.settings && l.settings.difficulty) || 'medium';
    const difficultyBadge = difficulty === 'easy' ? '🟢' : difficulty === 'hard' ? '🔴' : '🟡';
    return '<div class="lobby-list-item">' +
      '<div class="lobby-list-info">' +
        '<span class="lobby-list-name">' + escapeHtml(l.name) + '</span>' +
        '<span class="lobby-list-code">' + l.code + '</span>' +
        '<span class="lobby-list-difficulty" title="' + difficulty + '">' + difficultyBadge + '</span>' +
        '<span class="lobby-list-players">' + l.player_count + '/' + l.max_players + '</span>' +
      '</div>' +
      '<button class="btn btn-small lobby-join-btn" data-lobby-id="' + l.id + '"' +
        (full ? ' disabled' : '') + '>' +
        (full ? 'FULL' : 'JOIN') +
      '</button>' +
    '</div>';
  }).join('');

  // Attach join handlers
  dom.lobbyList.querySelectorAll('.lobby-join-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const lobbyId = parseInt(btn.dataset.lobbyId, 10);
      if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId });
    });
  });
}

export function showLobbyError(message) {
  dom.lobbyError.textContent = message;
  dom.lobbyError.classList.remove('hidden');
  setTimeout(() => dom.lobbyError.classList.add('hidden'), 4000);
}
