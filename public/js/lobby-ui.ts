import { dom, clientState, activateLobbyTab } from './state.ts';
import { STANDARD_ICONS, renderIcon, buildIconPickerContent } from './avatars.ts';
import { getOwnedShopItems, getShopItemPrice } from './cosmetic-shop-ui.ts';
import { escapeHtml } from './utils.ts';
import type { SendMessageFn, LobbyListEntry } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;
export function initLobbySend(fn: SendMessageFn): void { _sendMessage = fn; }

export function showLobbyBrowser(): void {
  dom.lobbyBrowser!.classList.remove('hidden');
  dom.lobbyError!.classList.add('hidden');
  if (dom.lobbyProfileEditor) dom.lobbyProfileEditor.classList.add('collapsed');
  activateLobbyTab(dom.lobbyListPanel, dom.lobbiesTab);
  updateLobbyProfileBar();
  if (_sendMessage) {
    _sendMessage({ type: 'list-lobbies' });
    _sendMessage({ type: 'get-quests' });
  }
}

export function hideLobbyBrowser(): void {
  dom.lobbyBrowser!.classList.add('hidden');
}

export function renderLobbyList(lobbies: LobbyListEntry[]): void {
  clientState.lobbies = lobbies;
  if (!lobbies || lobbies.length === 0) {
    dom.lobbyList!.innerHTML = '<div class="lobby-list-empty">No lobbies yet. Create one!</div>';
    return;
  }
  dom.lobbyList!.innerHTML = lobbies.map(l => {
    const full = l.player_count >= l.max_players;
    const difficulty = (l.settings && l.settings.difficulty as string) || 'medium';
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

  dom.lobbyList!.querySelectorAll<HTMLElement>('.lobby-join-area').forEach(area => {
    const btn = area.querySelector<HTMLButtonElement>('.lobby-join-btn');
    if (btn && !btn.disabled) {
      const lobbyId = parseInt(area.dataset.lobbyId!, 10);
      const hasPassword = area.dataset.hasPassword === '1';

      btn.addEventListener('click', () => {
        if (hasPassword) {
          showInlinePasswordPrompt(area, lobbyId);
        } else {
          if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId });
        }
      });
    }

    const spectateBtn = area.querySelector<HTMLElement>('.lobby-spectate-btn');
    if (spectateBtn) {
      const lobbyId = parseInt(spectateBtn.dataset.lobbyId!, 10);
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

function showInlinePasswordPrompt(area: HTMLElement, lobbyId: number): void {
  area.innerHTML =
    '<div class="lobby-password-prompt">' +
      '<input class="lobby-password-join-input" type="password" placeholder="Password" maxlength="32" autocomplete="off">' +
      '<button class="btn btn-small lobby-password-confirm-btn">GO</button>' +
      '<button class="btn btn-small btn-cancel lobby-password-cancel-btn">\u2715</button>' +
    '</div>';
  const input = area.querySelector<HTMLInputElement>('.lobby-password-join-input')!;
  const confirmBtn = area.querySelector<HTMLButtonElement>('.lobby-password-confirm-btn')!;
  const cancelBtn = area.querySelector<HTMLButtonElement>('.lobby-password-cancel-btn')!;
  input.focus();

  function submitPassword(): void {
    const password = input.value;
    if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId, password });
  }

  confirmBtn.addEventListener('click', submitPassword);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') submitPassword();
    if (e.key === 'Escape') cancelBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    renderLobbyList(clientState.lobbies);
  });
}

function showInlineSpectatePasswordPrompt(area: HTMLElement, lobbyId: number): void {
  area.innerHTML =
    '<div class="lobby-password-prompt">' +
      '<input class="lobby-password-join-input" type="password" placeholder="Password" maxlength="32" autocomplete="off">' +
      '<button class="btn btn-small lobby-password-confirm-btn">GO</button>' +
      '<button class="btn btn-small btn-cancel lobby-password-cancel-btn">\u2715</button>' +
    '</div>';
  const input = area.querySelector<HTMLInputElement>('.lobby-password-join-input')!;
  const confirmBtn = area.querySelector<HTMLButtonElement>('.lobby-password-confirm-btn')!;
  const cancelBtn = area.querySelector<HTMLButtonElement>('.lobby-password-cancel-btn')!;
  input.focus();

  function submitPassword(): void {
    const password = input.value;
    if (_sendMessage) _sendMessage({ type: 'join-spectate', lobbyId, password });
  }

  confirmBtn.addEventListener('click', submitPassword);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') submitPassword();
    if (e.key === 'Escape') cancelBtn.click();
  });
  cancelBtn.addEventListener('click', () => {
    renderLobbyList(clientState.lobbies);
  });
}

