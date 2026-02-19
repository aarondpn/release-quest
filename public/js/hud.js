import { dom, clientState } from './state.js';
import { renderIcon } from './avatars.js';
import { showWalkout } from './walkout.js';

// sendMessage is injected lazily to avoid circular dependency
let _hudSendMessage = null;
export function initHudSend(fn) { _hudSendMessage = fn; }

const ROLE_DEFS = [
  { id: 'debugger', name: 'Debugger', icon: '🔍', description: '+50% pts on special bugs' },
  { id: 'qa',       name: 'QA Eng',   icon: '🎯', description: '+40% click hitbox' },
  { id: 'devops',   name: 'DevOps',   icon: '⚡', description: 'Power-ups last 50% longer' },
  { id: 'architect',name: 'Architect',icon: '🏗️', description: 'Solo merge conflicts; free pipeline reset' },
];
const ROLE_MAP = Object.fromEntries(ROLE_DEFS.map(r => [r.id, r]));

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
  if (dom.shopScreen) dom.shopScreen.classList.add('hidden');
  stopLobbyAnimations();
}

export function showStartScreen() {
  hideAllScreens();
  dom.startScreen.classList.remove('hidden');
  startLobbyAnimations();
  updateLobbyRoster();
  updateLobbyRolePicker();
  updateStartButtonState();
  const warningEl = document.getElementById('lobby-custom-warning');
  if (warningEl) {
    warningEl.classList.toggle('hidden', !clientState.hasCustomSettings);
  }
}

function isLobbyModerator() {
  return !clientState.lobbyCreatorId || clientState.lobbyCreatorId === clientState.myId;
}

export function updateStartButtonState() {
  const isMod = isLobbyModerator();
  const btns = [document.getElementById('start-btn'), document.getElementById('retry-btn'), document.getElementById('continue-btn')];
  for (const btn of btns) {
    if (!btn) continue;
    if (clientState.isSpectating) {
      btn.style.display = 'none';
      continue;
    }
    btn.style.display = '';
    btn.disabled = !isMod;
    btn.title = isMod ? '' : 'Only the lobby host can start the game';
  }
  const hint = document.getElementById('lobby-host-hint');
  if (hint) hint.classList.toggle('hidden', isMod);
}

export function showGameOverScreen(score, level, playerList) {
  if (playerList && playerList.length >= 2) {
    showWalkout(playerList, () => {
      hideAllScreens();
      document.getElementById('final-score').textContent = score;
      document.getElementById('final-level').textContent = level;
      renderScoreboard(document.getElementById('gameover-scoreboard'), playerList);
      dom.gameoverScreen.classList.remove('hidden');
      updateStartButtonState();
    });
    return;
  }
  hideAllScreens();
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-level').textContent = level;
  renderScoreboard(document.getElementById('gameover-scoreboard'), playerList);
  dom.gameoverScreen.classList.remove('hidden');
  updateStartButtonState();
}

export function showWinScreen(score, playerList) {
  if (playerList && playerList.length >= 2) {
    showWalkout(playerList, () => {
      hideAllScreens();
      document.getElementById('win-score').textContent = score;
      renderScoreboard(document.getElementById('win-scoreboard'), playerList);
      dom.winScreen.classList.remove('hidden');
      updateStartButtonState();
    });
    return;
  }
  hideAllScreens();
  document.getElementById('win-score').textContent = score;
  renderScoreboard(document.getElementById('win-scoreboard'), playerList);
  dom.winScreen.classList.remove('hidden');
  updateStartButtonState();
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
        '<span style="margin-right:4px">' + renderIcon(p.icon || '', 14) + '</span>' +
        escapeHtml(p.name) + (p.id === clientState.myId ? ' (you)' : '') +
        (p.isGuest ? ' <span class="guest-badge">GUEST</span>' : '') +
      '</span>' +
      '<span class="scoreboard-points">' + p.score + '</span>' +
    '</div>'
  ).join('');
}

/* ══════════════════════════════════════════════════
   LIVE IN-GAME DASHBOARD
   ══════════════════════════════════════════════════ */

let dashRafPending = false;

