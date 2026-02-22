import { CURSOR_THROTTLE_MS } from './config.ts';
import { STANDARD_ICONS } from '../../shared/constants.ts';
import { buildIconPickerContent } from './avatars.ts';
import { getOwnedShopItems, getShopItemPrice, isShopCatalogLoaded } from './cosmetic-shop-ui.ts';
import { clientState, dom, initDom } from './state.ts';
import { pixelToLogical } from './coordinates.ts';
import { updateHUD, initHudSend } from './hud.ts';
import { connect, sendMessage } from './network.ts';
import { showLobbyBrowser, initLobbySend, updateLobbyProfileBar, toggleLobbyEditor, saveLobbyProfile } from './lobby-ui.ts';
import { initAuthSend, showAuthOverlay, hideAuthOverlay, switchTab, submitLogin, submitRegister, submitLogout } from './auth-ui.ts';
import { initLeaderboardSend, showLeaderboardTab, showLobbiesTab } from './leaderboard-ui.ts';
import { initReplaysSend, showReplaysTab } from './replays-ui.ts';
import { initStatsCardSend, showStatsCardTab, initThemePicker, downloadStatsCardPng } from './stats-card-ui.ts';
import { stopPlayback, togglePause, cycleSpeed } from './playback.ts';
import { showError, ERROR_LEVELS } from './error-handler.ts';
import { initChatSend, initChat } from './chat.ts';
import { initQuestsSend, requestQuests, showQuestsTab } from './quests-ui.ts';
import { initShopSend, showShopTab, hideShopPanel } from './cosmetic-shop-ui.ts';
import type { DifficultyPreset } from './client-types.ts';

initDom();

// ── Global error handlers ──
window.addEventListener('error', (event: ErrorEvent) => {
  console.error('Global error:', event.error);
  showError('An unexpected error occurred', ERROR_LEVELS.ERROR);
  return true;
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Unhandled promise rejection:', event.reason);
  showError('An unexpected error occurred', ERROR_LEVELS.ERROR);
  event.preventDefault();
});

// Fetch difficulty presets from server
fetch('/api/difficulty-presets')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((presets: Record<string, DifficultyPreset>) => {
    clientState.difficultyPresets = presets;
    updateDifficultyPlaceholders('medium');
  })
  .catch(err => {
    console.error('Failed to load difficulty presets:', err);
    showError('Failed to load difficulty presets. Using defaults.', ERROR_LEVELS.WARNING);
    clientState.difficultyPresets = {
      easy: { startingHp: 150, hpDamage: 5, bugPoints: 15, boss: { hp: 800, timeLimit: 180, clickDamage: 10, killBonus: 500, regenPerSecond: 2 }, specialBugs: { heisenbugChance: 0.03, codeReviewChance: 0.03, mergeConflictChance: 0.02, pipelineBugChance: 0.02, memoryLeakChance: 0.01, infiniteLoopChance: 0.06 }, powerups: { rubberDuckBuffDuration: 15, hotfixHammerStunDuration: 8 } },
      medium: { startingHp: 100, hpDamage: 10, bugPoints: 10, boss: { hp: 1200, timeLimit: 150, clickDamage: 8, killBonus: 1000, regenPerSecond: 3 }, specialBugs: { heisenbugChance: 0.05, codeReviewChance: 0.05, mergeConflictChance: 0.03, pipelineBugChance: 0.03, memoryLeakChance: 0.02, infiniteLoopChance: 0.10 }, powerups: { rubberDuckBuffDuration: 12, hotfixHammerStunDuration: 6 } },
      hard: { startingHp: 75, hpDamage: 15, bugPoints: 8, boss: { hp: 1800, timeLimit: 120, clickDamage: 6, killBonus: 2000, regenPerSecond: 5 }, specialBugs: { heisenbugChance: 0.08, codeReviewChance: 0.08, mergeConflictChance: 0.05, pipelineBugChance: 0.05, memoryLeakChance: 0.03, infiniteLoopChance: 0.12 }, powerups: { rubberDuckBuffDuration: 10, hotfixHammerStunDuration: 5 } }
    };
    updateDifficultyPlaceholders('medium');
  });