export function joinLobbyWithPassword(lobbyId: number, password: string): void {
  if (_sendMessage) _sendMessage({ type: 'join-lobby', lobbyId, password });
}

export function joinLobbyByCodeWithPassword(code: string, password: string): void {
  if (_sendMessage) _sendMessage({ type: 'join-lobby-by-code', code, password });
}

export function showLobbyError(message: string): void {
  dom.lobbyError!.textContent = message;
  dom.lobbyError!.classList.remove('hidden');
  setTimeout(() => dom.lobbyError!.classList.add('hidden'), 4000);
}

// ── Lobby Profile Bar ──

export function updateLobbyProfileBar(): void {
  if (!dom.lobbyProfileIcon) return;

  dom.lobbyProfileIcon.innerHTML = renderIcon(clientState.myIcon || STANDARD_ICONS[0], 24);
  dom.lobbyProfileName!.textContent = clientState.myName || 'Anon';

  if (clientState.isLoggedIn && clientState.authUser) {
    dom.lobbyProfileGuestView!.classList.add('hidden');
    dom.lobbyProfileLoggedInView!.classList.remove('hidden');
    dom.lobbyProfileAuthName!.textContent = clientState.authUser.username;
  } else {
    dom.lobbyProfileGuestView!.classList.remove('hidden');
    dom.lobbyProfileLoggedInView!.classList.add('hidden');
    dom.lobbyProfileAuthName!.textContent = '';
  }
}

let _lobbyEditorSelectedIcon: string | null = null;

export function buildLobbyIconPicker(): void {
  if (!dom.lobbyEditorIconPicker) return;
  dom.lobbyEditorIconPicker.innerHTML = '';
  _lobbyEditorSelectedIcon = clientState.selectedIcon;
  const isAuth = clientState.isLoggedIn;

  // Guests get a random server-assigned icon — no picker
  if (!isAuth) {
    _lobbyEditorSelectedIcon = clientState.selectedIcon || STANDARD_ICONS[0];
    dom.lobbyEditorIconPicker.classList.add('hidden');
    return;
  }

  dom.lobbyEditorIconPicker.classList.remove('hidden');

  const resolved = buildIconPickerContent(
    dom.lobbyEditorIconPicker,
    clientState.selectedIcon,
    getOwnedShopItems(),
    getShopItemPrice,
    id => { _lobbyEditorSelectedIcon = id; },
  );
  if (resolved !== _lobbyEditorSelectedIcon) _lobbyEditorSelectedIcon = resolved;
}

export function toggleLobbyEditor(): void {
  const editor = dom.lobbyProfileEditor;
  if (!editor) return;
  const isCollapsed = editor.classList.contains('collapsed');
  if (isCollapsed) {
    dom.lobbyEditorNameInput!.value = clientState.myName || '';
    buildLobbyIconPicker();
    editor.classList.remove('collapsed');
  } else {
    editor.classList.add('collapsed');
  }
}

export function saveLobbyProfile(): void {
  const name = dom.lobbyEditorNameInput!.value.trim().slice(0, 16) || clientState.myName || 'Anon';
  const icon = _lobbyEditorSelectedIcon || clientState.selectedIcon;

  clientState.myName = name;
  clientState.myIcon = icon;
  clientState.selectedIcon = icon;

  dom.nameInput!.value = name;

  if (typeof window._buildIconPicker === 'function') window._buildIconPicker();

  if (_sendMessage) _sendMessage({ type: 'set-name', name, icon });

  dom.lobbyProfileEditor!.classList.add('collapsed');
  updateLobbyProfileBar();
}
