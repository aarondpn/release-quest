import { PLAYER_ICONS, CURSOR_THROTTLE_MS } from './config.js';
import { clientState, dom, initDom } from './state.js';
import { pixelToLogical } from './coordinates.js';
import { updateHUD } from './hud.js';
import { connect, sendMessage } from './network.js';
import { showLobbyBrowser, initLobbySend } from './lobby-ui.js';
import { initAuthSend, showAuthOverlay, hideAuthOverlay, switchTab, submitLogin, submitRegister, submitLogout } from './auth-ui.js';
import { initLeaderboardSend, showLeaderboardTab, showLobbiesTab } from './leaderboard-ui.js';

initDom();

// Fetch difficulty presets from server
fetch('/api/difficulty-presets')
  .then(res => res.json())
  .then(presets => {
    clientState.difficultyPresets = presets;
    // Initialize with medium difficulty values
    updateDifficultyPlaceholders('medium');
  })
  .catch(err => console.error('Failed to load difficulty presets:', err));

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

// Initialize difficulty preset placeholders
function updateDifficultyPlaceholders(difficulty) {
  if (!clientState.difficultyPresets) return;
  const preset = clientState.difficultyPresets[difficulty];
  if (preset) {
    dom.configStartingHp.placeholder = preset.startingHp;
    dom.configHpDamage.placeholder = preset.hpDamage;
    dom.configBugPoints.placeholder = preset.bugPoints;
    dom.configBossHp.placeholder = preset.boss.hp;
    dom.configBossTime.placeholder = preset.boss.timeLimit;
    dom.configBossClickDamage.placeholder = preset.boss.clickDamage;
    dom.configBossKillBonus.placeholder = preset.boss.killBonus;
    dom.configBossRegen.placeholder = preset.boss.regenPerSecond;
    dom.configHeisenbug.placeholder = Math.round(preset.specialBugs.heisenbugChance * 100);
    dom.configCodeReview.placeholder = Math.round(preset.specialBugs.codeReviewChance * 100);
    dom.configMergeConflict.placeholder = Math.round(preset.specialBugs.mergeConflictChance * 100);
    dom.configPipelineBug.placeholder = Math.round(preset.specialBugs.pipelineBugChance * 100);
    dom.configMemoryLeak.placeholder = Math.round(preset.specialBugs.memoryLeakChance * 100);
    dom.configDuckDuration.placeholder = preset.powerups.rubberDuckBuffDuration;
    dom.configHammerDuration.placeholder = preset.powerups.hotfixHammerStunDuration;
  }
}
// Set initial values for medium difficulty will be called after fetch


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
  const name = dom.lobbyNameInput.value.trim().slice(0, 32);
  
  // Validate lobby name is not empty
  if (!name) {
    dom.lobbyError.textContent = 'Please enter a lobby name';
    dom.lobbyError.classList.remove('hidden');
    return;
  }
  
  const maxPlayers = parseInt(dom.lobbyMaxPlayers.dataset.value, 10) || 4;
  const difficulty = dom.lobbyDifficulty.dataset.value || 'medium';
  
  // Build custom config from advanced settings
  const customConfig = {};
  
  if (dom.configStartingHp.value) {
    customConfig.startingHp = parseInt(dom.configStartingHp.value, 10);
  }
  if (dom.configHpDamage.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    customConfig.bugs.hpDamage = parseInt(dom.configHpDamage.value, 10);
  }
  if (dom.configBugPoints.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    customConfig.bugs.points = parseInt(dom.configBugPoints.value, 10);
  }
  if (dom.configBossHp.value) {
    if (!customConfig.boss) customConfig.boss = {};
    customConfig.boss.hp = parseInt(dom.configBossHp.value, 10);
  }
  if (dom.configBossTime.value) {
    if (!customConfig.boss) customConfig.boss = {};
    customConfig.boss.timeLimit = parseInt(dom.configBossTime.value, 10);
  }
  if (dom.configBossClickDamage.value) {
    if (!customConfig.boss) customConfig.boss = {};
    customConfig.boss.clickDamage = parseInt(dom.configBossClickDamage.value, 10);
  }
  if (dom.configBossKillBonus.value) {
    if (!customConfig.boss) customConfig.boss = {};
    customConfig.boss.killBonus = parseInt(dom.configBossKillBonus.value, 10);
  }
  if (dom.configBossRegen.value) {
    if (!customConfig.boss) customConfig.boss = {};
    customConfig.boss.regenPerSecond = parseFloat(dom.configBossRegen.value);
  }
  if (dom.configHeisenbug.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    if (!customConfig.bugs.specialBugs) customConfig.bugs.specialBugs = {};
    customConfig.bugs.specialBugs.heisenbugChance = parseInt(dom.configHeisenbug.value, 10) / 100;
  }
  if (dom.configCodeReview.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    if (!customConfig.bugs.specialBugs) customConfig.bugs.specialBugs = {};
    customConfig.bugs.specialBugs.codeReviewChance = parseInt(dom.configCodeReview.value, 10) / 100;
  }
  if (dom.configMergeConflict.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    if (!customConfig.bugs.specialBugs) customConfig.bugs.specialBugs = {};
    customConfig.bugs.specialBugs.mergeConflictChance = parseInt(dom.configMergeConflict.value, 10) / 100;
  }
  if (dom.configPipelineBug.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    if (!customConfig.bugs.specialBugs) customConfig.bugs.specialBugs = {};
    customConfig.bugs.specialBugs.pipelineBugChance = parseInt(dom.configPipelineBug.value, 10) / 100;
  }
  if (dom.configMemoryLeak.value) {
    if (!customConfig.bugs) customConfig.bugs = {};
    if (!customConfig.bugs.specialBugs) customConfig.bugs.specialBugs = {};
    customConfig.bugs.specialBugs.memoryLeakChance = parseInt(dom.configMemoryLeak.value, 10) / 100;
  }
  if (dom.configDuckDuration.value) {
    if (!customConfig.powerups) customConfig.powerups = {};
    customConfig.powerups.rubberDuckBuffDuration = parseInt(dom.configDuckDuration.value, 10);
  }
  if (dom.configHammerDuration.value) {
    if (!customConfig.powerups) customConfig.powerups = {};
    customConfig.powerups.hotfixHammerStunDuration = parseInt(dom.configHammerDuration.value, 10);
  }
  
  const message = { type: 'create-lobby', name, maxPlayers, difficulty };
  if (Object.keys(customConfig).length > 0) {
    message.customConfig = customConfig;
  }
  
  sendMessage(message);
  dom.lobbyNameInput.value = '';
  dom.lobbyError.classList.add('hidden');
});

