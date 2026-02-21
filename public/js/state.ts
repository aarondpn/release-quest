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
  dom.nameEntry = document.getElementById('name-entry');
  dom.nameInput = document.getElementById('name-input') as HTMLInputElement | null;
  dom.iconPicker = document.getElementById('icon-picker');
  dom.joinBtn = document.getElementById('join-btn');
  dom.lobbyBrowser = document.getElementById('lobby-browser');
  dom.lobbyList = document.getElementById('lobby-list');
  dom.lobbyNameInput = document.getElementById('lobby-name-input') as HTMLInputElement | null;
  dom.lobbyMaxPlayers = document.getElementById('lobby-max-players');
  dom.lobbyPasswordInput = document.getElementById('lobby-password-input') as HTMLInputElement | null;
  dom.lobbyDifficulty = document.getElementById('lobby-difficulty');
  dom.createLobbyBtn = document.getElementById('create-lobby-btn');
  dom.lobbyError = document.getElementById('lobby-error');
  dom.advancedToggleBtn = document.getElementById('advanced-toggle-btn');
  dom.lobbyAdvancedConfig = document.getElementById('lobby-advanced-config');
  dom.advancedResetBtn = document.getElementById('advanced-reset-btn');
  dom.configStartingHp = document.getElementById('config-starting-hp') as HTMLInputElement | null;
  dom.configHpDamage = document.getElementById('config-hp-damage') as HTMLInputElement | null;
  dom.configBugPoints = document.getElementById('config-bug-points') as HTMLInputElement | null;
  dom.configBossHp = document.getElementById('config-boss-hp') as HTMLInputElement | null;
  dom.configBossTime = document.getElementById('config-boss-time') as HTMLInputElement | null;
  dom.configBossClickDamage = document.getElementById('config-boss-click-damage') as HTMLInputElement | null;
  dom.configBossKillBonus = document.getElementById('config-boss-kill-bonus') as HTMLInputElement | null;
  dom.configBossRegen = document.getElementById('config-boss-regen') as HTMLInputElement | null;
  dom.configHeisenbug = document.getElementById('config-heisenbug') as HTMLInputElement | null;
  dom.configCodeReview = document.getElementById('config-code-review') as HTMLInputElement | null;
  dom.configMergeConflict = document.getElementById('config-merge-conflict') as HTMLInputElement | null;
  dom.configPipelineBug = document.getElementById('config-pipeline-bug') as HTMLInputElement | null;
  dom.configMemoryLeak = document.getElementById('config-memory-leak') as HTMLInputElement | null;
  dom.configInfiniteLoop = document.getElementById('config-infinite-loop') as HTMLInputElement | null;
  dom.configAzubi = document.getElementById('config-azubi') as HTMLInputElement | null;
  dom.toggleHeisenbug = document.getElementById('toggle-heisenbug') as HTMLInputElement | null;
  dom.toggleCodeReview = document.getElementById('toggle-code-review') as HTMLInputElement | null;
  dom.toggleMergeConflict = document.getElementById('toggle-merge-conflict') as HTMLInputElement | null;
  dom.togglePipelineBug = document.getElementById('toggle-pipeline-bug') as HTMLInputElement | null;
  dom.toggleMemoryLeak = document.getElementById('toggle-memory-leak') as HTMLInputElement | null;
  dom.toggleInfiniteLoop = document.getElementById('toggle-infinite-loop') as HTMLInputElement | null;
  dom.toggleAzubi = document.getElementById('toggle-azubi') as HTMLInputElement | null;
  dom.configDuckDuration = document.getElementById('config-duck-duration') as HTMLInputElement | null;
  dom.configHammerDuration = document.getElementById('config-hammer-duration') as HTMLInputElement | null;
  dom.authStatus = document.getElementById('auth-status');
  dom.authShowLoginBtn = document.getElementById('auth-show-login-btn');
  dom.authLogoutBtn = document.getElementById('auth-logout-btn');
  dom.authUsername = document.getElementById('auth-username');
  dom.authOverlay = document.getElementById('auth-overlay');
  dom.authTabs = document.getElementById('auth-tabs');
  dom.authLoginForm = document.getElementById('auth-login-form');
  dom.authRegisterForm = document.getElementById('auth-register-form');
  dom.authError = document.getElementById('auth-error');
  dom.authLoginUsername = document.getElementById('auth-login-username') as HTMLInputElement | null;
  dom.authLoginPassword = document.getElementById('auth-login-password') as HTMLInputElement | null;
  dom.authLoginSubmit = document.getElementById('auth-login-submit');
  dom.authRegUsername = document.getElementById('auth-reg-username') as HTMLInputElement | null;
  dom.authRegDisplayName = document.getElementById('auth-reg-display-name') as HTMLInputElement | null;
  dom.authRegPassword = document.getElementById('auth-reg-password') as HTMLInputElement | null;
  dom.authRegConfirm = document.getElementById('auth-reg-confirm') as HTMLInputElement | null;
  dom.authRegSubmit = document.getElementById('auth-reg-submit');
  dom.authBackBtn = document.getElementById('auth-back-btn');
  dom.lobbyListPanel = document.getElementById('lobby-list-panel');
  dom.leaderboardPanel = document.getElementById('leaderboard-panel');
  dom.leaderboardList = document.getElementById('leaderboard-list');
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
  dom.statsCardDownloadBtn = document.getElementById('stats-card-download-btn') as HTMLButtonElement | null;
  dom.lobbyProfileBar = document.getElementById('lobby-profile-bar');
  dom.lobbyProfileIcon = document.getElementById('lobby-profile-icon');
  dom.lobbyProfileName = document.getElementById('lobby-profile-name');
  dom.lobbyProfileEditBtn = document.getElementById('lobby-profile-edit-btn');
  dom.lobbyProfileAuth = document.getElementById('lobby-profile-auth');
  dom.lobbyProfileEditor = document.getElementById('lobby-profile-editor');
  dom.lobbyEditorIconPicker = document.getElementById('lobby-editor-icon-picker');
  dom.lobbyEditorNameInput = document.getElementById('lobby-editor-name-input') as HTMLInputElement | null;
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
  dom.chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
  dom.chatSendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement | null;
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
}
