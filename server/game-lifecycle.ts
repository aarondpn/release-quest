import type { GamePhase, GameState, GameLifecycle, CleanupHook } from './types.ts';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  lobby:    ['playing'],
  playing:  ['boss', 'gameover', 'lobby'],
  boss:     ['gameover', 'win', 'lobby'],
  gameover: ['playing', 'lobby'],
  win:      ['playing', 'lobby'],
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
      console.error(`[lifecycle] Invalid phase transition: ${state.phase} → ${to}`);
    }
    state.phase = to;
  }

  function teardown(): void {
    for (const hook of hooks) {
      try { hook(); } catch (err) {
        console.error('[lifecycle] Cleanup hook error:', err);
      }
    }
  }

  function destroy(): void {
    teardown();
    hooks.length = 0;
  }

  return { onCleanup, transition, teardown, destroy };
}
