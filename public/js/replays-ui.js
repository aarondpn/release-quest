import { dom, clientState } from './state.js';
import { startPlayback } from './playback.js';
import { showError, ERROR_LEVELS } from './error-handler.js';

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

function fetchRecording(id) {
  const token = clientState.authToken || localStorage.getItem('rq_session_token');
  
  if (!token) {
    showError('Not logged in', ERROR_LEVELS.ERROR);
    return;
  }

  fetch('/api/recording/' + id, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
    .then(res => {
      if (!res.ok) {
        if (res.status === 401) throw new Error('Not authorized');
        if (res.status === 404) throw new Error('Recording not found');
        throw new Error('Failed to load recording');
      }
      return res.json();
    })
    .then(recording => {
      startPlayback(recording);
    })
    .catch(err => {
      showError(err.message || 'Failed to load replay', ERROR_LEVELS.ERROR);
    });
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
    const isShared = !!r.share_token;
    const sharedBadge = isShared ? '<span class="replay-shared-badge">SHARED</span>' : '';
    const shareBtn = isShared
      ? '<button class="btn btn-small replay-unshare-btn" data-recording-id="' + r.id + '">UNSHARE</button>'
      : '<button class="btn btn-small replay-share-btn" data-recording-id="' + r.id + '">SHARE</button>';

    return '<div class="replay-list-item">' +
      '<div class="replay-list-info">' +
        outcomeBadge +
        sharedBadge +
        '<span class="replay-score">' + r.score + ' pts</span>' +
        '<span class="replay-difficulty">' + escapeHtml(r.difficulty) + '</span>' +
        '<span class="replay-players-icons">' + playerIcons + '</span>' +
        '<span class="replay-duration">' + durationStr + '</span>' +
        '<span class="replay-date">' + timeStr + '</span>' +
      '</div>' +
      '<button class="btn btn-small replay-watch-btn" data-recording-id="' + r.id + '">WATCH</button>' +
      shareBtn +
    '</div>';
  }).join('');

  dom.replaysList.querySelectorAll('.replay-watch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId, 10);
      fetchRecording(id);
    });
  });

  dom.replaysList.querySelectorAll('.replay-share-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId, 10);
      if (_sendMessage) _sendMessage({ type: 'share-recording', id });
    });
  });

  dom.replaysList.querySelectorAll('.replay-unshare-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId, 10);
      if (_sendMessage) _sendMessage({ type: 'unshare-recording', id });
    });
  });
}

export function handleRecordingShared(msg) {
  const url = location.origin + '/?replay=' + msg.shareToken;
  navigator.clipboard.writeText(url).catch(() => {});

  if (!dom.replaysList) return;
  // Swap the SHARE button to UNSHARE and add the shared badge
  const btn = dom.replaysList.querySelector('.replay-share-btn[data-recording-id="' + msg.id + '"]');
  if (btn) {
    // Flash "COPIED!" then become UNSHARE
    btn.textContent = 'COPIED!';
    btn.classList.add('btn-copied');
    setTimeout(() => {
      btn.textContent = 'UNSHARE';
      btn.className = 'btn btn-small replay-unshare-btn';
      btn.classList.remove('btn-copied');
      // Rebind click to unshare
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        const id = parseInt(newBtn.dataset.recordingId, 10);
        if (_sendMessage) _sendMessage({ type: 'unshare-recording', id });
      });
    }, 2000);

    // Add shared badge to the info section
    const item = btn.closest('.replay-list-item');
    const info = item && item.querySelector('.replay-list-info');
    if (info && !info.querySelector('.replay-shared-badge')) {
      const outcome = info.querySelector('.replay-outcome');
      const badge = document.createElement('span');
      badge.className = 'replay-shared-badge';
      badge.textContent = 'SHARED';
      if (outcome && outcome.nextSibling) {
        info.insertBefore(badge, outcome.nextSibling);
      } else {
        info.prepend(badge);
      }
    }
  }
}

export function handleRecordingUnshared(msg) {
  requestRecordings();
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
