import { PLAYER_ICONS, CURSOR_THROTTLE_MS } from './config.js';
import { clientState, dom, initDom } from './state.js';
import { pixelToLogical } from './coordinates.js';
import { updateHUD, showStartScreen, showGameOverScreen, showWinScreen, hideAllScreens } from './hud.js';
import { connect, sendMessage } from './network.js';

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
  const name = dom.nameInput.value.trim().slice(0, 16) || clientState.myName || 'Anon';
  clientState.myName = name;
  clientState.myIcon = clientState.selectedIcon;
  sendMessage({ type: 'set-name', name, icon: clientState.selectedIcon });
  clientState.hasJoined = true;
  dom.nameEntry.classList.add('hidden');

  const phase = clientState.currentPhase;
  if (phase === 'lobby' || !phase) showStartScreen();
  else if (phase === 'gameover') showGameOverScreen(0, 1, Object.values(clientState.players));
  else if (phase === 'win') showWinScreen(0, Object.values(clientState.players));
  else if (phase === 'boss') hideAllScreens();
  else hideAllScreens();
}

dom.joinBtn.addEventListener('click', submitJoin);
dom.nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitJoin();
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

// Start
connect();
updateHUD(0, 1, 100);
