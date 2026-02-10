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
}
