import { PLAYER_ICONS, CURSOR_THROTTLE_MS } from './config.js';
import { clientState, dom, initDom } from './state.js';
import { pixelToLogical } from './coordinates.js';
import { updateHUD } from './hud.js';
import { connect, sendMessage } from './network.js';
import { showLobbyBrowser, initLobbySend } from './lobby-ui.js';
import { initAuthSend, showAuthOverlay, hideAuthOverlay, switchTab, submitLogin, submitRegister, submitLogout } from './auth-ui.js';
import { initLeaderboardSend, showLeaderboardTab, showLobbiesTab } from './leaderboard-ui.js';

initDom();

// Icon picker setup
PLAYER_ICONS.forEach((icon, i) => {
  const el = document.createElement('div');
  el.className = 'icon-option' + (i === 0 ? ' selected' : '');
  el.textContent = icon;
  el.addEventListener('click', () => {
    dom.iconPicker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    clientState.selectedIcon = icon;
  });
  dom.iconPicker.appendChild(el);
});
clientState.selectedIcon = PLAYER_ICONS[0];

function submitJoin() {
  if (!clientState.ws || clientState.ws.readyState !== 1) return;
  let name, icon;
  if (clientState.isLoggedIn && clientState.authUser) {
    name = dom.nameInput.value.trim().slice(0, 16) || clientState.authUser.displayName;
    icon = clientState.selectedIcon || clientState.authUser.icon;
  } else {
    name = dom.nameInput.value.trim().slice(0, 16) || clientState.myName || 'Anon';
    icon = clientState.selectedIcon;
  }
  clientState.myName = name;
  clientState.myIcon = icon;
  sendMessage({ type: 'set-name', name, icon });
  clientState.hasJoined = true;
  dom.nameEntry.classList.add('hidden');

  // Show lobby browser instead of going directly to game
  showLobbyBrowser();
}

dom.joinBtn.addEventListener('click', submitJoin);
dom.nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitJoin();
});

// ── Lobby create handler ──
dom.createLobbyBtn.addEventListener('click', () => {
  const name = dom.lobbyNameInput.value.trim().slice(0, 32) || 'Game Lobby';
  const maxPlayers = parseInt(dom.lobbyMaxPlayers.value, 10) || 4;
  sendMessage({ type: 'create-lobby', name, maxPlayers });
  dom.lobbyNameInput.value = '';
});

dom.lobbyNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.createLobbyBtn.click();
});

// Cursor broadcasting
dom.arena.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - clientState.lastCursorSend < CURSOR_THROTTLE_MS) return;
  clientState.lastCursorSend = now;

  const rect = dom.arena.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const logical = pixelToLogical(px, py);

  sendMessage({
    type: 'cursor-move',
    x: Math.round(logical.x * 10) / 10,
    y: Math.round(logical.y * 10) / 10,
  });
});

// Button handlers
document.getElementById('start-btn').addEventListener('click', () => {
  sendMessage({ type: 'start-game' });
});

document.getElementById('retry-btn').addEventListener('click', () => {
  sendMessage({ type: 'start-game' });
});

document.getElementById('continue-btn').addEventListener('click', () => {
  sendMessage({ type: 'start-game' });
});

// ── Leave lobby handlers ──
function leaveLobby() {
  sendMessage({ type: 'leave-lobby' });
}

document.getElementById('leave-btn-start').addEventListener('click', leaveLobby);
document.getElementById('leave-btn-gameover').addEventListener('click', leaveLobby);
document.getElementById('leave-btn-win').addEventListener('click', leaveLobby);
document.getElementById('hud-leave-btn').addEventListener('click', leaveLobby);

// Initialize lobby send function (avoids circular dependency)
initLobbySend(sendMessage);

// Initialize auth send function
initAuthSend(sendMessage);

// Initialize leaderboard send function
initLeaderboardSend(sendMessage);

// ── Auth handlers ──
dom.authShowLoginBtn.addEventListener('click', showAuthOverlay);

dom.authLogoutBtn.addEventListener('click', submitLogout);

dom.authBackBtn.addEventListener('click', hideAuthOverlay);

dom.authTabs.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

dom.authLoginSubmit.addEventListener('click', submitLogin);
dom.authLoginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitLogin();
});

dom.authRegSubmit.addEventListener('click', submitRegister);
dom.authRegConfirm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitRegister();
});

// ── Leaderboard tab handlers ──
dom.lobbiesTab.addEventListener('click', showLobbiesTab);
dom.leaderboardTab.addEventListener('click', showLeaderboardTab);

// Start
connect();
updateHUD(0, 1, 100);
