import { CURSOR_THROTTLE_MS } from './config.js';
import { STANDARD_ICONS, PREMIUM_AVATARS, PREMIUM_IDS, isPremium, renderIcon } from './avatars.js';
import { clientState, dom, initDom } from './state.js';
import { pixelToLogical } from './coordinates.js';
import { updateHUD } from './hud.js';
import { connect, sendMessage } from './network.js';
import { showLobbyBrowser, initLobbySend, updateLobbyProfileBar, toggleLobbyEditor, saveLobbyProfile } from './lobby-ui.js';
import { initAuthSend, showAuthOverlay, hideAuthOverlay, switchTab, submitLogin, submitRegister, submitLogout } from './auth-ui.js';
import { initLeaderboardSend, showLeaderboardTab, showLobbiesTab } from './leaderboard-ui.js';
import { initReplaysSend, showReplaysTab } from './replays-ui.js';
import { initStatsCardSend, showStatsCardTab, hideStatsCardTab, initThemePicker, downloadStatsCardPng } from './stats-card-ui.js';
import { stopPlayback, togglePause, cycleSpeed } from './playback.js';
import { showError, ERROR_LEVELS } from './error-handler.js';

initDom();

// Hide name entry if user has a saved session (before WebSocket connects)
if (localStorage.getItem('rq_player_session_token') || localStorage.getItem('rq_session_token')) {
  dom.nameEntry.classList.add('hidden');
}

// ── Global error handlers ──
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showError('An unexpected error occurred', ERROR_LEVELS.ERROR);
  // Prevent default to avoid duplicate console errors
  return true;
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showError('An unexpected error occurred', ERROR_LEVELS.ERROR);
  // Prevent default
  event.preventDefault();
});

// Fetch difficulty presets from server
fetch('/api/difficulty-presets')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(presets => {
    clientState.difficultyPresets = presets;
    // Initialize with medium difficulty values
    updateDifficultyPlaceholders('medium');
  })
  .catch(err => {
    console.error('Failed to load difficulty presets:', err);
    showError('Failed to load difficulty presets. Using defaults.', ERROR_LEVELS.WARNING);
    // Fallback to hardcoded defaults
    clientState.difficultyPresets = {
      easy: { startingHp: 150, hpDamage: 5, bugPoints: 15, boss: { hp: 800, timeLimit: 180, clickDamage: 10, killBonus: 500, regenPerSecond: 2 }, specialBugs: { heisenbugChance: 0.03, codeReviewChance: 0.03, mergeConflictChance: 0.02, pipelineBugChance: 0.02, memoryLeakChance: 0.01, infiniteLoopChance: 0.06 }, powerups: { rubberDuckBuffDuration: 15, hotfixHammerStunDuration: 8 } },
      medium: { startingHp: 100, hpDamage: 10, bugPoints: 10, boss: { hp: 1200, timeLimit: 150, clickDamage: 8, killBonus: 1000, regenPerSecond: 3 }, specialBugs: { heisenbugChance: 0.05, codeReviewChance: 0.05, mergeConflictChance: 0.03, pipelineBugChance: 0.03, memoryLeakChance: 0.02, infiniteLoopChance: 0.10 }, powerups: { rubberDuckBuffDuration: 12, hotfixHammerStunDuration: 6 } },
      hard: { startingHp: 75, hpDamage: 15, bugPoints: 8, boss: { hp: 1800, timeLimit: 120, clickDamage: 6, killBonus: 2000, regenPerSecond: 5 }, specialBugs: { heisenbugChance: 0.08, codeReviewChance: 0.08, mergeConflictChance: 0.05, pipelineBugChance: 0.05, memoryLeakChance: 0.03, infiniteLoopChance: 0.12 }, powerups: { rubberDuckBuffDuration: 10, hotfixHammerStunDuration: 5 } }
    };
    updateDifficultyPlaceholders('medium');
  });

