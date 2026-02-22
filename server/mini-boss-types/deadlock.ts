import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const POSITIONS = [
  { x: LOGICAL_W / 2, y: LOGICAL_H * 0.2 },    // top
  { x: LOGICAL_W * 0.8, y: LOGICAL_H / 2 },     // right
  { x: LOGICAL_W / 2, y: LOGICAL_H * 0.8 },     // bottom
  { x: LOGICAL_W * 0.2, y: LOGICAL_H / 2 },     // left
];

const ENTITY_IDS = ['mb_lock_0', 'mb_lock_1', 'mb_lock_2', 'mb_lock_3'];

export const deadlockPlugin: MiniBossPlugin = {
  typeKey: 'deadlock',
  displayName: 'Deadlock',
  icon: '\u{1F512}',
  description: 'Break the deadlock! Click the locks in the correct order.',
  timeLimit: 30,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    // Random starting direction (CW or CCW)
    const clockwise = Math.random() < 0.5;
    const order = clockwise ? [0, 1, 2, 3] : [0, 3, 2, 1];
    ctx.state.miniBoss!.data = {
      order,
      currentIndex: 0,
      clockwise,
      cursorFrozenUntil: 0,
    };

    return ENTITY_IDS.map((id, i) => ({
      id,
      x: POSITIONS[i].x,
      y: POSITIONS[i].y,
      hp: 1,
      maxHp: 1,
    }));
  },

  onClick(ctx: GameContext, _pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as { order: number[]; currentIndex: number; cursorFrozenUntil: number };
    const now = Date.now();

    // Check if cursor is frozen
    if (data.cursorFrozenUntil && now < data.cursorFrozenUntil) {
      return;
    }

    const entityIndex = ENTITY_IDS.indexOf(entityId);
    if (entityIndex === -1) return;

    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity || entity.hp <= 0) return;

    const expectedIndex = data.order[data.currentIndex];

    if (entityIndex === expectedIndex) {
      // Correct! Eliminate this lock
      entity.hp = 0;
      data.currentIndex++;
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
      });
    } else {
      // Wrong! Freeze cursor for 1s
      data.cursorFrozenUntil = now + 1000;
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'Wrong order! Cursor frozen for 1s!',
      });
    }
  },

  onTick(_ctx: GameContext): void {
    // No special tick behavior
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    return mb.entities.every(e => e.hp <= 0);
  },
};