// Icon picker setup
export function buildIconPicker(): void {
  dom.iconPicker!.innerHTML = '';
  const isAuth = clientState.isLoggedIn;

  const nameEntrySub = document.getElementById('name-entry-sub');

  // Guests get a random server-assigned icon — no picker
  if (!isAuth) {
    if (!clientState.selectedIcon) clientState.selectedIcon = STANDARD_ICONS[0];
    dom.iconPicker!.classList.add('hidden');
    if (nameEntrySub) nameEntrySub.textContent = 'Choose your name';
    return;
  }

  dom.iconPicker!.classList.remove('hidden');
  if (nameEntrySub) nameEntrySub.textContent = 'Choose your name & icon';

  const resolved = buildIconPickerContent(
    dom.iconPicker!,
    clientState.selectedIcon,
    getOwnedShopItems(),
    getShopItemPrice,
    id => { clientState.selectedIcon = id; },
    isShopCatalogLoaded(),
  );
  if (resolved !== clientState.selectedIcon) clientState.selectedIcon = resolved;
}
buildIconPicker();
if (!clientState.selectedIcon) clientState.selectedIcon = STANDARD_ICONS[0];
window._buildIconPicker = buildIconPicker;

function updateDifficultyPlaceholders(difficulty: string): void {
  if (!clientState.difficultyPresets) return;
  const preset = clientState.difficultyPresets[difficulty];
  if (preset) {
    dom.configStartingHp!.placeholder = String(preset.startingHp);
    dom.configHpDamage!.placeholder = String(preset.hpDamage);
    dom.configBugPoints!.placeholder = String(preset.bugPoints);
    dom.configBossHp!.placeholder = String(preset.boss.hp);
    dom.configBossTime!.placeholder = String(preset.boss.timeLimit);
    dom.configBossClickDamage!.placeholder = String(preset.boss.clickDamage);
    dom.configBossKillBonus!.placeholder = String(preset.boss.killBonus);
    dom.configBossRegen!.placeholder = String(preset.boss.regenPerSecond);
    dom.configHeisenbug!.placeholder = String(Math.round(preset.specialBugs.heisenbugChance * 100));
    dom.configCodeReview!.placeholder = String(Math.round(preset.specialBugs.codeReviewChance * 100));
    dom.configMergeConflict!.placeholder = String(Math.round(preset.specialBugs.mergeConflictChance * 100));
    dom.configPipelineBug!.placeholder = String(Math.round(preset.specialBugs.pipelineBugChance * 100));
    dom.configMemoryLeak!.placeholder = String(Math.round(preset.specialBugs.memoryLeakChance * 100));
    dom.configInfiniteLoop!.placeholder = String(Math.round(preset.specialBugs.infiniteLoopChance * 100));
    dom.configAzubi!.placeholder = String(Math.round((preset.specialBugs.azubiChance || 0) * 100));
    dom.configDuckDuration!.placeholder = String(preset.powerups.rubberDuckBuffDuration);
    dom.configHammerDuration!.placeholder = String(preset.powerups.hotfixHammerStunDuration);
  }
}

interface CustomConfig {
  startingHp?: number;
  hpDamage?: number;
  bugPoints?: number;
  boss?: {
    hp?: number;
    timeLimit?: number;
    clickDamage?: number;
    killBonus?: number;
    regenPerSecond?: number;
  };
  specialBugs?: Record<string, number>;
  powerups?: {
    rubberDuckBuffDuration?: number;
    hotfixHammerStunDuration?: number;
  };
}

function submitJoin(): void {
  try {
    if (!clientState.ws || clientState.ws.readyState !== 1) return;
    let name: string, icon: string | null;
    if (clientState.isLoggedIn && clientState.authUser) {
      name = dom.nameInput!.value.trim().slice(0, 16) || clientState.authUser.displayName;
      icon = clientState.selectedIcon || clientState.authUser.icon;
    } else {
      name = dom.nameInput!.value.trim().slice(0, 16) || clientState.myName || 'Anon';
      icon = clientState.selectedIcon;
    }
    clientState.myName = name;
    clientState.myIcon = icon;
    sendMessage({ type: 'set-name', name, icon });
    clientState.hasJoined = true;
    if (!clientState.isLoggedIn) localStorage.setItem('rq_guest_joined', '1');
    dom.nameEntry!.classList.add('hidden');

    if (clientState.pendingJoinCode) {
      sendMessage({ type: 'join-lobby-by-code', code: clientState.pendingJoinCode });
      clientState.pendingJoinCode = null;
      return;
    }

    showLobbyBrowser();
  } catch (err) {
    console.error('Error in submitJoin:', err);
    showError('Failed to join. Please try again.', ERROR_LEVELS.ERROR);
  }
}