export function updateLiveDashboard() {
  if (dashRafPending) return;
  dashRafPending = true;
  requestAnimationFrame(() => {
    dashRafPending = false;
    renderLiveDashboard();
  });
}

function renderLiveDashboard() {
  const container = dom.liveDashboard;
  if (!container || container.classList.contains('hidden')) return;

  const players = Object.values(clientState.players);
  if (!players.length) return;

  const sorted = players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));

  // Capture old positions (FLIP step 1: First)
  const existingRows = container.querySelectorAll('.live-dash-row');
  const oldPositions = {};
  existingRows.forEach(row => {
    oldPositions[row.dataset.playerId] = row.getBoundingClientRect();
  });

  // Build or reuse rows
  const rowMap = {};
  existingRows.forEach(row => { rowMap[row.dataset.playerId] = row; });

  // Remove rows for players no longer present
  const currentIds = new Set(sorted.map(p => p.id));
  existingRows.forEach(row => {
    if (!currentIds.has(row.dataset.playerId)) row.remove();
  });

  sorted.forEach((p, i) => {
    let row = rowMap[p.id];
    const rank = i + 1;
    const isMe = p.id === clientState.myId;
    const score = p.score || 0;

    if (!row) {
      row = document.createElement('div');
      row.className = 'live-dash-row';
      row.dataset.playerId = p.id;
      row.dataset.prevScore = score;

      row.innerHTML =
        '<span class="live-dash-rank"></span>' +
        '<span class="live-dash-name">' +
          '<span class="live-dash-icon"></span>' +
          '<span class="live-dash-name-text"></span>' +
          '<span class="live-dash-role"></span>' +
        '</span>' +
        '<span class="live-dash-score"></span>';
      container.appendChild(row);
    }

    // Update rank
    row.querySelector('.live-dash-rank').textContent = rank;

    // Update name & icon
    row.querySelector('.live-dash-icon').innerHTML = renderIcon(p.icon || '', 10);
    row.querySelector('.live-dash-name-text').textContent = escapeHtml(p.name);

    // Update role icon
    const roleEl = row.querySelector('.live-dash-role');
    if (roleEl) {
      const rd = p.role ? ROLE_MAP[p.role] : null;
      roleEl.textContent = rd ? rd.icon : '';
      roleEl.title = rd ? rd.name : '';
    }

    // Guest badge
    let guestBadge = row.querySelector('.guest-badge');
    if (p.isGuest && !guestBadge) {
      guestBadge = document.createElement('span');
      guestBadge.className = 'guest-badge';
      guestBadge.textContent = 'GUEST';
      row.querySelector('.live-dash-name').appendChild(guestBadge);
    } else if (!p.isGuest && guestBadge) {
      guestBadge.remove();
    }

    // Score change detection
    const prevScore = parseInt(row.dataset.prevScore) || 0;
    const scoreEl = row.querySelector('.live-dash-score');
    scoreEl.textContent = score;

    if (score > prevScore && prevScore > 0) {
      // Pop animation
      scoreEl.classList.remove('score-pop');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('score-pop');

      // Floating delta
      const delta = score - prevScore;
      const deltaEl = document.createElement('span');
      deltaEl.className = 'live-dash-delta';
      deltaEl.textContent = '+' + delta;
      row.appendChild(deltaEl);
      setTimeout(() => deltaEl.remove(), 800);
    }
    row.dataset.prevScore = score;

    // Highlight current player
    row.classList.toggle('is-me', isMe);

    // Ensure correct DOM order
    container.appendChild(row);
  });

  // FLIP step 2: Last — get new positions, then Invert + Play
  const newRows = container.querySelectorAll('.live-dash-row');
  newRows.forEach(row => {
    const pid = row.dataset.playerId;
    const oldPos = oldPositions[pid];
    if (oldPos) {
      const newPos = row.getBoundingClientRect();
      const dy = oldPos.top - newPos.top;
      if (Math.abs(dy) > 1) {
        row.style.transition = 'none';
        row.style.transform = 'translateY(' + dy + 'px)';
        void row.offsetWidth;
        row.style.transition = 'transform 0.3s ease';
        row.style.transform = 'translateY(0)';
      }
    }
  });
}

