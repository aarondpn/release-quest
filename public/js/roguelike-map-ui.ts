import type { RoguelikeMap, MapNode } from '../../shared/types.ts';
import type { SendMessageFn } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;
export function initMapSend(fn: SendMessageFn): void { _sendMessage = fn; }

// State for edge redraw on resize
let _lastMap: RoguelikeMap | null = null;
let _lastAvailableSet: Set<string> | null = null;
let _lastNodeEls: Map<string, HTMLElement> | null = null;
let _resizeHandler: (() => void) | null = null;

const NODE_COLORS: Record<string, string> = {
  bug_level: '#ff6b6b',
  shop: '#4ecdc4',
  boss: '#a855f7',
  elite: '#ff9ff3',
  event: '#ffe66d',
  rest: '#54a0ff',
  mini_boss: '#ff6348',
};

const NODE_SVG_ICONS: Record<string, string> = {
  bug_level: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <ellipse cx="11" cy="13.5" rx="5" ry="6" fill="currentColor"/>
    <circle cx="11" cy="6.5" r="3.5" fill="currentColor"/>
    <circle cx="9.3" cy="5.7" r="1" fill="#0c0c2a"/>
    <circle cx="12.7" cy="5.7" r="1" fill="#0c0c2a"/>
    <line x1="9.3" y1="3.2" x2="7" y2="1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="12.7" y1="3.2" x2="15" y2="1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="6" y1="9.5" x2="2" y2="7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="16" y1="9.5" x2="20" y2="7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="6" y1="13" x2="2" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="16" y1="13" x2="20" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="6.5" y1="16.5" x2="2.5" y2="18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="15.5" y1="16.5" x2="19.5" y2="18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  shop: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M8 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="3" y="8" width="16" height="12" rx="3" fill="currentColor"/>
    <line x1="11" y1="11.5" x2="11" y2="16.5" stroke="#0c0c2a" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="8.5" y1="14" x2="13.5" y2="14" stroke="#0c0c2a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  boss: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M11 2C7.14 2 4 5.14 4 9c0 2.9 1.7 5.4 4.2 6.64V18h5.6v-2.36C16.3 14.4 18 11.9 18 9c0-3.86-3.14-7-7-7z" fill="currentColor"/>
    <circle cx="8.5" cy="9" r="2" fill="#0c0c2a"/>
    <circle cx="13.5" cy="9" r="2" fill="#0c0c2a"/>
    <rect x="8" y="18" width="2" height="1.8" rx="0.5" fill="currentColor"/>
    <rect x="12" y="18" width="2" height="1.8" rx="0.5" fill="currentColor"/>
    <path d="M9.5 13.5q1.5 1.5 3 0" stroke="#0c0c2a" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
  elite: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <line x1="3.5" y1="3.5" x2="18.5" y2="18.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="18.5" y1="3.5" x2="3.5" y2="18.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="1.5" y1="5.5" x2="5.5" y2="1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="16.5" y1="1.5" x2="20.5" y2="5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  event: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="11" cy="11" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
    <path d="M8.5 8.5C8.5 7.12 9.62 6 11 6s2.5 1.12 2.5 2.5C13.5 10 11 11 11 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="11" cy="16.5" r="1.3" fill="currentColor"/>
  </svg>`,
  rest: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M11 2L20 18H2L11 2z" fill="currentColor"/>
    <path d="M9 18v-6a2 2 0 0 1 4 0v6" stroke="#0c0c2a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="1" y1="18.5" x2="21" y2="18.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  mini_boss: `<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="11" cy="12" r="7" fill="currentColor"/>
    <path d="M8 5.5L6.5 2M14 5.5L15.5 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="8.5" cy="11.5" r="1.4" fill="#0c0c2a"/>
    <circle cx="13.5" cy="11.5" r="1.4" fill="#0c0c2a"/>
    <path d="M8 15c1.5 2 6.5 2 6 0" stroke="#0c0c2a" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,
};

