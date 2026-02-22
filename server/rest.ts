import { ROGUELIKE_CONFIG, REST_CONFIG, getDifficultyConfig } from './config.ts';
import * as roguelike from './roguelike.ts';
import logger from './logger.ts';
import type { GameContext } from './types.ts';

const REST_VOTE_TIMER_MS = ROGUELIKE_CONFIG.voteTimerMs;

export function showRest(ctx: GameContext): void {
  const { state } = ctx;

  state.restVotes = {};
  ctx.lifecycle.transition(state, 'resting');

  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;
  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);

  logger.info({ lobbyId: ctx.lobbyId, soloMode }, 'Rest node shown');

  ctx.events.emit({
    type: 'rest-start',
    restHpGain: REST_CONFIG.hpGain,
    trainScoreBonus: REST_CONFIG.trainScoreBonus,
    currentHp: state.hp,
    maxHp: diffConfig.startingHp,
    currentScoreMultiplier: state.persistentScoreMultiplier ?? 1,
    soloMode,
  });

  if (!soloMode) {
    state.voteDeadline = Date.now() + REST_VOTE_TIMER_MS;
    ctx.timers.lobby.setTimeout('restVoteTimer', () => {
      resolveRestVote(ctx);
    }, REST_VOTE_TIMER_MS);
  }
}

export function handleRestVote(ctx: GameContext, pid: string, option: string): void {
  const { state } = ctx;
  if (state.phase !== 'resting') return;
  if (option !== 'rest' && option !== 'train') return;

  if (!state.restVotes) state.restVotes = {};
  state.restVotes[pid] = option;

  const playerCount = Object.keys(state.players).length;
  const soloMode = playerCount <= 1;

  if (soloMode) {
    resolveRestVote(ctx);
    return;
  }

  const timeRemaining = state.voteDeadline ? Math.max(0, state.voteDeadline - Date.now()) : 0;
  ctx.events.emit({
    type: 'rest-vote-update',
    votes: state.restVotes,
    timeRemaining,
  });

  // Check if all players voted
  const votedCount = Object.keys(state.restVotes).length;
  if (votedCount >= playerCount) {
    resolveRestVote(ctx);
  }
}

function resolveRestVote(ctx: GameContext): void {
  const { state } = ctx;
  ctx.timers.lobby.clear('restVoteTimer');

  if (!state.restVotes) return;

  // Count votes
  const voteCounts: Record<string, number> = { rest: 0, train: 0 };
  for (const opt of Object.values(state.restVotes)) {
    voteCounts[opt] = (voteCounts[opt] || 0) + 1;
  }

  // Majority wins; tie goes to 'rest' (healing)
  const chosenOption: 'rest' | 'train' = voteCounts.train > voteCounts.rest ? 'train' : 'rest';

  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);

  if (chosenOption === 'rest') {
    state.hp = Math.min(state.hp + REST_CONFIG.hpGain, diffConfig.startingHp);
  } else {
    state.persistentScoreMultiplier = (state.persistentScoreMultiplier ?? 1) + REST_CONFIG.trainScoreBonus;
  }

  logger.info({
    lobbyId: ctx.lobbyId,
    chosenOption,
    hp: state.hp,
    persistentScoreMultiplier: state.persistentScoreMultiplier,
  }, 'Rest resolved');

  ctx.events.emit({
    type: 'rest-resolved',
    chosenOption,
    hpAfter: state.hp,
    newScoreMultiplier: state.persistentScoreMultiplier ?? 1,
  });

  // Clear vote state
  state.restVotes = undefined;
  state.voteDeadline = undefined;

  // After delay, return to map
  ctx.timers.lobby.setTimeout('restComplete', () => {
    roguelike.handleNodeComplete(ctx);
  }, 2500);
}
