import type { RoguelikeMap, MapNode } from '../../shared/types.ts';
import type { SendMessageFn } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;
export function initMapSend(fn: SendMessageFn): void { _sendMessage = fn; }

const NODE_COLORS: Record<string, string> = {
  bug_level: '#ff6b6b',
  shop: '#4ecdc4',
  boss: '#a855f7',
  elite: '#ff9ff3',
  event: '#ffe66d',
  rest: '#54a0ff',
  mini_boss: '#ff6348',
};

export function renderMap(
  map: RoguelikeMap,
  availableNodes: string[],
  players: Record<string, { name: string; color: string }>,
): void {
  const container = document.getElementById('map-nodes');
  const svgEl = document.getElementById('map-edges') as unknown as SVGSVGElement;
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

  const totalRows = Math.max(...[...rows.keys()]) + 1;

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

    el.innerHTML =
      `<div class="map-node-icon">${node.icon}</div>` +
      `<div class="map-node-label">${node.label}</div>` +
      `<div class="map-node-votes" id="votes-${node.id}"></div>`;

    container.appendChild(el);
    nodeEls.set(node.id, el);
  }

  // Draw edges
  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    for (const node of map.nodes) {
      const fromEl = nodeEls.get(node.id);
      if (!fromEl) continue;

      for (const connId of node.connections) {
        const toEl = nodeEls.get(connId);
        if (!toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const x1 = fromRect.left - containerRect.left + fromRect.width / 2;
        const y1 = fromRect.top - containerRect.top + fromRect.height / 2;
        const x2 = toRect.left - containerRect.left + toRect.width / 2;
        const y2 = toRect.top - containerRect.top + toRect.height / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));

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
  });
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
  const el = document.querySelector<HTMLElement>(`.map-node[data-node-id="${nodeId}"]`);
  if (el) {
    el.classList.add('selected');
  }
}

export function showVoteTimer(timeRemaining: number): void {
  const timerEl = document.getElementById('map-vote-timer');
  if (!timerEl) return;

  timerEl.classList.remove('hidden');
  const seconds = Math.ceil(timeRemaining / 1000);
  const fill = timerEl.querySelector<HTMLElement>('.map-timer-fill');
  const text = timerEl.querySelector<HTMLElement>('.map-timer-text');

  if (text) text.textContent = `${seconds}s`;
  if (fill) {
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(() => {
      fill.style.transition = `width ${timeRemaining}ms linear`;
      fill.style.width = '0%';
    });
  }
}

export function hideVoteTimer(): void {
  const timerEl = document.getElementById('map-vote-timer');
  if (timerEl) timerEl.classList.add('hidden');
}

export function updateMapStats(hp: number, score: number): void {
  const hpEl = document.getElementById('map-hp-value');
  const scoreEl = document.getElementById('map-score-value');
  if (hpEl) hpEl.textContent = String(hp);
  if (scoreEl) scoreEl.textContent = String(score);
}