window._submitJoin = submitJoin;

dom.joinBtn!.addEventListener('click', submitJoin);
dom.nameInput!.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') submitJoin();
});

// ── Lobby create handler ──
dom.createLobbyBtn!.addEventListener('click', () => {
  try {
    const name = dom.lobbyNameInput!.value.trim().slice(0, 32);

    if (!name) {
      dom.lobbyError!.textContent = 'Please enter a lobby name';
      dom.lobbyError!.classList.remove('hidden');
      return;
    }

    const maxPlayers = parseInt(dom.lobbyMaxPlayers!.dataset.value!, 10) || 4;
    const difficulty = dom.lobbyDifficulty!.dataset.value || 'medium';

    const customConfig: CustomConfig = {};

    if (dom.configStartingHp!.value) customConfig.startingHp = parseInt(dom.configStartingHp!.value, 10);
    if (dom.configHpDamage!.value) customConfig.hpDamage = parseInt(dom.configHpDamage!.value, 10);
    if (dom.configBugPoints!.value) customConfig.bugPoints = parseInt(dom.configBugPoints!.value, 10);
    if (dom.configBossHp!.value) { if (!customConfig.boss) customConfig.boss = {}; customConfig.boss.hp = parseInt(dom.configBossHp!.value, 10); }
    if (dom.configBossTime!.value) { if (!customConfig.boss) customConfig.boss = {}; customConfig.boss.timeLimit = parseInt(dom.configBossTime!.value, 10); }
    if (dom.configBossClickDamage!.value) { if (!customConfig.boss) customConfig.boss = {}; customConfig.boss.clickDamage = parseInt(dom.configBossClickDamage!.value, 10); }
    if (dom.configBossKillBonus!.value) { if (!customConfig.boss) customConfig.boss = {}; customConfig.boss.killBonus = parseInt(dom.configBossKillBonus!.value, 10); }
    if (dom.configBossRegen!.value) { if (!customConfig.boss) customConfig.boss = {}; customConfig.boss.regenPerSecond = parseFloat(dom.configBossRegen!.value); }

    const bugToggleMap: { toggle: HTMLInputElement; input: HTMLInputElement; key: string }[] = [
      { toggle: dom.toggleHeisenbug!, input: dom.configHeisenbug!, key: 'heisenbugChance' },
      { toggle: dom.toggleCodeReview!, input: dom.configCodeReview!, key: 'codeReviewChance' },
      { toggle: dom.toggleMergeConflict!, input: dom.configMergeConflict!, key: 'mergeConflictChance' },
      { toggle: dom.togglePipelineBug!, input: dom.configPipelineBug!, key: 'pipelineBugChance' },
      { toggle: dom.toggleMemoryLeak!, input: dom.configMemoryLeak!, key: 'memoryLeakChance' },
      { toggle: dom.toggleInfiniteLoop!, input: dom.configInfiniteLoop!, key: 'infiniteLoopChance' },
      { toggle: dom.toggleAzubi!, input: dom.configAzubi!, key: 'azubiChance' },
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
    if (dom.configDuckDuration!.value) { if (!customConfig.powerups) customConfig.powerups = {}; customConfig.powerups.rubberDuckBuffDuration = parseInt(dom.configDuckDuration!.value, 10); }
    if (dom.configHammerDuration!.value) { if (!customConfig.powerups) customConfig.powerups = {}; customConfig.powerups.hotfixHammerStunDuration = parseInt(dom.configHammerDuration!.value, 10); }

    const password = dom.lobbyPasswordInput!.value.trim();
    const message: Record<string, unknown> = { type: 'create-lobby', name, maxPlayers, difficulty };
    if (Object.keys(customConfig).length > 0) message.customConfig = customConfig;
    if (password) message.password = password;

    clientState.pendingLobbyPassword = password || null;

    sendMessage(message);
    dom.lobbyNameInput!.value = '';
    dom.lobbyPasswordInput!.value = '';
    dom.lobbyError!.classList.add('hidden');
  } catch (err) {
    console.error('Error creating lobby:', err);
    showError('Failed to create lobby. Please try again.', ERROR_LEVELS.ERROR);
  }
});

dom.lobbyNameInput!.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') (dom.createLobbyBtn as HTMLButtonElement).click();
});

