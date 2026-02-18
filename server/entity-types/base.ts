import { getDifficultyConfig } from '../config.ts';
import { randomPosition, awardScore } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { hasAnyPlayerBuff } from '../shop.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

/**
 * Apply bug-magnet bias: pull the wander target from the bug's current position
 * toward a player who has the buff.
 * Without magnet: bug teleports to a random position (normal wander).
 * With magnet: bug drifts from its current spot toward the cursor, with some randomness.
 */
export function applyMagnetBias(ctx: GameContext, pos: { x: number; y: number }, bugX: number, bugY: number): void {
  const { state } = ctx;
  if (!hasAnyPlayerBuff(ctx, 'bug-magnet')) return;
  for (const pid of Object.keys(state.playerBuffs)) {
    if (state.playerBuffs[pid]?.some(b => b.itemId === 'bug-magnet')) {
      const player = state.players[pid];
      if (player) {
        // Pull from the bug's current position toward the cursor (60% of the way)
        const pullX = bugX + (player.x - bugX) * 0.6;
        const pullY = bugY + (player.y - bugY) * 0.6;
        // 75% pull toward cursor, 25% random to keep some unpredictability
        pos.x = pullX * 0.75 + pos.x * 0.25;
        pos.y = pullY * 0.75 + pos.y * 0.25;
        break;
      }
    }
  }
}

// ── Base descriptor — shared defaults for all entity types ──

export const baseDescriptor: EntityDescriptor = {
  init(_bug: BugEntity, _ctx: GameContext, _opts: { phaseCheck: string }) {},

  broadcastFields(_bug: BugEntity) { return {}; },

  setupTimers(_bug: BugEntity, _ctx: GameContext) {},

  createWander(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      const newPos = randomPosition();
      applyMagnetBias(ctx, newPos, bug.x, bug.y);
      bug.x = newPos.x;
      bug.y = newPos.y;
      ctx.events.emit({ type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
    }, bug.escapeTime * 0.45);
  },

  onStun(bug: BugEntity, _ctx: GameContext) {
    bug.isStunned = true;
    bug.remainingEscapeTime = Math.max(0, bug.escapeTime - (Date.now() - bug.escapeStartedAt));
    bug._timers.clearAll();
  },

  onResume(this: EntityDescriptor, bug: BugEntity, ctx: GameContext) {
    bug.isStunned = false;
    const remainingTime = bug.remainingEscapeTime!;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    // Restart escape timer (only on the owner bug, not shared-escape followers)
    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);
    }

    if (remainingTime > 0) {
      this.createWander(bug, ctx);
      this.setupTimers(bug, ctx);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const diffConfig = getDifficultyConfig(ctx.state.difficulty);
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];
    let damage = diffConfig.hpDamage;
    if (hasAnyPlayerBuff(ctx, 'kevlar-vest')) damage = Math.ceil(damage * 0.5);
    ctx.state.hp -= damage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }
    ctx.events.emit({ type: 'bug-escaped', bugId: bug.id, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const player = state.players[pid];
    if (!player) return;

    bug._timers.clearAll();
    delete state.bugs[bug.id];

    player.bugsSquashed = (player.bugsSquashed || 0) + 1;
    gameBugsSquashed.inc();
    let rawPoints = diffConfig.bugPoints;
    if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;
    const points = awardScore(ctx, pid, rawPoints);

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id,
        type: bug.isMinion ? 'minion' : 'normal',
        by: pid,
        activeBugs: Object.keys(state.bugs).length,
        score: state.score,
      });
    }

    ctx.events.emit({
      type: 'bug-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      score: state.score,
      playerScore: player.score,
      isHeisenbug: false,
      isMemoryLeak: false,
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};
