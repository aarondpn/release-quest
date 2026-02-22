import { getMiniBossType, getMiniBossKeys } from './mini-boss-types/index.ts';
import * as roguelike from './roguelike.ts';
import { endGame } from './game.ts';
import logger from './logger.ts';
import type { GameContext, MiniBossState } from './types.ts';

// ── Seeded RNG ──

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function pickMiniBoss(seed: number, nodeId: string): string {
  const keys = getMiniBossKeys();
  const combined = seed + hashString(nodeId) + 7919; // offset from elite picker
  const rng = mulberry32(combined);
  return keys[Math.floor(rng() * keys.length)];
}

export function startMiniBoss(ctx: GameContext, nodeId: string): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  const mbType = pickMiniBoss(state.roguelikeMap.seed, nodeId);
  const plugin = getMiniBossType(mbType);
  if (!plugin) return;

  const node = state.roguelikeMap.nodes.find(n => n.id === nodeId);
  state.level = node ? node.row + 1 : 1;

  const mbState: MiniBossState = {
    type: mbType,
    entities: [],
    timeRemaining: plugin.timeLimit,
    timeLimit: plugin.timeLimit,
    data: {},
  };
  state.miniBoss = mbState;

  ctx.lifecycle.transition(state, 'mini_boss');

  // Init plugin (it uses state.miniBoss.data)
  mbState.entities = plugin.init(ctx);

  logger.info({ lobbyId: ctx.lobbyId, miniBossType: mbType, title: plugin.displayName }, 'Mini-boss started');

  ctx.events.emit({
    type: 'mini-boss-spawn',
    miniBossType: mbType,
    title: plugin.displayName,
    icon: plugin.icon,
    description: plugin.description,
    timeLimit: plugin.timeLimit,
    entities: mbState.entities,
  });

  // Start tick timer (1s intervals)
  ctx.timers.lobby.setInterval('miniBossTick', () => {
    miniBossTick(ctx);
  }, 1000);
}

export function handleMiniBossClick(ctx: GameContext, pid: string, entityId: string): void {
  const { state } = ctx;
  if (state.phase !== 'mini_boss' || !state.miniBoss) return;

  const plugin = getMiniBossType(state.miniBoss.type);
  if (!plugin) return;

  plugin.onClick(ctx, pid, entityId);

  // Check victory after click
  if (plugin.checkVictory(ctx)) {
    endMiniBoss(ctx, true);
  }
}

function miniBossTick(ctx: GameContext): void {
  const { state } = ctx;
  if (state.phase !== 'mini_boss' || !state.miniBoss) return;

  const plugin = getMiniBossType(state.miniBoss.type);
  if (!plugin) return;

  state.miniBoss.timeRemaining--;

  plugin.onTick(ctx);

  // Check victory after tick
  if (plugin.checkVictory(ctx)) {
    endMiniBoss(ctx, true);
    return;
  }

  ctx.events.emit({
    type: 'mini-boss-tick',
    timeRemaining: state.miniBoss.timeRemaining,
    entities: state.miniBoss.entities,
  });

  // Check timeout
  if (state.miniBoss.timeRemaining <= 0) {
    endMiniBoss(ctx, false);
  }
}

function endMiniBoss(ctx: GameContext, victory: boolean): void {
  const { state } = ctx;
  if (!state.miniBoss) return;

  ctx.timers.lobby.clear('miniBossTick');

  const plugin = getMiniBossType(state.miniBoss.type);
  const penalty = plugin ? plugin.defeatPenalty : 20;

  let hpChange: number | undefined;
  if (!victory) {
    hpChange = -penalty;
    state.hp = Math.max(0, state.hp + hpChange);
  }

  logger.info({
    lobbyId: ctx.lobbyId,
    miniBossType: state.miniBoss.type,
    victory,
    hpChange,
  }, 'Mini-boss ended');

  ctx.events.emit({
    type: 'mini-boss-defeated',
    victory,
    hpChange,
    newHp: state.hp,
  });

  if (victory) {
    const playerCount = Object.keys(state.players).length;
    const soloMode = playerCount <= 1;

    ctx.events.emit({
      type: 'encounter-reward',
      encounterType: 'mini_boss',
      title: plugin?.displayName || 'Mini-Boss',
      scoreGained: 0,
      freeItem: null,
      totalScore: state.score,
      soloMode,
    });

    state.miniBoss = undefined;

    const delay = soloMode ? 100 : 5000;
    ctx.timers.lobby.setTimeout('miniBossRewardDone', () => {
      roguelike.handleNodeComplete(ctx);
    }, delay);
  } else {
    // Defeat: return to map after brief delay
    state.miniBoss = undefined;

    // Check for game over
    if (state.hp <= 0) {
      ctx.timers.lobby.setTimeout('miniBossGameOver', () => {
        endGame(ctx, 'loss', false);
      }, 2000);
      return;
    }

    ctx.timers.lobby.setTimeout('miniBossDefeatReturn', () => {
      roguelike.handleNodeComplete(ctx);
    }, 2500);
  }
}