// Icon picker setup
export function buildIconPicker() {
  dom.iconPicker.innerHTML = '';
  const current = clientState.selectedIcon;
  const isAuth = clientState.isLoggedIn;

  // Standard section
  const stdLabel = document.createElement('div');
  stdLabel.className = 'icon-picker-label';
  stdLabel.textContent = 'PICK YOUR HUNTER';
  dom.iconPicker.appendChild(stdLabel);

  STANDARD_ICONS.forEach(icon => {
    const el = document.createElement('div');
    el.className = 'icon-option' + (current === icon ? ' selected' : '');
    el.dataset.icon = icon;
    el.textContent = icon;
    el.addEventListener('click', () => {
      dom.iconPicker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      clientState.selectedIcon = icon;
    });
    dom.iconPicker.appendChild(el);
  });

  // Premium section
  const premLabel = document.createElement('div');
  premLabel.className = 'icon-picker-label icon-picker-premium-label';
  premLabel.textContent = 'MEMBERS ONLY';
  dom.iconPicker.appendChild(premLabel);

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
      dom.iconPicker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      clientState.selectedIcon = id;
    });
    dom.iconPicker.appendChild(el);
  });

  // If selected icon isn't valid for current auth state, reset
  if (isPremium(current) && !isAuth) {
    clientState.selectedIcon = STANDARD_ICONS[0];
    const first = dom.iconPicker.querySelector('.icon-option[data-icon="' + STANDARD_ICONS[0] + '"]');
    if (first) first.classList.add('selected');
  }
}
buildIconPicker();
if (!clientState.selectedIcon) clientState.selectedIcon = STANDARD_ICONS[0];
// Expose for cross-module calls (network.js auth state changes)
window._buildIconPicker = buildIconPicker;

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
    dom.configInfiniteLoop.placeholder = Math.round(preset.specialBugs.infiniteLoopChance * 100);
    dom.configDuckDuration.placeholder = preset.powerups.rubberDuckBuffDuration;
    dom.configHammerDuration.placeholder = preset.powerups.hotfixHammerStunDuration;
  }
}
// Set initial values for medium difficulty will be called after fetch


function submitJoin() {
  try {
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

    // If we have a pending invite code, join directly via code
    if (clientState.pendingJoinCode) {
      sendMessage({ type: 'join-lobby-by-code', code: clientState.pendingJoinCode });
      clientState.pendingJoinCode = null;
      return;
    }

    // Show lobby browser instead of going directly to game
    showLobbyBrowser();
  } catch (err) {
    console.error('Error in submitJoin:', err);
    showError('Failed to join. Please try again.', ERROR_LEVELS.ERROR);
  }
}

// Expose for cross-module calls (network.js auto-join on session resume)
window._submitJoin = submitJoin;

dom.joinBtn.addEventListener('click', submitJoin);
dom.nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitJoin();
});

