import { LOGICAL_W, LOGICAL_H, MAX_LEVEL, getDifficultyConfig } from './config.ts';
import { getDescriptor } from './entity-types/index.ts';
import { getActivePlugin } from './boss.ts';
import type { GameState, GameContext, GameCounters, LevelConfigEntry, PlayerScoreEntry, DifficultyConfig, CustomDifficultyConfig } from './types.ts';

export function createGameState(difficulty: string = 'medium', customConfig?: CustomDifficultyConfig): GameState {
  const diffConfig = getDifficultyConfig(difficulty, customConfig);
  return {
    phase: 'lobby',
    score: 0,
    hp: diffConfig.startingHp,
    level: 1,
    bugsRemaining: 0,
    bugsSpawned: 0,
    bugs: {},
    players: {},
    boss: null,
    rubberDuck: null,
    duckBuff: null,
    hotfixHammer: null,
    hammerStunActive: false,
    pipelineChains: {},
    playerBuffs: {},
    difficulty,
    customConfig,
  };
}

export function createCounters(): GameCounters {
  return {
    nextBugId: 1,
    nextPlayerId: 1,
    colorIndex: 0,
    nextDuckId: 1,
    nextConflictId: 1,
    nextChainId: 1,
    nextHammerId: 1,
  };
}

export function randomPosition(): { x: number; y: number } {
  const pad = 40;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

export function currentLevelConfig(state: GameState): LevelConfigEntry {
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  const base = diffConfig.levels[state.level] || diffConfig.levels[MAX_LEVEL];
  const extra = Math.max(0, Object.keys(state.players).length - 1);
  if (extra === 0) return base;
  return {
    bugsTotal: base.bugsTotal + extra * 3,
    escapeTime: base.escapeTime,
    spawnRate: Math.max(800, base.spawnRate - extra * 50),
    maxOnScreen: base.maxOnScreen,
  };
}

/** Apply the difficulty score multiplier to raw points. */
export function calcScore(state: GameState, rawPoints: number): number {
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  return Math.round(rawPoints * diffConfig.scoreMultiplier);
}

/** Award points to a player and the team total, with the difficulty multiplier applied. Returns the final point value. */
export function awardScore(ctx: GameContext, pid: string, rawPoints: number): number {
  const points = calcScore(ctx.state, rawPoints);
  ctx.state.score += points;
  const player = ctx.state.players[pid];
  if (player) player.score += points;
  return points;
}

export function getPlayerScores(state: GameState): PlayerScoreEntry[] {
  return Object.values(state.players).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    score: p.score,
    bugsSquashed: p.bugsSquashed,
    isGuest: p.isGuest,
  }));
}

export function getStateSnapshot(state: GameState): Record<string, unknown> {
  return {
    phase: state.phase,
    score: state.score,
    hp: state.hp,
    level: state.level,
    bugsRemaining: currentLevelConfig(state).bugsTotal - state.bugsSpawned + Object.keys(state.bugs).length,
    bugs: Object.values(state.bugs).map(b => ({
      id: b.id, x: b.x, y: b.y,
      ...getDescriptor(b).broadcastFields(b),
    })),
    rubberDuck: state.rubberDuck ? { id: state.rubberDuck.id, x: state.rubberDuck.x, y: state.rubberDuck.y } : null,
    duckBuff: state.duckBuff ? { expiresAt: state.duckBuff.expiresAt } : null,
    hotfixHammer: state.hotfixHammer ? { id: state.hotfixHammer.id, x: state.hotfixHammer.x, y: state.hotfixHammer.y } : null,
    players: getPlayerScores(state),
    hasCustomSettings: !!(state.customConfig && Object.keys(state.customConfig).length > 0),
    boss: state.boss ? {
      hp: state.boss.hp,
      maxHp: state.boss.maxHp,
      x: state.boss.x,
      y: state.boss.y,
      timeRemaining: state.boss.timeRemaining,
      ...(getActivePlugin()?.broadcastFields({ state } as any) || {}),
    } : null,
  };
}
