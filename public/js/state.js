export const clientState = {
  myId: null,
  myColor: null,
  myIcon: null,
  myName: null,
  hasJoined: false,
  ws: null,
  bugs: {},
  remoteCursors: {},
  players: {},
  lastCursorSend: 0,
  selectedIcon: null,
  currentPhase: null,
  bossElement: null,
  bossHpBarContainer: null,
  bossEnraged: false,
  currentLobbyId: null,
  lobbies: [],
  authToken: null,
  authUser: null,
  isLoggedIn: false,
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
  nameEntry: null,
  nameInput: null,
  iconPicker: null,
  joinBtn: null,
  lobbyBrowser: null,
  lobbyList: null,
  lobbyNameInput: null,
  lobbyMaxPlayers: null,
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
  dom.nameEntry = document.getElementById('name-entry');
  dom.nameInput = document.getElementById('name-input');
  dom.iconPicker = document.getElementById('icon-picker');
  dom.joinBtn = document.getElementById('join-btn');
  dom.lobbyBrowser = document.getElementById('lobby-browser');
  dom.lobbyList = document.getElementById('lobby-list');
  dom.lobbyNameInput = document.getElementById('lobby-name-input');
  dom.lobbyMaxPlayers = document.getElementById('lobby-max-players');
  dom.createLobbyBtn = document.getElementById('create-lobby-btn');
  dom.lobbyError = document.getElementById('lobby-error');
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
}