export function renderMap(
  map: RoguelikeMap,
  availableNodes: string[],
  _players: Record<string, { name: string; color: string }>,
): void {
  const container = document.getElementById('map-nodes');
  const svgEl = document.querySelector<SVGSVGElement>('#map-edges');
  if (!container || !svgEl) return;

  container.innerHTML = '';
  svgEl.innerHTML = '';

  const availableSet = new Set(availableNodes);
  const nodeEls = new Map<string, HTMLElement>();

  // Group nodes by row
  const rows = new Map<number, MapNode[]>();
  for (const node of map.nodes) {
    if (!rows.has(node.row)) rows.set(node.row, []);
    rows.get(node.row)!.push(node);
  }

  const totalRows = Math.max(...rows.keys()) + 1;

  // Create node elements
  for (const node of map.nodes) {
    const el = document.createElement('div');
    el.className = 'map-node';
    el.dataset.nodeId = node.id;
    el.dataset.nodeType = node.type;

    const rowNodes = rows.get(node.row)!;
    const colCount = rowNodes.length;
    const colIndex = rowNodes.indexOf(node);

    // Position: vertical layout, row 0 at top
    const rowPct = 8 + (node.row / (totalRows - 1)) * 82;
    const colPct = ((colIndex + 1) / (colCount + 1)) * 100;
    el.style.top = `${rowPct}%`;
    el.style.left = `${colPct}%`;

    el.classList.add('map-node-type-' + node.type);

    if (node.visited) {
      el.classList.add('visited');
    } else if (availableSet.has(node.id)) {
      el.classList.add('available');
      el.addEventListener('click', () => {
        if (_sendMessage) {
          _sendMessage({ type: 'map-vote', nodeId: node.id });
          // Visual feedback: mark as selected locally
          container.querySelectorAll('.map-node.my-vote').forEach(n => n.classList.remove('my-vote'));
          el.classList.add('my-vote');
        }
      });
    } else if (node.id === map.currentNodeId) {
      el.classList.add('current');
    } else {
      el.classList.add('locked');
    }

    const color = NODE_COLORS[node.type] || '#888';
    el.style.setProperty('--node-color', color);

    const svgIcon = NODE_SVG_ICONS[node.type] || node.icon;
    el.innerHTML =
      `<div class="map-node-icon">${svgIcon}</div>` +
      `<div class="map-node-label">${node.label}</div>` +
      `<div class="map-node-votes" id="votes-${node.id}"></div>`;

    container.appendChild(el);
    nodeEls.set(node.id, el);
  }

  // Store state for resize redraws
  _lastMap = map;
  _lastAvailableSet = availableSet;
  _lastNodeEls = nodeEls;

  // Draw edges (initial + on resize)
  requestAnimationFrame(() => drawEdges(container, svgEl, map, availableSet, nodeEls));

  // Add resize listener for edge redraw
  if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
  _resizeHandler = () => {
    if (_lastMap && _lastAvailableSet && _lastNodeEls) {
      drawEdges(container, svgEl, _lastMap, _lastAvailableSet, _lastNodeEls);
    }
  };
  window.addEventListener('resize', _resizeHandler);
}

function drawEdges(
  container: HTMLElement,
  svgEl: SVGSVGElement,
  map: RoguelikeMap,
  availableSet: Set<string>,
  nodeEls: Map<string, HTMLElement>,
): void {
  svgEl.innerHTML = '';
  const containerRect = container.getBoundingClientRect();

  // Pre-compute all node center positions in one pass to avoid repeated layout thrashing
  const nodePositions = new Map<string, { cx: number; cy: number }>();
  for (const [id, el] of nodeEls) {
    const rect = el.getBoundingClientRect();
    nodePositions.set(id, {
      cx: rect.left - containerRect.left + rect.width / 2,
      cy: rect.top - containerRect.top + rect.height / 2,
    });
  }

  for (const node of map.nodes) {
    const fromPos = nodePositions.get(node.id);
    if (!fromPos) continue;

    for (const connId of node.connections) {
      const toPos = nodePositions.get(connId);
      if (!toPos) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(fromPos.cx));
      line.setAttribute('y1', String(fromPos.cy));
      line.setAttribute('x2', String(toPos.cx));
      line.setAttribute('y2', String(toPos.cy));

      // Highlight edges to available nodes
      const toNode = map.nodes.find(n => n.id === connId);
      if (node.visited || node.id === map.currentNodeId || (map.currentNodeId === null && node.row === 0)) {
        if (availableSet.has(connId)) {
          line.classList.add('edge-available');
        } else if (toNode?.visited) {
          line.classList.add('edge-visited');
        }
      }

      svgEl.appendChild(line);
    }
  }
}