// ── Lobby create handler ──
dom.createLobbyBtn.addEventListener('click', () => {
  try {
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
      customConfig.hpDamage = parseInt(dom.configHpDamage.value, 10);
    }
    if (dom.configBugPoints.value) {
      customConfig.bugPoints = parseInt(dom.configBugPoints.value, 10);
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
    // Special bug toggles + percentage inputs
    const bugToggleMap = [
      { toggle: dom.toggleHeisenbug, input: dom.configHeisenbug, key: 'heisenbugChance' },
      { toggle: dom.toggleCodeReview, input: dom.configCodeReview, key: 'codeReviewChance' },
      { toggle: dom.toggleMergeConflict, input: dom.configMergeConflict, key: 'mergeConflictChance' },
      { toggle: dom.togglePipelineBug, input: dom.configPipelineBug, key: 'pipelineBugChance' },
      { toggle: dom.toggleMemoryLeak, input: dom.configMemoryLeak, key: 'memoryLeakChance' },
      { toggle: dom.toggleInfiniteLoop, input: dom.configInfiniteLoop, key: 'infiniteLoopChance' },
    ];
    for (const { toggle, input, key } of bugToggleMap) {
      if (!toggle.checked) {
        if (!customConfig.specialBugs) customConfig.specialBugs = {};
        customConfig.specialBugs[key] = 0;
      } else if (input.value) {
        if (!customConfig.specialBugs) customConfig.specialBugs = {};
        customConfig.specialBugs[key] = parseInt(input.value, 10) / 100;
      }
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
  } catch (err) {
    console.error('Error creating lobby:', err);
    showError('Failed to create lobby. Please try again.', ERROR_LEVELS.ERROR);
  }
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

// ── Section toggle handlers ──
document.querySelectorAll('.config-section-header').forEach(header => {
  header.addEventListener('click', () => {
    const sectionId = 'section-' + header.dataset.section;
    const content = document.getElementById(sectionId);
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
      content.classList.remove('collapsed');
      header.classList.add('expanded');
    } else {
      content.classList.add('collapsed');
      header.classList.remove('expanded');
    }
  });
});

// ── Bug toggle listeners ──
[
  [dom.toggleHeisenbug, dom.configHeisenbug],
  [dom.toggleCodeReview, dom.configCodeReview],
  [dom.toggleMergeConflict, dom.configMergeConflict],
  [dom.togglePipelineBug, dom.configPipelineBug],
  [dom.toggleMemoryLeak, dom.configMemoryLeak],
  [dom.toggleInfiniteLoop, dom.configInfiniteLoop],
].forEach(([toggle, input]) => {
  toggle.addEventListener('change', () => {
    input.disabled = !toggle.checked;
  });
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
  dom.configInfiniteLoop.value = '';
  dom.configDuckDuration.value = '';
  dom.configHammerDuration.value = '';
  // Reset all bug toggles to enabled
  [dom.toggleHeisenbug, dom.toggleCodeReview, dom.toggleMergeConflict,
   dom.togglePipelineBug, dom.toggleMemoryLeak, dom.toggleInfiniteLoop].forEach(t => {
    t.checked = true;
    t.dispatchEvent(new Event('change'));
  });
});

// Cursor broadcasting
dom.arena.addEventListener('mousemove', (e) => {
  try {
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
  } catch (err) {
    console.error('Error handling cursor move:', err);
  }
});

// Button handlers
function handleGameAction() {
  try {
    if (clientState.isPlayback) { stopPlayback(); return; }
    sendMessage({ type: 'start-game' });
  } catch (err) {
    console.error('Error with game action:', err);
    showError('Failed to perform action', ERROR_LEVELS.ERROR);
  }
}

document.getElementById('start-btn').addEventListener('click', handleGameAction);
document.getElementById('retry-btn').addEventListener('click', handleGameAction);
document.getElementById('continue-btn').addEventListener('click', handleGameAction);

// ── Leave lobby handlers ──
function leaveLobby() {
  try {
    if (clientState.isPlayback) {
      stopPlayback();
      return;
    }
    sendMessage({ type: 'leave-lobby' });
  } catch (err) {
    console.error('Error leaving lobby:', err);
    showError('Failed to leave lobby', ERROR_LEVELS.ERROR);
  }
}

document.getElementById('leave-btn-start').addEventListener('click', leaveLobby);
document.getElementById('leave-btn-gameover').addEventListener('click', leaveLobby);
document.getElementById('leave-btn-win').addEventListener('click', leaveLobby);
document.getElementById('hud-leave-btn').addEventListener('click', leaveLobby);

// ── Invite button handler ──
document.getElementById('invite-btn').addEventListener('click', () => {
  try {
    if (!clientState.currentLobbyCode) return;
    const url = location.origin + '/?join=' + clientState.currentLobbyCode;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('invite-btn');
      btn.textContent = 'COPIED!';
      btn.classList.add('btn-copied');
      setTimeout(() => {
        btn.textContent = 'INVITE';
        btn.classList.remove('btn-copied');
      }, 2000);
    }).catch(() => {
      showError('Failed to copy invite link', ERROR_LEVELS.WARNING);
    });
  } catch (err) {
    console.error('Error copying invite link:', err);
  }
});

// Initialize lobby send function (avoids circular dependency)
initLobbySend(sendMessage);

// Initialize auth send function
initAuthSend(sendMessage);

// Initialize leaderboard send function
initLeaderboardSend(sendMessage);

// Initialize replays send function
initReplaysSend(sendMessage);

// Initialize stats card send function
initStatsCardSend(sendMessage);
initThemePicker();


// ── Auth handlers ──
dom.authShowLoginBtn.addEventListener('click', showAuthOverlay);

dom.authLogoutBtn.addEventListener('click', submitLogout);

// ── Lobby profile bar handlers ──
dom.lobbyProfileEditBtn.addEventListener('click', toggleLobbyEditor);
dom.lobbyEditorSaveBtn.addEventListener('click', saveLobbyProfile);
dom.lobbyProfileLoginBtn.addEventListener('click', showAuthOverlay);
dom.lobbyProfileLogoutBtn.addEventListener('click', submitLogout);

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

// ── Replays tab handler ──
if (dom.replaysTab) dom.replaysTab.addEventListener('click', () => { hideStatsCardTab(); showReplaysTab(); });

// ── Stats card tab handler ──
if (dom.statsCardTab) dom.statsCardTab.addEventListener('click', showStatsCardTab);
if (dom.statsCardDownloadBtn) dom.statsCardDownloadBtn.addEventListener('click', downloadStatsCardPng);

// ── Playback controls ──
if (dom.playbackControls) {
  dom.playbackControls.querySelector('.playback-pause-btn')?.addEventListener('click', togglePause);
  dom.playbackControls.querySelector('.playback-speed-btn')?.addEventListener('click', cycleSpeed);
}

// Start
connect();
updateHUD(0, 1, 100);
