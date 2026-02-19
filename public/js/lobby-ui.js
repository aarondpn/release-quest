import { dom, clientState } from './state.js';
import { STANDARD_ICONS, PREMIUM_AVATARS, PREMIUM_IDS, isPremium, renderIcon } from './avatars.js';

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
  // Collapse editor on re-show
  if (dom.lobbyProfileEditor) dom.lobbyProfileEditor.classList.add('collapsed');
  // Reset to lobbies tab
  if (dom.lobbyListPanel) dom.lobbyListPanel.classList.remove('hidden');
  if (dom.leaderboardPanel) dom.leaderboardPanel.classList.add('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  if (dom.lobbiesTab) dom.lobbiesTab.classList.add('active');
  if (dom.leaderboardTab) dom.leaderboardTab.classList.remove('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  updateLobbyProfileBar();
  if (_sendMessage) {
    _sendMessage({ type: 'list-lobbies' });
    _sendMessage({ type: 'get-quests' });
  }
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
    const statusClass = l.started ? 'lobby-list-status-playing' : 'lobby-list-status-waiting';
    const statusLabel = l.started ? 'In Game' : 'Waiting';
    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const lockIcon = l.hasPassword ? '<span class="lobby-list-lock" title="Password protected">\u{1F512}</span>' : '';
    const spectatorCount = l.spectatorCount || 0;
    return '<div class="lobby-list-item">' +
      '<div class="lobby-list-info">' +
        '<span class="lobby-list-name">' + lockIcon + escapeHtml(l.name) + '</span>' +
        '<span class="lobby-list-details">' +
          '<span class="lobby-list-detail"><span class="lobby-list-status ' + statusClass + '"></span>' + statusLabel + '</span>' +
          '<span class="lobby-list-sep"></span>' +
          '<span class="lobby-list-detail">' + difficultyLabel + '</span>' +
          '<span class="lobby-list-sep"></span>' +
          '<span class="lobby-list-detail">' + l.player_count + '/' + l.max_players + '</span>' +
          (spectatorCount > 0 ? '<span class="lobby-list-sep"></span><span class="lobby-list-detail lobby-list-spectators" title="Spectators watching">\uD83D\uDC41 ' + spectatorCount + '</span>' : '') +
          (l.hasCustomSettings ? '<span class="lobby-list-sep"></span><span class="lobby-list-custom" title="Custom settings — unranked">CUSTOM</span>' : '') +
        '</span>' +
        '<span class="lobby-list-code">#' + l.code + '</span>' +
      '</div>' +
      '<div class="lobby-join-area" data-lobby-id="' + l.id + '" data-has-password="' + (l.hasPassword ? '1' : '') + '">' +
        '<button class="btn btn-small lobby-join-btn"' +
          (full ? ' disabled' : '') + '>' +
          (full ? 'FULL' : 'JOIN') +
        '</button>' +
        '<button class="btn btn-small btn-spectate lobby-spectate-btn" data-lobby-id="' + l.id + '" data-has-password="' + (l.hasPassword ? '1' : '') + '">WATCH</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // Attach join handlers
  dom.lobbyList.querySelectorAll('.lobby-join-area').forEach(area => {
    const btn = area.querySelector('.lobby-join-btn');
    if (btn && !btn.disabled) {
      const lobbyId = parseInt(area.dataset.lobbyId, 10);
      const hasPassword = area.dataset.hasPassword === '1';

      btn.addEventListener('click', () => {
        if (hasPassword) {
          showInlinePasswordPrompt(area, lobbyId);
        } else {
          if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId });
        }
      });
    }

    const spectateBtn = area.querySelector('.lobby-spectate-btn');
    if (spectateBtn) {
      const lobbyId = parseInt(spectateBtn.dataset.lobbyId, 10);
      const hasPassword = spectateBtn.dataset.hasPassword === '1';

      spectateBtn.addEventListener('click', () => {
        if (hasPassword) {
          showInlineSpectatePasswordPrompt(area, lobbyId);
        } else {
          if (_sendMessage) _sendMessage({ type: 'join-spectate', lobbyId });
        }
      });
    }
  });
}

function showInlinePasswordPrompt(area, lobbyId) {
  // Replace join button with password input + confirm
  area.innerHTML =
    '<div class="lobby-password-prompt">' +
      '<input class="lobby-password-join-input" type="password" placeholder="Password" maxlength="32" autocomplete="off">' +
      '<button class="btn btn-small lobby-password-confirm-btn">GO</button>' +
      '<button class="btn btn-small btn-cancel lobby-password-cancel-btn">\u2715</button>' +
    '</div>';
  const input = area.querySelector('.lobby-password-join-input');
  const confirmBtn = area.querySelector('.lobby-password-confirm-btn');
  const cancelBtn = area.querySelector('.lobby-password-cancel-btn');
  input.focus();

  function submitPassword() {
    const password = input.value;
    if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId, password });
  }

  confirmBtn.addEventListener('click', submitPassword);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPassword();
    if (e.key === 'Escape') cancelBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    // Re-render the lobby list to restore the join button
    renderLobbyList(clientState.lobbies);
  });
}

function showInlineSpectatePasswordPrompt(area, lobbyId) {
  const joinArea = area;
  joinArea.innerHTML =
    '<div class="lobby-password-prompt">' +
      '<input class="lobby-password-join-input" type="password" placeholder="Password" maxlength="32" autocomplete="off">' +
      '<button class="btn btn-small lobby-password-confirm-btn">GO</button>' +
      '<button class="btn btn-small btn-cancel lobby-password-cancel-btn">\u2715</button>' +
    '</div>';
  const input = joinArea.querySelector('.lobby-password-join-input');
  const confirmBtn = joinArea.querySelector('.lobby-password-confirm-btn');
  const cancelBtn = joinArea.querySelector('.lobby-password-cancel-btn');
  input.focus();

  function submitPassword() {
    const password = input.value;
    if (_sendMessage) _sendMessage({ type: 'join-spectate', lobbyId, password });
  }

  confirmBtn.addEventListener('click', submitPassword);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPassword();
    if (e.key === 'Escape') cancelBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    renderLobbyList(clientState.lobbies);
  });
}

