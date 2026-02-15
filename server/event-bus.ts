export type GameEventListener = (msg: Record<string, unknown>) => void;

export interface GameEventBus {
  emit(msg: Record<string, unknown>): void;
  on(listener: GameEventListener): () => void;
}

export function createEventBus(): GameEventBus {
  const listeners = new Set<GameEventListener>();
  return {
    emit(msg) {
      for (const listener of listeners) {
        listener(msg);
      }
    },
    on(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
