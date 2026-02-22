import logger from './logger.ts';
import type { GamePhase, GameState, GameLifecycle, CleanupHook } from './types.ts';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  lobby:    ['playing', 'map_view'],
  playing:  ['shopping', 'boss', 'gameover', 'lobby', 'map_view'],
  shopping: ['playing', 'boss', 'lobby', 'map_view'],
  boss:     ['gameover', 'win', 'lobby'],
  gameover: ['playing', 'lobby'],
  win:      ['playing', 'lobby'],
  map_view: ['playing', 'shopping', 'boss', 'lobby', 'event', 'resting', 'mini_boss'],
  event:    ['map_view', 'gameover', 'lobby'],
  resting:  ['map_view', 'lobby'],
  mini_boss: ['map_view', 'gameover', 'lobby'],
};

export function createGameLifecycle(): GameLifecycle {
  const hooks: CleanupHook[] = [];

  function onCleanup(hook: CleanupHook): () => void {
    hooks.push(hook);
    return () => {
      const idx = hooks.indexOf(hook);
      if (idx >= 0) hooks.splice(idx, 1);
    };
  }

  function transition(state: GameState, to: GamePhase): void {
    const allowed = VALID_TRANSITIONS[state.phase];
    if (!allowed || !allowed.includes(to)) {
      logger.error({ from: state.phase, to }, 'Invalid phase transition');
      return;
    }
    state.phase = to;
  }

  function teardown(): void {
    for (const hook of hooks) {
      try { hook(); } catch (err) {
        logger.error({ err }, 'Cleanup hook error');
      }
    }
  }

  function destroy(): void {
    teardown();
    hooks.length = 0;
  }

  return { onCleanup, transition, teardown, destroy };
}
