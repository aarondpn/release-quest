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
  stopLobbyAnimations();
}

export function showStartScreen() {
  hideAllScreens();
  dom.startScreen.classList.remove('hidden');
  startLobbyAnimations();
  updateLobbyRoster();
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

/* ══════════════════════════════════════════════════
   LOBBY WAITING SCREEN INTERACTIVE ELEMENTS
   ══════════════════════════════════════════════════ */

const LOBBY_TIPS = [
  'Click bugs before they escape the arena!',
  'Merge conflicts need 2 clicks from different players',
  'Green bugs are features - don\'t squish them!',
  'Teal bugs are Heisenbugs - they teleport when clicked!',
  'Collect the rubber duck for a score multiplier',
  'The boss regenerates HP over time - click fast!',
  'More players = more bugs. Teamwork matters!',
  'Boss enrages at 50% HP - bugs get faster!',
  'Escaped bugs drain your team\'s HP',
  'The duck gives a 2x score boost to everyone',
];

let lobbyTipTimer = null;
let lobbyBugSpawner = null;
let lobbyBugId = 0;

function startLobbyAnimations() {
  // Start tips rotation
  rotateTip();
  lobbyTipTimer = setInterval(rotateTip, 5000);

  // Start spawning background bugs
  spawnLobbyBugs();
  lobbyBugSpawner = setInterval(spawnLobbyBugs, 3000);
}

function stopLobbyAnimations() {
  if (lobbyTipTimer) { clearInterval(lobbyTipTimer); lobbyTipTimer = null; }
  if (lobbyBugSpawner) { clearInterval(lobbyBugSpawner); lobbyBugSpawner = null; }
  // Clean up existing lobby bugs
  const container = document.getElementById('lobby-bg-bugs');
  if (container) container.innerHTML = '';
}

/* ── Tips rotation ── */
let currentTipIndex = -1;
function rotateTip() {
  const el = document.getElementById('lobby-tips-text');
  if (!el) return;
  currentTipIndex = (currentTipIndex + 1) % LOBBY_TIPS.length;
  el.style.animation = 'none';
  // force reflow
  void el.offsetWidth;
  el.textContent = LOBBY_TIPS[currentTipIndex];
  el.style.animation = 'lobby-tip-slide 0.4s ease-out';
}

/* ── Player roster ── */
export function updateLobbyRoster() {
  const list = document.getElementById('lobby-roster-list');
  if (!list) return;
  // Only update if the start screen is visible
  if (dom.startScreen.classList.contains('hidden')) return;

  const players = Object.values(clientState.players);
  list.innerHTML = players.map((p, i) => {
    const isMe = p.id === clientState.myId;
    return '<div class="lobby-player-card' + (isMe ? ' is-me' : '') + '" style="animation-delay:' + (i * 0.08) + 's">' +
      '<span class="lobby-player-icon">' + (p.icon || '') + '</span>' +
      '<span class="lobby-player-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="lobby-player-dot" style="color:' + (p.color || 'var(--teal)') + ';background:' + (p.color || 'var(--teal)') + '"></span>' +
      (isMe ? '<span class="lobby-player-you">YOU</span>' : '') +
    '</div>';
  }).join('');
}

/* ── Background crawling bugs ── */
function spawnLobbyBugs() {
  const container = document.getElementById('lobby-bg-bugs');
  if (!container) return;

  // Cap at 8 bugs on screen
  if (container.children.length >= 8) return;

  const bug = document.createElement('div');
  const id = ++lobbyBugId;
  bug.dataset.id = id;

  // Random edge and direction
  const directions = ['crawl-right', 'crawl-left', 'crawl-down', 'crawl-up'];
  const dir = directions[Math.floor(Math.random() * directions.length)];
  const dur = 8 + Math.random() * 10;
  const delay = Math.random() * -dur;

  bug.className = 'lobby-bg-bug ' + dir;
  bug.style.setProperty('--crawl-dur', dur + 's');
  bug.style.setProperty('--crawl-delay', delay + 's');

  // Position along the perpendicular axis
  if (dir === 'crawl-right' || dir === 'crawl-left') {
    bug.style.top = (10 + Math.random() * 80) + '%';
  } else {
    bug.style.left = (10 + Math.random() * 80) + '%';
  }

  bug.innerHTML =
    '<div class="lobby-bg-bug-body">' +
      '<span class="lobby-bg-bug-eyes">oo</span>' +
    '</div>';

  // Click to squish
  bug.addEventListener('click', (e) => {
    e.stopPropagation();
    if (bug.classList.contains('squished')) return;
    bug.classList.add('squished');

    // Splat particles
    const rect = bug.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cx = rect.left - containerRect.left + rect.width / 2;
    const cy = rect.top - containerRect.top + rect.height / 2;

    const splat = document.createElement('div');
    splat.className = 'lobby-splat';
    splat.style.left = cx + 'px';
    splat.style.top = cy + 'px';

    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('div');
      dot.className = 'lobby-splat-dot';
      const angle = (Math.PI * 2 / 6) * i + Math.random() * 0.5;
      const dist = 8 + Math.random() * 14;
      dot.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
      dot.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
      splat.appendChild(dot);
    }
    container.appendChild(splat);

    setTimeout(() => {
      bug.remove();
      splat.remove();
    }, 400);
  });

  container.appendChild(bug);

  // Auto-remove after animation completes
  setTimeout(() => {
    if (bug.parentNode && !bug.classList.contains('squished')) {
      bug.remove();
    }
  }, dur * 1000);
}
