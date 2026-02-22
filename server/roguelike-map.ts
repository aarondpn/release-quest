import { ROGUELIKE_CONFIG } from './config.ts';
import type { RoguelikeMap, MapNode, MapNodeType } from './types.ts';

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NODE_ICONS: Record<MapNodeType, string> = {
  bug_level: '\u{1F41B}',
  shop: '\u{1F6D2}',
  boss: '\u{1F47E}',
  elite: '\u{2694}\u{FE0F}',
  event: '\u{2753}',
  rest: '\u{1F3D5}\u{FE0F}',
  mini_boss: '\u{1F608}',
};

const NODE_LABELS: Record<MapNodeType, string> = {
  bug_level: 'Bug Hunt',
  shop: 'Shop',
  boss: 'BOSS',
  elite: 'Elite',
  event: 'Event',
  rest: 'Rest',
  mini_boss: 'Mini-Boss',
};

function pickNodeType(rng: () => number, row: number, totalRows: number): MapNodeType {
  if (row === 0) return 'bug_level'; // row 0 always bug_level — no currency yet
  if (row === totalRows - 1) return 'bug_level'; // last gameplay row before boss
  const roll = rng();
  if (roll < 0.10) return 'rest';
  if (roll < 0.25) return 'event';
  if (roll < 0.45) return 'shop';
  return 'bug_level';
}

export function generateMap(seed: number, _difficulty: string = 'medium'): RoguelikeMap {
  const rng = mulberry32(seed);
  const totalRows = ROGUELIKE_CONFIG.mapRows;
  const nodes: MapNode[] = [];

  // Generate rows 0..totalRows-1 (gameplay rows), then row totalRows (boss)
  const rowNodes: string[][] = [];

  for (let row = 0; row < totalRows; row++) {
    const count = 2 + (rng() < 0.5 ? 1 : 0); // 2-3 nodes per row
    const ids: string[] = [];
    for (let col = 0; col < count; col++) {
      const id = `r${row}n${col}`;
      const type = pickNodeType(rng, row, totalRows);
      nodes.push({
        id,
        row,
        col,
        type,
        connections: [],
        visited: false,
        label: NODE_LABELS[type],
        icon: NODE_ICONS[type],
      });
      ids.push(id);
    }
    rowNodes.push(ids);
  }

  // Add boss node
  const bossId = `r${totalRows}n0`;
  nodes.push({
    id: bossId,
    row: totalRows,
    col: 0,
    type: 'boss',
    connections: [],
    visited: false,
    label: NODE_LABELS.boss,
    icon: NODE_ICONS.boss,
  });
  rowNodes.push([bossId]);

  // Connect rows: each node in row N connects to 1-2 nodes in row N+1
  // Ensure every node in N+1 has at least 1 incoming edge
  for (let row = 0; row < rowNodes.length - 1; row++) {
    const currentIds = rowNodes[row];
    const nextIds = rowNodes[row + 1];
    const incoming = new Set<string>();

    // Each node connects to at least 1 node in next row
    for (const nodeId of currentIds) {
      const node = nodes.find(n => n.id === nodeId)!;
      const targetIdx = Math.floor(rng() * nextIds.length);
      node.connections.push(nextIds[targetIdx]);
      incoming.add(nextIds[targetIdx]);

      // 50% chance to connect to a second node
      if (nextIds.length > 1 && rng() < 0.5) {
        const remaining = nextIds.filter((_, i) => i !== targetIdx);
        const secondIdx = Math.floor(rng() * remaining.length);
        node.connections.push(remaining[secondIdx]);
        incoming.add(remaining[secondIdx]);
      }
    }

    // Ensure all nodes in next row have at least 1 incoming edge
    for (const nextId of nextIds) {
      if (!incoming.has(nextId)) {
        // Connect from a random node in current row
        const sourceIdx = Math.floor(rng() * currentIds.length);
        const sourceNode = nodes.find(n => n.id === currentIds[sourceIdx])!;
        if (!sourceNode.connections.includes(nextId)) {
          sourceNode.connections.push(nextId);
        }
      }
    }
  }

  // Break up consecutive non-combat nodes: if same type connects to same type, convert child to bug_level
  breakConsecutiveType(nodes, 'shop');
  breakConsecutiveType(nodes, 'event');
  breakConsecutiveType(nodes, 'rest');

  // Validate: at least 1 shop reachable on every path from row 0 to boss
  validateShopAccess(nodes, rowNodes, rng);

  return { nodes, currentNodeId: null, seed };
}

function breakConsecutiveType(nodes: MapNode[], nodeType: MapNodeType): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    if (node.type !== nodeType) continue;
    for (const connId of node.connections) {
      const child = nodeMap.get(connId)!;
      if (child.type === nodeType) {
        child.type = 'bug_level';
        child.label = NODE_LABELS.bug_level;
        child.icon = NODE_ICONS.bug_level;
      }
    }
  }
}

function validateShopAccess(nodes: MapNode[], rowNodes: string[][], rng: () => number): void {
  // BFS from each starting node to check if a shop is reachable
  const startIds = rowNodes[0];
  let anyPathMissingShop = false;

  for (const startId of startIds) {
    if (!hasShopOnPath(nodes, startId)) {
      anyPathMissingShop = true;
      break;
    }
  }

  if (anyPathMissingShop) {
    // Fixup: convert a random mid-row bug_level to shop
    const midRows = rowNodes.slice(1, rowNodes.length - 2); // skip first, last gameplay, and boss
    for (const rowIds of midRows) {
      for (const id of rowIds) {
        const node = nodes.find(n => n.id === id)!;
        if (node.type === 'bug_level') {
          node.type = 'shop';
          node.label = NODE_LABELS.shop;
          node.icon = NODE_ICONS.shop;
          return;
        }
      }
    }
  }
}

function hasShopOnPath(nodes: MapNode[], startId: string): boolean {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodeMap.get(id)!;
    if (node.type === 'shop') return true;

    for (const connId of node.connections) {
      if (!visited.has(connId)) queue.push(connId);
    }
  }
  return false;
}

export function getReachableNodes(map: RoguelikeMap, currentNodeId: string | null): string[] {
  if (currentNodeId === null) {
    // At start: all nodes in row 0 are reachable
    return map.nodes.filter(n => n.row === 0).map(n => n.id);
  }

  const current = map.nodes.find(n => n.id === currentNodeId);
  if (!current) return [];
  return current.connections;
}

export function markNodeVisited(map: RoguelikeMap, nodeId: string): void {
  const node = map.nodes.find(n => n.id === nodeId);
  if (node) {
    node.visited = true;
    map.currentNodeId = nodeId;
  }
}
