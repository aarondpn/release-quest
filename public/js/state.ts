import type { ClientState, DomRefs } from './client-types.ts';

export const clientState: ClientState = {
  myId: null,
  myColor: null,
  myIcon: null,
  myName: null,
  hasJoined: false,
  ws: null,
  bugs: {},
  bugPositions: {},
  remoteCursors: {},
  players: {},
  lastCursorSend: 0,
  selectedIcon: null,
  currentPhase: null,
  bossElement: null,
  bossHpBarContainer: null,
  bossPhase: 1,
  bossPhaseName: 'The Sprint',
  bossShieldActive: false,
  bossType: null,
  currentLobbyId: null,
  currentLobbyCode: null,
  pendingJoinCode: null,
  lobbies: [],
  authToken: null,
  authUser: null,
  isLoggedIn: false,
  duckElement: null,
  hammerElement: null,
  difficultyPresets: null,
  hasCustomSettings: false,
  // Chat state
  lobbyCreatorId: null,
  // Quests
  questData: null,
  byteCoinsBalance: 0,
  questTimerInterval: null,
  // Roguelike
  gameMode: 'roguelike',
  roguelikeMap: null,
  // Dev mode
  devMode: false,
  // Spectator state
  isSpectating: false,
  // Playback state
  isPlayback: false,
  playbackTimers: [],
  playbackSpeed: 1,
  playbackPaused: false,
  playbackRecording: null,
  playbackGameTimeOffset: 0,
  playbackWallTimeRef: 0,
};

export const dom: DomRefs = {
  arena: null,
  scoreEl: null,
  levelEl: null,
  hpBar: null,
  playerCountEl: null,
  connStatus: null,
  startScreen: null,
  gameoverScreen: null,
  winScreen: null,
  levelScreen: null,
  bossScreen: null,
  shopScreen: null,
  mapScreen: null,
  eventScreen: null,
  restScreen: null,
  miniBossScreen: null,
  rewardScreen: null,
  nameEntry: null,
  nameInput: null,
  iconPicker: null,
  joinBtn: null,
  lobbyBrowser: null,
  lobbyList: null,
  lobbyNameInput: null,
  lobbyMaxPlayers: null,
  lobbyPasswordInput: null,
  createLobbyBtn: null,
  lobbyError: null,
  authStatus: null,
  authShowLoginBtn: null,
  authLogoutBtn: null,
  authUsername: null,
  authOverlay: null,
  authTabs: null,
  authLoginForm: null,
  authRegisterForm: null,
  authError: null,
  authLoginUsername: null,
  authLoginPassword: null,
  authLoginSubmit: null,
  authRegUsername: null,
  authRegDisplayName: null,
  authRegPassword: null,
  authRegConfirm: null,
  authRegSubmit: null,
  authBackBtn: null,
  lobbyListPanel: null,
  leaderboardPanel: null,
  leaderboardList: null,
  leaderboardPeriodTabs: null,
  leaderboardTab: null,
  lobbiesTab: null,
  liveDashboard: null,
  replaysPanel: null,
  replaysList: null,
  replaysTab: null,
  playbackControls: null,
  playbackProgressFill: null,
  playbackProgressBar: null,
  playbackTimeCurrent: null,
  playbackTimeTotal: null,
  lobbyDifficulty: null,
  advancedToggleBtn: null,
  lobbyAdvancedConfig: null,
  advancedResetBtn: null,
  configStartingHp: null,
  configHpDamage: null,
  configBugPoints: null,
  configBossHp: null,
  configBossTime: null,
  configBossClickDamage: null,
  configBossKillBonus: null,
  configBossRegen: null,
  configHeisenbug: null,
  configCodeReview: null,
  configMergeConflict: null,
  configPipelineBug: null,
  configMemoryLeak: null,
  configInfiniteLoop: null,
  configAzubi: null,
  toggleHeisenbug: null,
  toggleCodeReview: null,
  toggleMergeConflict: null,
  togglePipelineBug: null,
  toggleMemoryLeak: null,
  toggleInfiniteLoop: null,
  toggleAzubi: null,
  configDuckDuration: null,
  configHammerDuration: null,
  statsCardPanel: null,
  statsCardTab: null,
  statsCardPreview: null,
  statsCardThemes: null,
  statsCardDownloadBtn: null,
  lobbyProfileBar: null,
  lobbyProfileIcon: null,
  lobbyProfileName: null,
  lobbyProfileEditBtn: null,
  lobbyProfileAuth: null,
  lobbyProfileEditor: null,
  lobbyEditorIconPicker: null,
  lobbyEditorEmoteBindings: null,
  lobbyEditorNameInput: null,
  lobbyEditorSaveBtn: null,
  lobbyProfileLoginBtn: null,
  lobbyProfileLogoutBtn: null,
  lobbyProfileGuestView: null,
  lobbyProfileLoggedInView: null,
  lobbyProfileAuthName: null,
  spectatorCount: null,
  spectatorBanner: null,
  onlineCountEl: null,
  chatPanel: null,
  chatMessages: null,
  chatInput: null,
  chatSendBtn: null,
  chatToggleBtn: null,
  chatHandle: null,
  chatBadge: null,
  questTracker: null,
  questTrackerList: null,
  questTrackerLocked: null,
  questTrackerTimer: null,
  qtBalance: null,
  profileCoinBalance: null,
  profileCoins: null,
  shopPanel: null,
  shopTab: null,
  shopGrid: null,
  shopBalanceAmount: null,
  shopGuestLock: null,
  questsPanel: null,
  questsTab: null,
};