export function updateVotes(
  votes: Record<string, string>,
  players: Record<string, { name: string; color: string }>,
): void {
  // Clear existing vote dots
  document.querySelectorAll('.map-node-votes').forEach(el => { el.innerHTML = ''; });

  // Group votes by nodeId
  const votesByNode: Record<string, string[]> = {};
  for (const [pid, nodeId] of Object.entries(votes)) {
    if (!votesByNode[nodeId]) votesByNode[nodeId] = [];
    votesByNode[nodeId].push(pid);
  }

  for (const [nodeId, pids] of Object.entries(votesByNode)) {
    const container = document.getElementById(`votes-${nodeId}`);
    if (!container) continue;

    for (const pid of pids) {
      const dot = document.createElement('div');
      dot.className = 'map-vote-dot';
      const player = players[pid];
      dot.style.backgroundColor = player?.color || '#888';
      dot.title = player?.name || 'Player';
      container.appendChild(dot);
    }
  }
}

export function highlightSelectedNode(nodeId: string): void {
  // Clear all local vote highlights and disable further clicks
  const container = document.getElementById('map-nodes');
  if (container) {
    container.querySelectorAll('.map-node.my-vote').forEach(n => n.classList.remove('my-vote'));
    container.querySelectorAll('.map-node.available').forEach(n => {
      n.classList.remove('available');
      n.classList.add('locked');
    });
  }
  const el = document.querySelector<HTMLElement>(`.map-node[data-node-id="${nodeId}"]`);
  if (el) {
    el.classList.remove('locked');
    el.classList.add('selected');
  }
}

let _voteTimerInterval: ReturnType<typeof setInterval> | null = null;
let _voteTimerEnd = 0;

export function showVoteTimer(timeRemaining: number): void {
  const timerEl = document.getElementById('map-vote-timer');
  if (!timerEl) return;

  timerEl.classList.remove('hidden');
  const fill = timerEl.querySelector<HTMLElement>('.map-timer-fill');
  const text = timerEl.querySelector<HTMLElement>('.map-timer-text');

  _voteTimerEnd = Date.now() + timeRemaining;

  // Update text immediately
  const seconds = Math.ceil(timeRemaining / 1000);
  if (text) text.textContent = `${seconds}s`;

  // Animate the bar via CSS transition
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(() => {
      fill.style.transition = `width ${timeRemaining}ms linear`;
      fill.style.width = '0%';
    });
  }

  // Count down the seconds text
  if (_voteTimerInterval) clearInterval(_voteTimerInterval);
  _voteTimerInterval = setInterval(() => {
    const remaining = Math.max(0, _voteTimerEnd - Date.now());
    const secs = Math.ceil(remaining / 1000);
    if (text) text.textContent = `${secs}s`;
    if (remaining <= 0) {
      if (_voteTimerInterval) { clearInterval(_voteTimerInterval); _voteTimerInterval = null; }
    }
  }, 250);
}

export function hideVoteTimer(): void {
  const timerEl = document.getElementById('map-vote-timer');
  if (timerEl) timerEl.classList.add('hidden');
  if (_voteTimerInterval) { clearInterval(_voteTimerInterval); _voteTimerInterval = null; }
}

const _SVG_INLINE = 'display:inline-block;vertical-align:middle;margin-right:3px';

const BUFF_SVG_ICONS: Record<string, string> = {
  'bigger-cursor': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><path d="M2 1.5l9 5.5-4.5 1-1.5 4.5z" fill="currentColor"/></svg>`,
  'bug-magnet': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><path d="M3.5 7a3.5 3.5 0 0 1 7 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="3.5" y1="7" x2="3.5" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="10.5" y1="7" x2="10.5" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="2.5" y1="11" x2="4.5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9.5" y1="11" x2="11.5" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  'eagle-eye': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><path d="M1 7c2-3.5 10-3.5 12 0C11 10.5 3 10.5 1 7z" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.2"/><circle cx="7" cy="7" r="2.5" fill="currentColor"/></svg>`,
  'kevlar-vest': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><path d="M7 1L2 3.5v4C2 10.8 4.2 12.7 7 13c2.8-.3 5-2.2 5-5.5v-4L7 1z" fill="currentColor"/></svg>`,
  'turbo-duck': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><path d="M8 1L3 8h4L6 13l7-8H9L10 1z" fill="currentColor"/></svg>`,
  'healing-patch': `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style="${_SVG_INLINE}"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/><line x1="7" y1="4.5" x2="7" y2="9.5" stroke="#0c0c2a" stroke-width="2" stroke-linecap="round"/><line x1="4.5" y1="7" x2="9.5" y2="7" stroke="#0c0c2a" stroke-width="2" stroke-linecap="round"/></svg>`,
};

