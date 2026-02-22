import { MAX_LEVEL, getDifficultyConfig } from './config.ts';
import { createLobbyLogger } from './logger.ts';
import * as boss from './boss.ts';
import { startLevel } from './game.ts';
import * as roguelike from './roguelike.ts';
import type { GameContext, ShopItem } from './types.ts';

interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;
  hardCostMultiplier: number;
  instant: boolean;
  expiresAtPhaseEnd: boolean;
}

const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'healing-patch',
    name: 'Healing Patch',
    description: 'Restore 25 HP immediately',
    icon: '\u{1FA79}',
    baseCost: 40,
    hardCostMultiplier: 1.25,
    instant: true,
    expiresAtPhaseEnd: false,
  },
  {
    id: 'bigger-cursor',
    name: 'Bigger Cursor',
    description: 'Enlarged cursor to track bugs easier',
    icon: '\u{1F5B1}',
    baseCost: 50,
    hardCostMultiplier: 1.25,
    instant: false,
    expiresAtPhaseEnd: true,
  },
  {
    id: 'bug-magnet',
    name: 'Bug Magnet',
    description: 'Bugs drift toward your cursor',
    icon: '\u{1F9F2}',
    baseCost: 60,
    hardCostMultiplier: 1.25,
    instant: false,
    expiresAtPhaseEnd: true,
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    description: 'Feature bugs glow red',
    icon: '\u{1F985}',
    baseCost: 60,
    hardCostMultiplier: 1.25,
    instant: false,
    expiresAtPhaseEnd: true,
  },
  {
    id: 'kevlar-vest',
    name: 'Kevlar Vest',
    description: '-50% HP damage from escaped bugs',
    icon: '\u{1F9BA}',
    baseCost: 75,
    hardCostMultiplier: 1.25,
    instant: false,
    expiresAtPhaseEnd: true,
  },
  {
    id: 'turbo-duck',
    name: 'Turbo Duck',
    description: 'Duck spawns 2x as often next level',
    icon: '\u{1F986}',
    baseCost: 80,
    hardCostMultiplier: 1.25,
    instant: false,
    expiresAtPhaseEnd: true,
  },
];

export function getShopItems(difficulty: string): ShopItem[] {
  const isHard = difficulty === 'hard';
  return SHOP_ITEMS.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    cost: isHard ? Math.ceil(item.baseCost * item.hardCostMultiplier) : item.baseCost,
  }));
}

export function openShop(ctx: GameContext): void {
  const { state } = ctx;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);

  // Clear buffs from previous level before opening shop for next purchases
  clearLevelBuffs(ctx);

  ctx.lifecycle.transition(state, 'shopping');
  state.shopReadyPlayers = new Set();

  const items = getShopItems(state.difficulty);

  // Build per-player scores
  const playerScores: Record<string, number> = {};
  for (const pid of Object.keys(state.players)) {
    playerScores[pid] = state.players[pid].score;
  }

  ctx.events.emit({
    type: 'shop-open',
    items,
    playerScores,
    duration: diffConfig.shop.duration,
    level: state.level,
    nextLevel: state.level >= MAX_LEVEL ? 'boss' : state.level + 1,
  });

  // In roguelike mode, use a longer fallback timeout (players must click Ready, but don't let it hang forever)
  const shopTimeout = state.gameMode === 'roguelike' ? diffConfig.shop.duration * 3 : diffConfig.shop.duration;
  ctx.timers.lobby.setTimeout('shopTimer', () => {
    try {
      closeShop(ctx);
    } catch (err) {
      const logCtx = createLobbyLogger(ctx.lobbyId.toString());
      logCtx.error({ err }, 'Error closing shop');
    }
  }, shopTimeout);
}

export function handleBuy(ctx: GameContext, pid: string, itemId: string): void {
  const { state } = ctx;
  if (state.phase !== 'shopping') return;

  const player = state.players[pid];
  if (!player) return;

  const items = getShopItems(state.difficulty);
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  // Check already purchased (non-instant items)
  const def = SHOP_ITEMS.find(d => d.id === itemId)!;
  if (!def.instant) {
    const existing = (state.playerBuffs[pid] || []).find(b => b.itemId === itemId);
    if (existing) return;
  }

  // Check can afford
  if (player.score < item.cost) return;

  // Deduct from player score
  player.score -= item.cost;
  state.score -= item.cost;

  // Apply effect
  if (def.instant) {
    applyInstantEffect(ctx, pid, itemId);
  } else {
    addBuff(ctx, pid, { itemId, expiresAtPhaseEnd: def.expiresAtPhaseEnd, source: 'shop' });
  }

  if (ctx.matchLog) {
    ctx.matchLog.log('shop-buy', { playerId: pid, itemId, cost: item.cost, playerScore: player.score });
  }

  ctx.events.emit({
    type: 'shop-buy',
    playerId: pid,
    playerName: player.name,
    playerColor: player.color,
    itemId,
    itemName: item.name,
    itemIcon: item.icon,
    cost: item.cost,
    playerScore: player.score,
    teamScore: state.score,
    hp: state.hp,
  });
}

