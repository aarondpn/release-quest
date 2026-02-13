import { dom, clientState } from './state.js';

let _sendMessage = null;
export function initReplaysSend(fn) { _sendMessage = fn; }

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function requestRecordings() {
  if (_sendMessage) _sendMessage({ type: 'get-recordings' });
}

export function renderRecordingsList(recordings) {
  if (!dom.replaysList) return;

  if (!clientState.isLoggedIn) {
    dom.replaysList.innerHTML = '<div class="replays-empty">Log in to save and watch replays</div>';
    return;
  }

  if (!recordings || recordings.length === 0) {
    dom.replaysList.innerHTML = '<div class="replays-empty">No recordings yet. Play a game!</div>';
    return;
  }

  dom.replaysList.innerHTML = recordings.map(r => {
    const date = new Date(r.recorded_at);
    const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const durationSec = Math.round(r.duration_ms / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationStr = minutes + ':' + String(seconds).padStart(2, '0');
    const outcomeBadge = r.outcome === 'win'
      ? '<span class="replay-outcome replay-win">WIN</span>'
      : '<span class="replay-outcome replay-loss">LOSS</span>';
    const playerIcons = (r.players || []).map(p => escapeHtml(p.icon || '')).join('');

    return '<div class="replay-list-item">' +
      '<div class="replay-list-info">' +
        outcomeBadge +
        '<span class="replay-score">' + r.score + ' pts</span>' +
        '<span class="replay-difficulty">' + escapeHtml(r.difficulty) + '</span>' +
        '<span class="replay-players-icons">' + playerIcons + '</span>' +
        '<span class="replay-duration">' + durationStr + '</span>' +
        '<span class="replay-date">' + timeStr + '</span>' +
      '</div>' +
      '<button class="btn btn-small replay-watch-btn" data-recording-id="' + r.id + '">WATCH</button>' +
    '</div>';
  }).join('');

  dom.replaysList.querySelectorAll('.replay-watch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId, 10);
      if (_sendMessage) _sendMessage({ type: 'get-recording', id });
    });
  });
}

export function showReplaysTab() {
  if (dom.lobbyListPanel) dom.lobbyListPanel.classList.add('hidden');
  if (dom.leaderboardPanel) dom.leaderboardPanel.classList.add('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.remove('hidden');
  if (dom.lobbiesTab) dom.lobbiesTab.classList.remove('active');
  if (dom.leaderboardTab) dom.leaderboardTab.classList.remove('active');
  if (dom.replaysTab) dom.replaysTab.classList.add('active');
  requestRecordings();
}
