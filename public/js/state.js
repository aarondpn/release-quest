export const clientState = {
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
  // Dev mode
  devMode: false,
  // Playback state
  isPlayback: false,
  playbackTimers: [],
  playbackSpeed: 1,
  playbackPaused: false,
  playbackRecording: null,
  playbackGameTimeOffset: 0,
  playbackWallTimeRef: 0,
};

export const dom = {
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
  onlineCountEl: null,
  chatPanel: null,
  chatMessages: null,
  chatInput: null,
  chatSendBtn: null,
  chatToggleBtn: null,
  chatHandle: null,
  chatBadge: null,
};

export function initDom() {
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
  dom.nameInput = document.getElementById('name-input');
  dom.iconPicker = document.getElementById('icon-picker');
  dom.joinBtn = document.getElementById('join-btn');
  dom.lobbyBrowser = document.getElementById('lobby-browser');
  dom.lobbyList = document.getElementById('lobby-list');
  dom.lobbyNameInput = document.getElementById('lobby-name-input');
  dom.lobbyMaxPlayers = document.getElementById('lobby-max-players');
  dom.lobbyPasswordInput = document.getElementById('lobby-password-input');
  dom.lobbyDifficulty = document.getElementById('lobby-difficulty');
  dom.createLobbyBtn = document.getElementById('create-lobby-btn');
  dom.lobbyError = document.getElementById('lobby-error');
  dom.advancedToggleBtn = document.getElementById('advanced-toggle-btn');
  dom.lobbyAdvancedConfig = document.getElementById('lobby-advanced-config');
  dom.advancedResetBtn = document.getElementById('advanced-reset-btn');
  dom.configStartingHp = document.getElementById('config-starting-hp');
  dom.configHpDamage = document.getElementById('config-hp-damage');
  dom.configBugPoints = document.getElementById('config-bug-points');
  dom.configBossHp = document.getElementById('config-boss-hp');
  dom.configBossTime = document.getElementById('config-boss-time');
  dom.configBossClickDamage = document.getElementById('config-boss-click-damage');
  dom.configBossKillBonus = document.getElementById('config-boss-kill-bonus');
  dom.configBossRegen = document.getElementById('config-boss-regen');
  dom.configHeisenbug = document.getElementById('config-heisenbug');
  dom.configCodeReview = document.getElementById('config-code-review');
  dom.configMergeConflict = document.getElementById('config-merge-conflict');
  dom.configPipelineBug = document.getElementById('config-pipeline-bug');
  dom.configMemoryLeak = document.getElementById('config-memory-leak');
  dom.configInfiniteLoop = document.getElementById('config-infinite-loop');
  dom.configAzubi = document.getElementById('config-azubi');
  dom.toggleHeisenbug = document.getElementById('toggle-heisenbug');
  dom.toggleCodeReview = document.getElementById('toggle-code-review');
  dom.toggleMergeConflict = document.getElementById('toggle-merge-conflict');
  dom.togglePipelineBug = document.getElementById('toggle-pipeline-bug');
  dom.toggleMemoryLeak = document.getElementById('toggle-memory-leak');
  dom.toggleInfiniteLoop = document.getElementById('toggle-infinite-loop');
  dom.toggleAzubi = document.getElementById('toggle-azubi');
  dom.configDuckDuration = document.getElementById('config-duck-duration');
  dom.configHammerDuration = document.getElementById('config-hammer-duration');
  dom.authStatus = document.getElementById('auth-status');
  dom.authShowLoginBtn = document.getElementById('auth-show-login-btn');
  dom.authLogoutBtn = document.getElementById('auth-logout-btn');
  dom.authUsername = document.getElementById('auth-username');
  dom.authOverlay = document.getElementById('auth-overlay');
  dom.authTabs = document.getElementById('auth-tabs');
  dom.authLoginForm = document.getElementById('auth-login-form');
  dom.authRegisterForm = document.getElementById('auth-register-form');
  dom.authError = document.getElementById('auth-error');
  dom.authLoginUsername = document.getElementById('auth-login-username');
  dom.authLoginPassword = document.getElementById('auth-login-password');
  dom.authLoginSubmit = document.getElementById('auth-login-submit');
  dom.authRegUsername = document.getElementById('auth-reg-username');
  dom.authRegDisplayName = document.getElementById('auth-reg-display-name');
  dom.authRegPassword = document.getElementById('auth-reg-password');
  dom.authRegConfirm = document.getElementById('auth-reg-confirm');
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
  dom.statsCardDownloadBtn = document.getElementById('stats-card-download-btn');
  dom.lobbyProfileBar = document.getElementById('lobby-profile-bar');
  dom.lobbyProfileIcon = document.getElementById('lobby-profile-icon');
  dom.lobbyProfileName = document.getElementById('lobby-profile-name');
  dom.lobbyProfileEditBtn = document.getElementById('lobby-profile-edit-btn');
  dom.lobbyProfileAuth = document.getElementById('lobby-profile-auth');
  dom.lobbyProfileEditor = document.getElementById('lobby-profile-editor');
  dom.lobbyEditorIconPicker = document.getElementById('lobby-editor-icon-picker');
  dom.lobbyEditorNameInput = document.getElementById('lobby-editor-name-input');
  dom.lobbyEditorSaveBtn = document.getElementById('lobby-editor-save-btn');
  dom.lobbyProfileLoginBtn = document.getElementById('lobby-profile-login-btn');
  dom.lobbyProfileLogoutBtn = document.getElementById('lobby-profile-logout-btn');
  dom.lobbyProfileGuestView = document.querySelector('.lobby-profile-guest-view');
  dom.lobbyProfileLoggedInView = document.querySelector('.lobby-profile-logged-in-view');
  dom.lobbyProfileAuthName = document.getElementById('lobby-profile-auth-name');
  dom.onlineCountEl = document.getElementById('online-count');
  dom.chatPanel = document.getElementById('chat-panel');
  dom.chatMessages = document.getElementById('chat-messages');
  dom.chatInput = document.getElementById('chat-input');
  dom.chatSendBtn = document.getElementById('chat-send-btn');
  dom.chatToggleBtn = document.getElementById('chat-toggle-btn');
  dom.chatHandle = document.getElementById('chat-handle');
  dom.chatBadge = document.getElementById('chat-badge');
}
