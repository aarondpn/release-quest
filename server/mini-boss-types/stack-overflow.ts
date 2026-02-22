import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const MAX_CLONES = 12;

function randomPos(): { x: number; y: number } {
  const pad = 60;
  return {
    x: pad + Math.random() * (LOGICAL_W - pad * 2),
    y: pad + Math.random() * (LOGICAL_H - pad * 2),
  };
}

export const stackOverflowPlugin: MiniBossPlugin = {
  typeKey: 'stack-overflow',
  displayName: 'Stack Overflow',
  icon: '\u{1F4DA}',
  description: 'Find and destroy the original! Clicking clones spawns more.',
  timeLimit: 30,
  defeatPenalty: 20,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    mb.data._nextEntityId = 2;
    return [{
      id: 'mb_1',
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      hp: 5,
      maxHp: 5,
      isOriginal: true,
    }];
  },

  onClick(ctx: GameContext, _pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const entity = mb.entities.find(e => e.id === entityId);
    if (!entity) return;

    if (entity.isOriginal) {
      entity.hp--;
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
      });
    } else {
      // Clicking a clone: spawn 2 more clones (up to cap)
      const cloneCount = mb.entities.filter(e => !e.isOriginal).length;
      if (cloneCount < MAX_CLONES) {
        const nextId = (mb.data._nextEntityId as number) || 100;
        const toSpawn = Math.min(2, MAX_CLONES - cloneCount);
        const pos1 = randomPos();
        const newEntities: MiniBossEntity[] = [
          { id: 'mb_' + nextId, x: pos1.x, y: pos1.y, hp: 1, maxHp: 1, spawnedAt: Date.now() },
        ];
        if (toSpawn > 1) {
          const pos2 = randomPos();
          newEntities.push({ id: 'mb_' + (nextId + 1), x: pos2.x, y: pos2.y, hp: 1, maxHp: 1, spawnedAt: Date.now() });
        }
        mb.data._nextEntityId = nextId + toSpawn;
        mb.entities.push(...newEntities);
      }
      // Shuffle all entity positions to make it harder to track
      for (const e of mb.entities) {
        const np = randomPos();
        e.x = np.x;
        e.y = np.y;
      }
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'Wrong one! More clones appeared!',
      });
    }
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    // Remove clones older than 2s
    const now = Date.now();
    const before = mb.entities.length;
    mb.entities = mb.entities.filter(e => e.isOriginal || !e.spawnedAt || (now - e.spawnedAt) < 2000);
    if (mb.entities.length !== before) {
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
      });
    }
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const original = mb.entities.find(e => e.isOriginal);
    return !original || original.hp <= 0;
  },
};
