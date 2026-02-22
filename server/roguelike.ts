import { ROGUELIKE_CONFIG, getDifficultyConfig } from './config.ts';
import { generateMap, getReachableNodes, markNodeVisited } from './roguelike-map.ts';
import { getPlayerScores } from './state.ts';
import { startLevel } from './game.ts';
import * as boss from './boss.ts';
import * as shop from './shop.ts';
import * as powerups from './powerups.ts';
import * as events from './events.ts';
import * as rest from './rest.ts';
import * as elite from './elite.ts';
import * as miniBoss from './mini-boss.ts';
import logger from './logger.ts';
import type { GameContext } from './types.ts';

export function startRoguelikeGame(ctx: GameContext): void {
  const { state } = ctx;
  const seed = Date.now();
  state.roguelikeMap = generateMap(seed, state.difficulty);

  logger.info({ lobbyId: ctx.lobbyId, seed, nodes: state.roguelikeMap.nodes.length }, 'Roguelike map generated');

  ctx.events.emit({
    type: 'roguelike-map',
    map: state.roguelikeMap,
    hp: state.hp,
    score: state.score,
    players: getPlayerScores(state),
  });

  showMapView(ctx);
}

export function showMapView(ctx: GameContext): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  ctx.lifecycle.transition(state, 'map_view');
  state.mapVotes = {};

  const available = getReachableNodes(state.roguelikeMap, state.roguelikeMap.currentNodeId);
  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);

  // Collect unique active buff item IDs
  const buffSet = new Set<string>();
  for (const buffs of Object.values(state.playerBuffs)) {
    for (const b of buffs) buffSet.add(b.itemId);
  }

  // Summarize active event modifier
  let eventModifierLabel: string | undefined;
  if (state.eventModifiers && Object.keys(state.eventModifiers).length > 0) {
    const parts: string[] = [];
    const em = state.eventModifiers;
    if (em.scoreMultiplier) parts.push(em.scoreMultiplier + 'x Score');
    if (em.bugsTotalMultiplier) parts.push(em.bugsTotalMultiplier + 'x Bugs');
    if (em.grantEagleEye) parts.push('Eagle Eye');
    if (em.onlyNormalBugs) parts.push('Nur normale Bugs');
    if (em.escapeTimeOffset) parts.push((em.escapeTimeOffset > 0 ? '+' : '') + (em.escapeTimeOffset / 1000) + 's Escape');
    if (em.spawnRateMultiplier) parts.push(em.spawnRateMultiplier + 'x Spawn');
    if (parts.length > 0) eventModifierLabel = parts.join(', ');
  }

  ctx.events.emit({
    type: 'map-view',
    currentNodeId: state.roguelikeMap.currentNodeId,
    availableNodes: available,
    soloMode,
    hp: state.hp,
    maxHp: diffConfig.startingHp,
    score: state.score,
    persistentScoreMultiplier: state.persistentScoreMultiplier ?? 1,
    activeBuffs: [...buffSet],
    eventModifierLabel,
  });

  if (!soloMode) {
    state.voteDeadline = Date.now() + ROGUELIKE_CONFIG.voteTimerMs;
    ctx.timers.lobby.setTimeout('mapVoteTimer', () => {
      resolveVote(ctx);
    }, ROGUELIKE_CONFIG.voteTimerMs);
  }
}

export function handleNodeVote(ctx: GameContext, pid: string, nodeId: string): void {
  const { state } = ctx;
  if (state.phase !== 'map_view' || !state.roguelikeMap) return;

  const available = getReachableNodes(state.roguelikeMap, state.roguelikeMap.currentNodeId);
  if (!available.includes(nodeId)) return;

  if (!state.mapVotes) state.mapVotes = {};
  state.mapVotes[pid] = nodeId;

  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;

  if (soloMode) {
    // Solo: immediate navigation
    resolveVote(ctx);
    return;
  }

  const timeRemaining = state.voteDeadline ? Math.max(0, state.voteDeadline - Date.now()) : 0;
  ctx.events.emit({
    type: 'map-vote-update',
    votes: state.mapVotes,
    timeRemaining,
  });

  // Check if all players voted
  const votedCount = Object.keys(state.mapVotes).length;
  if (votedCount >= playerCount) {
    resolveVote(ctx);
  }
}