export function showLiveDashboard() {
  if (dom.liveDashboard) dom.liveDashboard.classList.remove('hidden');
  updateLiveDashboard();
}

export function hideLiveDashboard() {
  if (dom.liveDashboard) dom.liveDashboard.classList.add('hidden');
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
  'Boss evolves through 3 phases - adapt your strategy!',
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
    const roleData = p.role ? ROLE_MAP[p.role] : null;
    const roleBadge = roleData
      ? '<span class="lobby-player-role" title="' + roleData.name + ': ' + roleData.description + '">' + roleData.icon + '</span>'
      : '';
    return '<div class="lobby-player-card' + (isMe ? ' is-me' : '') + '" data-player-id="' + p.id + '" style="animation-delay:' + (i * 0.08) + 's">' +
      '<span class="lobby-player-icon">' + renderIcon(p.icon || '', 16) + '</span>' +
      '<span class="lobby-player-name">' + escapeHtml(p.name) + '</span>' +
      roleBadge +
      (p.isGuest ? '<span class="guest-badge">GUEST</span>' : '') +
      '<span class="lobby-player-dot" style="color:' + (p.color || 'var(--teal)') + ';background:' + (p.color || 'var(--teal)') + '"></span>' +
      (isMe ? '<span class="lobby-player-you">YOU</span>' : '') +
    '</div>';
  }).join('');
}

export function updateLobbyPlayerRoleBadge(pid, role) {
  const list = document.getElementById('lobby-roster-list');
  if (!list) return;
  const card = list.querySelector('[data-player-id="' + pid + '"]');
  if (!card) return;
  const roleData = role ? ROLE_MAP[role] : null;
  let badge = card.querySelector('.lobby-player-role');
  if (roleData) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'lobby-player-role';
      // Insert after the name span
      const nameSpan = card.querySelector('.lobby-player-name');
      if (nameSpan) nameSpan.after(badge);
      else card.insertBefore(badge, card.children[2] || null);
    }
    badge.textContent = roleData.icon;
    badge.title = roleData.name + ': ' + roleData.description;
  } else if (badge) {
    badge.remove();
  }
}

/* ── Role picker ── */
export function updateLobbyRolePicker() {
  const cards = document.getElementById('lobby-role-cards');
  if (!cards) return;
  if (dom.startScreen.classList.contains('hidden')) return;

  const myPlayer = clientState.players[clientState.myId];
  const myRole = myPlayer?.role || null;

  cards.innerHTML = ROLE_DEFS.map(role => {
    const selected = myRole === role.id;
    return '<button class="lobby-role-card' + (selected ? ' selected' : '') + '" data-role="' + role.id + '">' +
      '<div class="lobby-role-card-header">' +
        '<span class="lobby-role-card-icon">' + role.icon + '</span>' +
        '<span class="lobby-role-card-name">' + escapeHtml(role.name) + '</span>' +
      '</div>' +
      '<span class="lobby-role-card-desc">' + escapeHtml(role.description) + '</span>' +
      '<span class="lobby-role-card-check">✓</span>' +
    '</button>';
  }).join('');

  cards.querySelectorAll('.lobby-role-card').forEach(card => {
    card.addEventListener('click', () => {
      const roleId = card.dataset.role;
      const currentRole = clientState.players[clientState.myId]?.role || null;
      const newRole = currentRole === roleId ? null : roleId;
      if (_hudSendMessage) _hudSendMessage({ type: 'select-role', role: newRole });
    });
  });

  // Update hint line
  const hint = document.getElementById('lobby-role-hint');
  if (hint) {
    if (myRole) {
      const rd = ROLE_MAP[myRole];
      hint.textContent = rd ? rd.description + '  ·  click to deselect' : '';
      hint.classList.add('has-role');
    } else {
      hint.textContent = 'no role selected — vanilla gameplay';
      hint.classList.remove('has-role');
    }
  }
}

/* ── Background crawling bugs ── */
function spawnLobbyBugs() {
  const container = document.getElementById('lobby-bg-bugs');
  if (!container) return;

  // Set arena dimensions for transform-based crawl animations
  container.style.setProperty('--arena-w', container.offsetWidth + 'px');
  container.style.setProperty('--arena-h', container.offsetHeight + 'px');

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