function applyInstantEffect(ctx: GameContext, _pid: string, itemId: string): void {
  if (itemId === 'healing-patch') {
    const diffConfig = getDifficultyConfig(ctx.state.difficulty, ctx.state.customConfig);
    ctx.state.hp = Math.min(ctx.state.hp + 25, diffConfig.startingHp);
  }
}

export function handleReady(ctx: GameContext, pid: string): void {
  const { state } = ctx;
  if (state.phase !== 'shopping') return;
  if (!state.shopReadyPlayers) state.shopReadyPlayers = new Set();

  state.shopReadyPlayers.add(pid);

  ctx.events.emit({
    type: 'shop-ready',
    playerId: pid,
    readyCount: state.shopReadyPlayers.size,
    totalPlayers: Object.keys(state.players).length,
  });

  // Check if all players ready
  if (state.shopReadyPlayers.size >= Object.keys(state.players).length) {
    closeShop(ctx);
  }
}

export function closeShop(ctx: GameContext): void {
  const { state } = ctx;
  if (state.phase !== 'shopping') return;

  ctx.timers.lobby.clear('shopTimer');
  state.shopReadyPlayers = undefined;

  ctx.events.emit({ type: 'shop-close' });

  if (state.gameMode === 'roguelike') {
    roguelike.handleNodeComplete(ctx);
  } else if (state.level >= MAX_LEVEL) {
    boss.startBoss(ctx);
  } else {
    state.level++;
    ctx.lifecycle.transition(state, 'playing');
    startLevel(ctx);
  }
}

// ── Generic buff API ──

/** Add a buff to a player from any source. */
export function addBuff(ctx: GameContext, pid: string, opts: { itemId: string; expiresAtPhaseEnd: boolean; source?: string }): void {
  const { state } = ctx;
  if (!state.playerBuffs[pid]) state.playerBuffs[pid] = [];
  state.playerBuffs[pid].push({
    itemId: opts.itemId,
    playerId: pid,
    expiresAtPhaseEnd: opts.expiresAtPhaseEnd,
    source: opts.source,
  });
}

/** Remove a specific buff by itemId from a player. Returns true if found and removed. */
export function removeBuff(ctx: GameContext, pid: string, itemId: string): boolean {
  const { state } = ctx;
  const buffs = state.playerBuffs[pid];
  if (!buffs) return false;
  const idx = buffs.findIndex(b => b.itemId === itemId);
  if (idx === -1) return false;
  buffs.splice(idx, 1);
  if (buffs.length === 0) delete state.playerBuffs[pid];
  return true;
}

export function clearLevelBuffs(ctx: GameContext): void {
  const { state } = ctx;
  for (const pid of Object.keys(state.playerBuffs)) {
    state.playerBuffs[pid] = state.playerBuffs[pid].filter(b => !b.expiresAtPhaseEnd);
    if (state.playerBuffs[pid].length === 0) delete state.playerBuffs[pid];
  }
}

export function hasPlayerBuff(ctx: GameContext, pid: string, itemId: string): boolean {
  const buffs = ctx.state.playerBuffs[pid];
  if (!buffs) return false;
  return buffs.some(b => b.itemId === itemId);
}

export function hasAnyPlayerBuff(ctx: GameContext, itemId: string): boolean {
  for (const pid of Object.keys(ctx.state.playerBuffs)) {
    if (hasPlayerBuff(ctx, pid, itemId)) return true;
  }
  return false;
}

/** Kevlar Vest damage multiplier — scales by fraction of team that owns the buff.
 *  1 of 4 players → 12.5% reduction, 4 of 4 → full 50% reduction. */
export function getKevlarDamageMultiplier(ctx: GameContext): number {
  const playerIds = Object.keys(ctx.state.players);
  const totalPlayers = playerIds.length;
  if (totalPlayers === 0) return 1;
  const kevlarCount = playerIds.filter(pid => hasPlayerBuff(ctx, pid, 'kevlar-vest')).length;
  if (kevlarCount === 0) return 1;
  return 1 - (0.5 * kevlarCount / totalPlayers);
}