function resolveVote(ctx: GameContext): void {
  const { state } = ctx;
  ctx.timers.lobby.clear('mapVoteTimer');

  if (!state.roguelikeMap || !state.mapVotes) return;

  const available = getReachableNodes(state.roguelikeMap, state.roguelikeMap.currentNodeId);
  if (available.length === 0) return;

  // Count votes per node
  const voteCounts: Record<string, number> = {};
  for (const nodeId of Object.values(state.mapVotes)) {
    voteCounts[nodeId] = (voteCounts[nodeId] || 0) + 1;
  }

  // Find winner: majority wins, ties broken by first in available list
  let winnerNodeId = available[0];
  let maxVotes = 0;
  for (const nodeId of available) {
    const count = voteCounts[nodeId] || 0;
    if (count > maxVotes) {
      maxVotes = count;
      winnerNodeId = nodeId;
    }
  }

  const winnerNode = state.roguelikeMap.nodes.find(n => n.id === winnerNodeId);
  if (!winnerNode) return;

  ctx.events.emit({
    type: 'map-node-selected',
    nodeId: winnerNodeId,
    nodeType: winnerNode.type,
  });

  // Delay before navigating
  ctx.timers.lobby.setTimeout('mapNavigate', () => {
    navigateToNode(ctx, winnerNodeId);
  }, 1500);
}

function navigateToNode(ctx: GameContext, nodeId: string): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  markNodeVisited(state.roguelikeMap, nodeId);
  const node = state.roguelikeMap.nodes.find(n => n.id === nodeId);
  if (!node) return;

  state.mapVotes = undefined;
  state.voteDeadline = undefined;

  switch (node.type) {
    case 'bug_level':
      state.level = node.row + 1;
      ctx.lifecycle.transition(state, 'playing');

      ctx.events.emit({
        type: 'game-start',
        level: state.level,
        hp: state.hp,
        score: state.score,
        players: getPlayerScores(state),
      });

      startLevel(ctx);
      powerups.startDuckSpawning(ctx);
      powerups.startHammerSpawning(ctx);
      break;

    case 'elite':
      elite.startElite(ctx, nodeId);
      break;

    case 'mini_boss':
      miniBoss.startMiniBoss(ctx, nodeId);
      break;

    case 'rest':
      rest.showRest(ctx);
      break;

    case 'event':
      events.showEvent(ctx, nodeId);
      break;

    case 'shop':
      shop.openShop(ctx);
      break;

    case 'boss':
      boss.startBoss(ctx);
      break;
  }
}

export function handleNodeComplete(ctx: GameContext): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  const currentNode = state.roguelikeMap.nodes.find(n => n.id === state.roguelikeMap!.currentNodeId);

  // Event modifiers expire after one combat — only clear after combat nodes
  const combatTypes = new Set(['bug_level', 'elite', 'mini_boss']);
  if (currentNode && combatTypes.has(currentNode.type)) {
    state.eventModifiers = undefined;
  }
  if (!currentNode) {
    showMapView(ctx);
    return;
  }

  // If current node is in the last pre-boss row, go to boss
  if (currentNode.row >= ROGUELIKE_CONFIG.mapRows - 1) {
    const bossNode = state.roguelikeMap.nodes.find(n => n.type === 'boss');
    if (bossNode) {
      markNodeVisited(state.roguelikeMap, bossNode.id);
      ctx.events.emit({
        type: 'map-node-selected',
        nodeId: bossNode.id,
        nodeType: 'boss',
      });
      ctx.timers.lobby.setTimeout('mapNavigateBoss', () => {
        boss.startBoss(ctx);
      }, 1500);
      return;
    }
  }

  showMapView(ctx);
}