export function joinLobbyWithPassword(lobbyId, password) {
  if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId, password });
}

export function joinLobbyByCodeWithPassword(code, password) {
  if (_sendMessage) _sendMessage({ type: 'join-lobby-by-code', code, password });
}

export function showLobbyError(message) {
  dom.lobbyError.textContent = message;
  dom.lobbyError.classList.remove('hidden');
  setTimeout(() => dom.lobbyError.classList.add('hidden'), 4000);
}

// ── Lobby Profile Bar ──

export function updateLobbyProfileBar() {
  if (!dom.lobbyProfileIcon) return;

  // Update icon + name
  dom.lobbyProfileIcon.innerHTML = renderIcon(clientState.myIcon || STANDARD_ICONS[0], 24);
  dom.lobbyProfileName.textContent = clientState.myName || 'Anon';

  // Update auth state
  if (clientState.isLoggedIn && clientState.authUser) {
    dom.lobbyProfileGuestView.classList.add('hidden');
    dom.lobbyProfileLoggedInView.classList.remove('hidden');
    dom.lobbyProfileAuthName.textContent = clientState.authUser.username;
  } else {
    dom.lobbyProfileGuestView.classList.remove('hidden');
    dom.lobbyProfileLoggedInView.classList.add('hidden');
    dom.lobbyProfileAuthName.textContent = '';
  }
}

let _lobbyEditorSelectedIcon = null;

export function buildLobbyIconPicker() {
  if (!dom.lobbyEditorIconPicker) return;
  dom.lobbyEditorIconPicker.innerHTML = '';
  const current = clientState.selectedIcon;
  _lobbyEditorSelectedIcon = current;
  const isAuth = clientState.isLoggedIn;

  // Standard section
  const stdLabel = document.createElement('div');
  stdLabel.className = 'icon-picker-label';
  stdLabel.textContent = 'PICK YOUR HUNTER';
  dom.lobbyEditorIconPicker.appendChild(stdLabel);

  STANDARD_ICONS.forEach(icon => {
    const el = document.createElement('div');
    el.className = 'icon-option' + (current === icon ? ' selected' : '');
    el.dataset.icon = icon;
    el.textContent = icon;
    el.addEventListener('click', () => {
      dom.lobbyEditorIconPicker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      _lobbyEditorSelectedIcon = icon;
    });
    dom.lobbyEditorIconPicker.appendChild(el);
  });

  // Premium section
  const premLabel = document.createElement('div');
  premLabel.className = 'icon-picker-label icon-picker-premium-label';
  premLabel.textContent = 'MEMBERS ONLY';
  dom.lobbyEditorIconPicker.appendChild(premLabel);

  PREMIUM_IDS.forEach(id => {
    const av = PREMIUM_AVATARS[id];
    const el = document.createElement('div');
    const locked = !isAuth;
    el.className = 'icon-option icon-option-premium' + (current === id ? ' selected' : '') + (locked ? ' locked' : '');
    el.dataset.icon = id;
    el.innerHTML = '<img src="' + av.svg + '" width="28" height="28" alt="' + av.name + '" style="image-rendering:pixelated">';
    if (locked) {
      const lock = document.createElement('div');
      lock.className = 'icon-lock-overlay';
      lock.textContent = '\u{1F512}';
      el.appendChild(lock);
    }
    el.addEventListener('click', () => {
      if (locked) {
        el.classList.add('locked-shake');
        el.addEventListener('animationend', () => el.classList.remove('locked-shake'), { once: true });
        return;
      }
      dom.lobbyEditorIconPicker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      _lobbyEditorSelectedIcon = id;
    });
    dom.lobbyEditorIconPicker.appendChild(el);
  });

  // If selected icon isn't valid for current auth state, reset
  if (isPremium(current) && !isAuth) {
    _lobbyEditorSelectedIcon = STANDARD_ICONS[0];
    const first = dom.lobbyEditorIconPicker.querySelector('.icon-option[data-icon="' + STANDARD_ICONS[0] + '"]');
    if (first) first.classList.add('selected');
  }
}

export function toggleLobbyEditor() {
  const editor = dom.lobbyProfileEditor;
  if (!editor) return;
  const isCollapsed = editor.classList.contains('collapsed');
  if (isCollapsed) {
    // Populate editor with current values
    dom.lobbyEditorNameInput.value = clientState.myName || '';
    buildLobbyIconPicker();
    editor.classList.remove('collapsed');
  } else {
    editor.classList.add('collapsed');
  }
}

export function saveLobbyProfile() {
  const name = dom.lobbyEditorNameInput.value.trim().slice(0, 16) || clientState.myName || 'Anon';
  const icon = _lobbyEditorSelectedIcon || clientState.selectedIcon;

  clientState.myName = name;
  clientState.myIcon = icon;
  clientState.selectedIcon = icon;

  // Also update the name-entry input to stay in sync
  dom.nameInput.value = name;

  // Update name-entry icon picker selection too
  if (typeof window._buildIconPicker === 'function') window._buildIconPicker();

  if (_sendMessage) _sendMessage({ type: 'set-name', name, icon });

  dom.lobbyProfileEditor.classList.add('collapsed');
  updateLobbyProfileBar();
}