dom.lobbyNameInput!.addEventListener('input', () => {
  dom.lobbyError!.classList.add('hidden');
});

// ── Custom select dropdown ──
dom.lobbyMaxPlayers!.querySelector('.custom-select-trigger')!.addEventListener('click', (e: Event) => {
  e.stopPropagation();
  dom.lobbyMaxPlayers!.classList.toggle('open');
});
dom.lobbyMaxPlayers!.querySelector('.custom-select-options')!.addEventListener('click', (e: Event) => {
  const opt = (e.target as HTMLElement).closest<HTMLElement>('.custom-select-option');
  if (!opt) return;
  dom.lobbyMaxPlayers!.dataset.value = opt.dataset.value;
  dom.lobbyMaxPlayers!.querySelector('.custom-select-trigger')!.textContent = opt.textContent + ' \u25BE';
  dom.lobbyMaxPlayers!.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  dom.lobbyMaxPlayers!.classList.remove('open');
});
document.addEventListener('click', () => dom.lobbyMaxPlayers!.classList.remove('open'));

// ── Difficulty select dropdown ──
dom.lobbyDifficulty!.querySelector('.custom-select-trigger')!.addEventListener('click', (e: Event) => {
  e.stopPropagation();
  dom.lobbyDifficulty!.classList.toggle('open');
});
dom.lobbyDifficulty!.querySelector('.custom-select-options')!.addEventListener('click', (e: Event) => {
  const opt = (e.target as HTMLElement).closest<HTMLElement>('.custom-select-option');
  if (!opt) return;
  const difficulty = opt.dataset.value!;
  dom.lobbyDifficulty!.dataset.value = difficulty;
  dom.lobbyDifficulty!.querySelector('.custom-select-trigger')!.textContent = opt.textContent + ' \u25BE';
  dom.lobbyDifficulty!.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  dom.lobbyDifficulty!.classList.remove('open');
  updateDifficultyPlaceholders(difficulty);
});
document.addEventListener('click', () => dom.lobbyDifficulty!.classList.remove('open'));

// ── Advanced config toggle ──
dom.advancedToggleBtn!.addEventListener('click', () => {
  dom.lobbyAdvancedConfig!.classList.toggle('collapsed');
});

