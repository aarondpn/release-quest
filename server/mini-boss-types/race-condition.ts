import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

export const raceConditionPlugin: MiniBossPlugin = {
  typeKey: 'race-condition',
  displayName: 'Race Condition',
  icon: '\u{1F3CE}\uFE0F',
  description: 'Drain both threads evenly! If one gets too far ahead, the other heals.',
  timeLimit: 45,
  defeatPenalty: 15,

  init(_ctx: GameContext): MiniBossEntity[] {
    return [
      { id: 'mb_thread_a', x: LOGICAL_W * 0.25, y: LOGICAL_H / 2, hp: 10, maxHp: 10 },
      { id: 'mb_thread_b', x: LOGICAL_W * 0.75, y: LOGICAL_H / 2, hp: 10, maxHp: 10 },
    ];
  },

  onClick(ctx: GameContext, _pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity || entity.hp <= 0) return;

    entity.hp--;
    ctx.events.emit({
      type: 'mini-boss-entity-update',
      entities: mb.entities,
    });
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const a = mb.entities.find(e => e.id === 'mb_thread_a');
    const b = mb.entities.find(e => e.id === 'mb_thread_b');
    if (!a || !b) return;

    // If HP difference > 20% of maxHp, weaker heals by 2 (not to full)
    const maxHp = a.maxHp;
    const threshold = maxHp * 0.2;
    const diff = Math.abs(a.hp - b.hp);

    if (diff > threshold && a.hp > 0 && b.hp > 0) {
      const weaker = a.hp > b.hp ? b : a;
      weaker.hp = Math.min(weaker.hp + 2, weaker.maxHp);
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'Imbalance detected! Thread healed back to full!',
      });
    }
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    return mb.entities.every(e => e.hp <= 0);
  },
};