dom.lobbyNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.createLobbyBtn.click();
});

// Clear lobby error when user starts typing
dom.lobbyNameInput.addEventListener('input', () => {
  dom.lobbyError.classList.add('hidden');
});

// ── Custom select dropdown ──
dom.lobbyMaxPlayers.querySelector('.custom-select-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  dom.lobbyMaxPlayers.classList.toggle('open');
});
dom.lobbyMaxPlayers.querySelector('.custom-select-options').addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-select-option');
  if (!opt) return;
  dom.lobbyMaxPlayers.dataset.value = opt.dataset.value;
  dom.lobbyMaxPlayers.querySelector('.custom-select-trigger').textContent = opt.textContent + ' \u25BE';
  dom.lobbyMaxPlayers.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  dom.lobbyMaxPlayers.classList.remove('open');
});
document.addEventListener('click', () => dom.lobbyMaxPlayers.classList.remove('open'));

// ── Difficulty select dropdown ──
dom.lobbyDifficulty.querySelector('.custom-select-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  dom.lobbyDifficulty.classList.toggle('open');
});
dom.lobbyDifficulty.querySelector('.custom-select-options').addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-select-option');
  if (!opt) return;
  const difficulty = opt.dataset.value;
  dom.lobbyDifficulty.dataset.value = difficulty;
  dom.lobbyDifficulty.querySelector('.custom-select-trigger').textContent = opt.textContent + ' \u25BE';
  dom.lobbyDifficulty.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  dom.lobbyDifficulty.classList.remove('open');
  
  // Update placeholder values in advanced config
  updateDifficultyPlaceholders(difficulty);
});
document.addEventListener('click', () => dom.lobbyDifficulty.classList.remove('open'));

// ── Advanced config toggle ──
dom.advancedToggleBtn.addEventListener('click', () => {
  dom.lobbyAdvancedConfig.classList.toggle('collapsed');
});

// ── Advanced config reset ──
dom.advancedResetBtn.addEventListener('click', () => {
  dom.configStartingHp.value = '';
  dom.configHpDamage.value = '';
  dom.configBugPoints.value = '';
  dom.configBossHp.value = '';
  dom.configBossTime.value = '';
  dom.configBossClickDamage.value = '';
  dom.configBossKillBonus.value = '';
  dom.configBossRegen.value = '';
  dom.configHeisenbug.value = '';
  dom.configCodeReview.value = '';
  dom.configMergeConflict.value = '';
  dom.configPipelineBug.value = '';
  dom.configMemoryLeak.value = '';
  dom.configDuckDuration.value = '';
  dom.configHammerDuration.value = '';
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