// ── Section toggle handlers ──
document.querySelectorAll<HTMLElement>('.config-section-header').forEach(header => {
  header.addEventListener('click', () => {
    const sectionId = 'section-' + header.dataset.section;
    const content = document.getElementById(sectionId)!;
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
const bugTogglePairs: [HTMLInputElement | null, HTMLInputElement | null][] = [
  [dom.toggleHeisenbug, dom.configHeisenbug],
  [dom.toggleCodeReview, dom.configCodeReview],
  [dom.toggleMergeConflict, dom.configMergeConflict],
  [dom.togglePipelineBug, dom.configPipelineBug],
  [dom.toggleMemoryLeak, dom.configMemoryLeak],
  [dom.toggleInfiniteLoop, dom.configInfiniteLoop],
  [dom.toggleAzubi, dom.configAzubi],
];
bugTogglePairs.forEach(([toggle, input]) => {
  if (toggle && input) {
    toggle.addEventListener('change', () => {
      input.disabled = !toggle.checked;
    });
  }
});

// ── Advanced config unranked warning ──
const advancedConfigInputs = [
  dom.configStartingHp, dom.configHpDamage, dom.configBugPoints,
  dom.configBossHp, dom.configBossTime, dom.configBossClickDamage,
  dom.configBossKillBonus, dom.configBossRegen,
  dom.configHeisenbug, dom.configCodeReview, dom.configMergeConflict,
  dom.configPipelineBug, dom.configMemoryLeak, dom.configInfiniteLoop,
  dom.configAzubi, dom.configDuckDuration, dom.configHammerDuration,
];
const advancedBugToggles = [
  dom.toggleHeisenbug, dom.toggleCodeReview, dom.toggleMergeConflict,
  dom.togglePipelineBug, dom.toggleMemoryLeak, dom.toggleInfiniteLoop,
  dom.toggleAzubi,
];

function updateAdvancedWarning(): void {
  const warning = document.getElementById('advanced-config-warning');
  if (!warning) return;
  const hasCustomValue = advancedConfigInputs.some(input => input && input.value !== '') ||
    advancedBugToggles.some(toggle => toggle && !toggle.checked);
  warning.classList.toggle('hidden', !hasCustomValue);
}

advancedConfigInputs.forEach(input => {
  if (input) input.addEventListener('input', updateAdvancedWarning);
});
advancedBugToggles.forEach(toggle => {
  if (toggle) toggle.addEventListener('change', updateAdvancedWarning);
});

// ── Advanced config reset ──
dom.advancedResetBtn!.addEventListener('click', () => {
  dom.configStartingHp!.value = '';
  dom.configHpDamage!.value = '';
  dom.configBugPoints!.value = '';
  dom.configBossHp!.value = '';
  dom.configBossTime!.value = '';
  dom.configBossClickDamage!.value = '';
  dom.configBossKillBonus!.value = '';
  dom.configBossRegen!.value = '';
  dom.configHeisenbug!.value = '';
  dom.configCodeReview!.value = '';
  dom.configMergeConflict!.value = '';
  dom.configPipelineBug!.value = '';
  dom.configMemoryLeak!.value = '';
  dom.configInfiniteLoop!.value = '';
  dom.configAzubi!.value = '';
  dom.configDuckDuration!.value = '';
  dom.configHammerDuration!.value = '';
  [dom.toggleHeisenbug, dom.toggleCodeReview, dom.toggleMergeConflict,
   dom.togglePipelineBug, dom.toggleMemoryLeak, dom.toggleInfiniteLoop, dom.toggleAzubi].forEach(t => {
    if (t) { t.checked = true; t.dispatchEvent(new Event('change')); }
  });
  updateAdvancedWarning();
});

// Cursor broadcasting
dom.arena!.addEventListener('mousemove', (e: MouseEvent) => {
  try {
    if (clientState.isSpectating) return;
    const now = Date.now();
    if (now - clientState.lastCursorSend < CURSOR_THROTTLE_MS) return;
    clientState.lastCursorSend = now;

    const rect = dom.arena!.getBoundingClientRect();
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
function handleGameAction(): void {
  try {
    if (clientState.isPlayback) { stopPlayback(); return; }
    sendMessage({ type: 'start-game' });
  } catch (err) {
    console.error('Error with game action:', err);
    showError('Failed to perform action', ERROR_LEVELS.ERROR);
  }
}

document.getElementById('start-btn')!.addEventListener('click', handleGameAction);
document.getElementById('retry-btn')!.addEventListener('click', handleGameAction);
document.getElementById('continue-btn')!.addEventListener('click', handleGameAction);

// ── Leave lobby handlers ──
function leaveLobby(): void {
  try {
    if (clientState.isPlayback) { stopPlayback(); return; }
    if (clientState.isSpectating) { sendMessage({ type: 'leave-spectate' }); return; }
    sendMessage({ type: 'leave-lobby' });
  } catch (err) {
    console.error('Error leaving lobby:', err);
    showError('Failed to leave lobby', ERROR_LEVELS.ERROR);
  }
}

document.getElementById('leave-btn-start')!.addEventListener('click', leaveLobby);
document.getElementById('leave-btn-gameover')!.addEventListener('click', leaveLobby);
document.getElementById('leave-btn-win')!.addEventListener('click', leaveLobby);
document.getElementById('hud-leave-btn')!.addEventListener('click', leaveLobby);

// ── Spectate leave handler ──
const spectateLeaveBtn = document.getElementById('spectate-leave-btn');
if (spectateLeaveBtn) {
  spectateLeaveBtn.addEventListener('click', () => {
    try {
      sendMessage({ type: 'leave-spectate' });
    } catch (err) {
      console.error('Error leaving spectate:', err);
    }
  });
}

// ── Invite button handler ──
document.getElementById('invite-btn')!.addEventListener('click', () => {
  try {
    if (!clientState.currentLobbyCode) return;
    const url = location.origin + '/?join=' + clientState.currentLobbyCode;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('invite-btn')!;
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

// Initialize send functions (avoids circular dependency)
initLobbySend(sendMessage);
initHudSend(sendMessage);
initAuthSend(sendMessage);
initLeaderboardSend(sendMessage);
initReplaysSend(sendMessage);
initStatsCardSend(sendMessage);
initThemePicker();
initChatSend(sendMessage);
initChat();
initQuestsSend(sendMessage);

// Initialize cosmetic shop
initShopSend(sendMessage);

// ── Auth handlers ──
dom.authShowLoginBtn!.addEventListener('click', showAuthOverlay);
dom.authLogoutBtn!.addEventListener('click', submitLogout);

// ── Lobby profile bar handlers ──
dom.lobbyProfileEditBtn!.addEventListener('click', toggleLobbyEditor);
dom.lobbyEditorSaveBtn!.addEventListener('click', saveLobbyProfile);
dom.lobbyProfileLoginBtn!.addEventListener('click', showAuthOverlay);
dom.lobbyProfileLogoutBtn!.addEventListener('click', submitLogout);

dom.authBackBtn!.addEventListener('click', hideAuthOverlay);

dom.authTabs!.querySelectorAll<HTMLElement>('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab!));
});

dom.authLoginSubmit!.addEventListener('click', submitLogin);
dom.authLoginPassword!.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') submitLogin();
});

dom.authRegSubmit!.addEventListener('click', submitRegister);
dom.authRegConfirm!.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') submitRegister();
});

// ── Leaderboard tab handlers ──
dom.lobbiesTab!.addEventListener('click', showLobbiesTab);
dom.leaderboardTab!.addEventListener('click', showLeaderboardTab);

// ── Replays tab handler ──
if (dom.replaysTab) dom.replaysTab.addEventListener('click', () => { hideShopPanel(); showReplaysTab(); });

// ── Stats card tab handler ──
if (dom.statsCardTab) dom.statsCardTab.addEventListener('click', () => { hideShopPanel(); showStatsCardTab(); });

// ── Shop tab handler ──
if (dom.shopTab) dom.shopTab.addEventListener('click', showShopTab);

// ── Quests tab handler ──
if (dom.questsTab) dom.questsTab.addEventListener('click', showQuestsTab);
if (dom.statsCardDownloadBtn) dom.statsCardDownloadBtn.addEventListener('click', downloadStatsCardPng);

// ── Playback controls ──
if (dom.playbackControls) {
  dom.playbackControls.querySelector('.playback-pause-btn')?.addEventListener('click', togglePause);
  dom.playbackControls.querySelector('.playback-speed-btn')?.addEventListener('click', cycleSpeed);
}

// ── Dev panel ──
fetch('/api/dev-mode')
  .then(res => res.json())
  .then((data: { enabled: boolean }) => {
    if (!data.enabled) return;
    clientState.devMode = true;

    const panel = document.createElement('div');
    panel.id = 'dev-panel';
    panel.innerHTML = `
      <div id="dev-panel-header">DEV</div>
      <div id="dev-panel-body" class="hidden">
        <button class="dev-btn" data-cmd="skip-to-boss">Skip to Boss</button>
        <div class="dev-level-btns">
          <button class="dev-btn" data-cmd="skip-to-level" data-level="1">Lv 1</button>
          <button class="dev-btn" data-cmd="skip-to-level" data-level="2">Lv 2</button>
          <button class="dev-btn" data-cmd="skip-to-level" data-level="3">Lv 3</button>
        </div>
        <div class="dev-hp-row">
          <input type="number" id="dev-boss-hp" placeholder="Boss HP" min="0" />
          <button class="dev-btn" data-cmd="set-boss-hp">Set</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const header = panel.querySelector<HTMLElement>('#dev-panel-header')!;
    const body = panel.querySelector<HTMLElement>('#dev-panel-body')!;
    header.addEventListener('click', () => body.classList.toggle('hidden'));

    panel.addEventListener('click', (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]');
      if (!btn) return;
      const cmd = btn.dataset.cmd!;
      const msg: Record<string, unknown> = { type: 'dev-command', command: cmd };
      if (cmd === 'skip-to-level') msg.level = parseInt(btn.dataset.level!);
      if (cmd === 'set-boss-hp') msg.value = parseInt((document.getElementById('dev-boss-hp') as HTMLInputElement).value) || 1;
      sendMessage(msg);
    });
  })
  .catch(() => { /* dev-mode endpoint not available */ });

// Start
connect();
updateHUD(0, 1, 100);