export function initDom(): void {
  dom.arena = document.getElementById('arena');
  dom.scoreEl = document.getElementById('score');
  dom.levelEl = document.getElementById('level');
  dom.hpBar = document.getElementById('hp-bar');
  dom.playerCountEl = document.getElementById('player-count');
  dom.connStatus = document.getElementById('conn-status');
  dom.startScreen = document.getElementById('start-screen');
  dom.gameoverScreen = document.getElementById('gameover-screen');
  dom.winScreen = document.getElementById('win-screen');
  dom.levelScreen = document.getElementById('level-screen');
  dom.bossScreen = document.getElementById('boss-screen');
  dom.shopScreen = document.getElementById('shop-screen');
  dom.mapScreen = document.getElementById('map-screen');
  dom.eventScreen = document.getElementById('event-screen');
  dom.restScreen = document.getElementById('rest-screen');
  dom.miniBossScreen = document.getElementById('mini-boss-screen');
  dom.rewardScreen = document.getElementById('reward-screen');
  dom.nameEntry = document.getElementById('name-entry');
  dom.nameInput = document.querySelector<HTMLInputElement>('#name-input');
  dom.iconPicker = document.getElementById('icon-picker');
  dom.joinBtn = document.getElementById('join-btn');
  dom.lobbyBrowser = document.getElementById('lobby-browser');
  dom.lobbyList = document.getElementById('lobby-list');
  dom.lobbyNameInput = document.querySelector<HTMLInputElement>('#lobby-name-input');
  dom.lobbyMaxPlayers = document.getElementById('lobby-max-players');
  dom.lobbyPasswordInput = document.querySelector<HTMLInputElement>('#lobby-password-input');
  dom.lobbyDifficulty = document.getElementById('lobby-difficulty');
  dom.createLobbyBtn = document.getElementById('create-lobby-btn');
  dom.lobbyError = document.getElementById('lobby-error');
  dom.advancedToggleBtn = document.getElementById('advanced-toggle-btn');
  dom.lobbyAdvancedConfig = document.getElementById('lobby-advanced-config');
  dom.advancedResetBtn = document.getElementById('advanced-reset-btn');
  dom.configStartingHp = document.querySelector<HTMLInputElement>('#config-starting-hp');
  dom.configHpDamage = document.querySelector<HTMLInputElement>('#config-hp-damage');
  dom.configBugPoints = document.querySelector<HTMLInputElement>('#config-bug-points');
  dom.configBossHp = document.querySelector<HTMLInputElement>('#config-boss-hp');
  dom.configBossTime = document.querySelector<HTMLInputElement>('#config-boss-time');
  dom.configBossClickDamage = document.querySelector<HTMLInputElement>('#config-boss-click-damage');
  dom.configBossKillBonus = document.querySelector<HTMLInputElement>('#config-boss-kill-bonus');
  dom.configBossRegen = document.querySelector<HTMLInputElement>('#config-boss-regen');
  dom.configHeisenbug = document.querySelector<HTMLInputElement>('#config-heisenbug');
  dom.configCodeReview = document.querySelector<HTMLInputElement>('#config-code-review');
  dom.configMergeConflict = document.querySelector<HTMLInputElement>('#config-merge-conflict');
  dom.configPipelineBug = document.querySelector<HTMLInputElement>('#config-pipeline-bug');
  dom.configMemoryLeak = document.querySelector<HTMLInputElement>('#config-memory-leak');
  dom.configInfiniteLoop = document.querySelector<HTMLInputElement>('#config-infinite-loop');
  dom.configAzubi = document.querySelector<HTMLInputElement>('#config-azubi');
  dom.toggleHeisenbug = document.querySelector<HTMLInputElement>('#toggle-heisenbug');
  dom.toggleCodeReview = document.querySelector<HTMLInputElement>('#toggle-code-review');
  dom.toggleMergeConflict = document.querySelector<HTMLInputElement>('#toggle-merge-conflict');
  dom.togglePipelineBug = document.querySelector<HTMLInputElement>('#toggle-pipeline-bug');
  dom.toggleMemoryLeak = document.querySelector<HTMLInputElement>('#toggle-memory-leak');
  dom.toggleInfiniteLoop = document.querySelector<HTMLInputElement>('#toggle-infinite-loop');
  dom.toggleAzubi = document.querySelector<HTMLInputElement>('#toggle-azubi');
  dom.configDuckDuration = document.querySelector<HTMLInputElement>('#config-duck-duration');
  dom.configHammerDuration = document.querySelector<HTMLInputElement>('#config-hammer-duration');
  dom.authStatus = document.getElementById('auth-status');
  dom.authShowLoginBtn = document.getElementById('auth-show-login-btn');
  dom.authLogoutBtn = document.getElementById('auth-logout-btn');
  dom.authUsername = document.getElementById('auth-username');
  dom.authOverlay = document.getElementById('auth-overlay');
  dom.authTabs = document.getElementById('auth-tabs');
  dom.authLoginForm = document.getElementById('auth-login-form');
  dom.authRegisterForm = document.getElementById('auth-register-form');
  dom.authError = document.getElementById('auth-error');
  dom.authLoginUsername = document.querySelector<HTMLInputElement>('#auth-login-username');
  dom.authLoginPassword = document.querySelector<HTMLInputElement>('#auth-login-password');
  dom.authLoginSubmit = document.getElementById('auth-login-submit');
  dom.authRegUsername = document.querySelector<HTMLInputElement>('#auth-reg-username');
  dom.authRegDisplayName = document.querySelector<HTMLInputElement>('#auth-reg-display-name');
  dom.authRegPassword = document.querySelector<HTMLInputElement>('#auth-reg-password');
  dom.authRegConfirm = document.querySelector<HTMLInputElement>('#auth-reg-confirm');
  dom.authRegSubmit = document.getElementById('auth-reg-submit');
  dom.authBackBtn = document.getElementById('auth-back-btn');
  dom.lobbyListPanel = document.getElementById('lobby-list-panel');
  dom.leaderboardPanel = document.getElementById('leaderboard-panel');
  dom.leaderboardList = document.getElementById('leaderboard-list');
  dom.leaderboardPeriodTabs = document.getElementById('leaderboard-period-tabs');
  dom.leaderboardTab = document.getElementById('leaderboard-tab');
  dom.lobbiesTab = document.getElementById('lobbies-tab');
  dom.liveDashboard = document.getElementById('live-dashboard');
  dom.replaysPanel = document.getElementById('replays-panel');
  dom.replaysList = document.getElementById('replays-list');
  dom.replaysTab = document.getElementById('replays-tab');
  dom.playbackControls = document.getElementById('playback-controls');
  dom.playbackProgressFill = document.querySelector('.playback-progress-fill');
  dom.playbackProgressBar = document.querySelector('.playback-progress-bar');
  dom.playbackTimeCurrent = document.querySelector('.playback-time-current');
  dom.playbackTimeTotal = document.querySelector('.playback-time-total');
  dom.statsCardPanel = document.getElementById('stats-card-panel');
  dom.statsCardTab = document.getElementById('stats-card-tab');
  dom.statsCardPreview = document.getElementById('stats-card-preview');
  dom.statsCardThemes = document.getElementById('stats-card-themes');
  dom.statsCardDownloadBtn = document.querySelector<HTMLButtonElement>('#stats-card-download-btn');
  dom.lobbyProfileBar = document.getElementById('lobby-profile-bar');
  dom.lobbyProfileIcon = document.getElementById('lobby-profile-icon');
  dom.lobbyProfileName = document.getElementById('lobby-profile-name');
  dom.lobbyProfileEditBtn = document.getElementById('lobby-profile-edit-btn');
  dom.lobbyProfileAuth = document.getElementById('lobby-profile-auth');
  dom.lobbyProfileEditor = document.getElementById('lobby-profile-editor');
  dom.lobbyEditorIconPicker = document.getElementById('lobby-editor-icon-picker');
  dom.lobbyEditorEmoteBindings = document.getElementById('lobby-editor-emote-bindings');
  dom.lobbyEditorNameInput = document.querySelector<HTMLInputElement>('#lobby-editor-name-input');
  dom.lobbyEditorSaveBtn = document.getElementById('lobby-editor-save-btn');
  dom.lobbyProfileLoginBtn = document.getElementById('lobby-profile-login-btn');
  dom.lobbyProfileLogoutBtn = document.getElementById('lobby-profile-logout-btn');
  dom.lobbyProfileGuestView = document.querySelector('.lobby-profile-guest-view');
  dom.lobbyProfileLoggedInView = document.querySelector('.lobby-profile-logged-in-view');
  dom.lobbyProfileAuthName = document.getElementById('lobby-profile-auth-name');
  dom.spectatorCount = document.getElementById('spectator-count');
  dom.spectatorBanner = document.getElementById('spectator-banner');
  dom.onlineCountEl = document.getElementById('online-count');
  dom.chatPanel = document.getElementById('chat-panel');
  dom.chatMessages = document.getElementById('chat-messages');
  dom.chatInput = document.querySelector<HTMLInputElement>('#chat-input');
  dom.chatSendBtn = document.querySelector<HTMLButtonElement>('#chat-send-btn');
  dom.chatToggleBtn = document.getElementById('chat-toggle-btn');
  dom.chatHandle = document.getElementById('chat-handle');
  dom.chatBadge = document.getElementById('chat-badge');
  dom.questTracker = document.getElementById('quest-tracker');
  dom.questTrackerList = document.getElementById('quest-tracker-list');
  dom.questTrackerLocked = document.getElementById('quest-tracker-locked');
  dom.questTrackerTimer = document.getElementById('qt-timer');
  dom.qtBalance = document.getElementById('qt-balance');
  dom.profileCoinBalance = document.getElementById('profile-coin-balance');
  dom.profileCoins = document.getElementById('lobby-profile-coins');
  dom.shopPanel = document.getElementById('shop-panel');
  dom.shopTab = document.getElementById('shop-tab');
  dom.shopGrid = document.getElementById('shop-grid');
  dom.shopBalanceAmount = document.getElementById('shop-balance-amount');
  dom.shopGuestLock = document.getElementById('shop-guest-lock');
  dom.questsPanel = document.getElementById('quests-panel');
  dom.questsTab = document.getElementById('quests-tab');
}

/**
 * Switch between lobby browser tabs (lobbies, leaderboard, replays, stats card, shop, quests).
 * Hides all panels, deactivates all tabs, then shows/activates the given panel and tab.
 */
export function activateLobbyTab(activePanel: HTMLElement | null, activeTab: HTMLElement | null): void {
  const panels = [dom.lobbyListPanel, dom.leaderboardPanel, dom.replaysPanel, dom.statsCardPanel, dom.shopPanel, dom.questsPanel];
  const tabs = [dom.lobbiesTab, dom.leaderboardTab, dom.replaysTab, dom.statsCardTab, dom.shopTab, dom.questsTab];
  for (const p of panels) if (p) p.classList.add('hidden');
  for (const t of tabs) if (t) t.classList.remove('active');
  if (activePanel) activePanel.classList.remove('hidden');
  if (activeTab) activeTab.classList.add('active');
}