const BUFF_NAMES: Record<string, string> = {
  'bigger-cursor': 'Bigger Cursor',
  'bug-magnet': 'Bug Magnet',
  'eagle-eye': 'Eagle Eye',
  'kevlar-vest': 'Kevlar Vest',
  'turbo-duck': 'Turbo Duck',
  'healing-patch': 'Healing Patch',
};

const _SVG_STAR = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style="${_SVG_INLINE}"><path d="M7 1l1.6 3.6L13 5l-3 2.8.7 4-3.7-2-3.7 2 .7-4L1 5l4.4-.4z" fill="currentColor"/></svg>`;
const _SVG_BOLT = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style="${_SVG_INLINE}"><path d="M8.5 1L3 8h4L5.5 13 12 6H8L9.5 1z" fill="currentColor"/></svg>`;

export function updateMapStats(hp: number, score: number): void {
  const hpEl = document.getElementById('map-hp-value');
  const scoreEl = document.getElementById('map-score-value');
  if (hpEl) hpEl.textContent = String(hp);
  if (scoreEl) scoreEl.textContent = String(score);
}

export function updateMapSidebar(data: {
  hp: number;
  maxHp: number;
  score: number;
  persistentScoreMultiplier: number;
  activeBuffs: string[];
  eventModifierLabel?: string;
}): void {
  // Update HP with bar
  const hpEl = document.getElementById('map-hp-value');
  if (hpEl) hpEl.textContent = data.hp + '/' + data.maxHp;

  const scoreEl = document.getElementById('map-score-value');
  if (scoreEl) scoreEl.textContent = String(data.score);

  // Update HP bar visual
  let hpBar = document.getElementById('map-hp-bar');
  if (!hpBar) {
    const hpStat = hpEl?.closest('.map-stat');
    if (hpStat) {
      hpBar = document.createElement('div');
      hpBar.id = 'map-hp-bar';
      hpBar.className = 'map-hp-bar';
      hpBar.innerHTML = '<div class="map-hp-bar-fill"></div>';
      hpStat.appendChild(hpBar);
    }
  }
  if (hpBar) {
    const fill = hpBar.querySelector<HTMLElement>('.map-hp-bar-fill');
    if (fill) {
      const pct = data.maxHp > 0 ? Math.round((data.hp / data.maxHp) * 100) : 0;
      fill.style.width = pct + '%';
      fill.className = 'map-hp-bar-fill' + (pct <= 25 ? ' low' : pct <= 50 ? ' medium' : '');
    }
  }

  // Buffs container
  let buffsContainer = document.getElementById('map-buffs');
  if (!buffsContainer) {
    const sidebar = document.querySelector('.map-sidebar');
    if (sidebar) {
      buffsContainer = document.createElement('div');
      buffsContainer.id = 'map-buffs';
      buffsContainer.className = 'map-buffs';
      // Insert before the hint
      const hint = sidebar.querySelector('.map-hint');
      if (hint) sidebar.insertBefore(buffsContainer, hint);
      else sidebar.appendChild(buffsContainer);
    }
  }

  if (buffsContainer) {
    let html = '';

    // Persistent score multiplier
    if (data.persistentScoreMultiplier > 1) {
      html += '<div class="map-buff-item score-bonus" title="Persistenter Score-Bonus">' +
        _SVG_STAR + '\u00D7' + data.persistentScoreMultiplier.toFixed(1) +
        '</div>';
    }

    // Active shop buffs
    for (const buffId of data.activeBuffs) {
      const icon = BUFF_SVG_ICONS[buffId] || '';
      const name = BUFF_NAMES[buffId] || buffId;
      html += '<div class="map-buff-item" title="' + name + '">' + icon + name + '</div>';
    }

    // Event modifier
    if (data.eventModifierLabel) {
      html += '<div class="map-buff-item event-mod" title="N\u00E4chster Kampf: ' + data.eventModifierLabel + '">' +
        _SVG_BOLT + data.eventModifierLabel +
        '</div>';
    }

    buffsContainer.innerHTML = html;
    buffsContainer.classList.toggle('hidden', html === '');
  }
}
