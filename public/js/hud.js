import { dom, clientState } from './state.js';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function updateHUD(score, level, hp) {
  if (score !== undefined) dom.scoreEl.textContent = score;
  if (level !== undefined) dom.levelEl.textContent = level;
  if (hp !== undefined) {
    dom.hpBar.style.width = hp + '%';
    if (hp <= 25) dom.hpBar.classList.add('low');
    else dom.hpBar.classList.remove('low');
  }
}

export function updatePlayerCount() {
  dom.playerCountEl.textContent = Object.keys(clientState.players).length;
}

export function hideAllScreens() {
  dom.startScreen.classList.add('hidden');
  dom.gameoverScreen.classList.add('hidden');
  dom.winScreen.classList.add('hidden');
  dom.levelScreen.classList.add('hidden');
  dom.bossScreen.classList.add('hidden');
}

export function showStartScreen() {
  hideAllScreens();
  dom.startScreen.classList.remove('hidden');
}

export function showGameOverScreen(score, level, playerList) {
  hideAllScreens();
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-level').textContent = level;
  renderScoreboard(document.getElementById('gameover-scoreboard'), playerList);
  dom.gameoverScreen.classList.remove('hidden');
}

export function showWinScreen(score, playerList) {
  hideAllScreens();
  document.getElementById('win-score').textContent = score;
  renderScoreboard(document.getElementById('win-scoreboard'), playerList);
  dom.winScreen.classList.remove('hidden');
}

export function showLevelScreen(levelNum) {
  hideAllScreens();
  document.getElementById('level-screen-num').textContent = levelNum;
  dom.levelScreen.classList.remove('hidden');
}

export function renderScoreboard(container, playerList) {
  const sorted = playerList.slice().sort((a, b) => b.score - a.score);
  container.innerHTML = sorted.map(p =>
    '<div class="scoreboard-row">' +
      '<span class="scoreboard-name">' +
        '<span style="font-size:14px;margin-right:4px">' + (p.icon || '') + '</span>' +
        escapeHtml(p.name) + (p.id === clientState.myId ? ' (you)' : '') +
      '</span>' +
      '<span class="scoreboard-points">' + p.score + '</span>' +
    '</div>'
  ).join('');
}
