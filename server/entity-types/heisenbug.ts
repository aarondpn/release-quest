import { baseDescriptor } from './base.ts';
import { getDifficultyConfig } from '../config.ts';
import { randomPosition } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin } from '../types.ts';

export const HEISENBUG_MECHANICS = {
  fleeRadius: 100,
  fleeCooldown: 800,
  maxFlees: 2,
  escapeTimeMultiplier: 0.85,
  pointsMultiplier: 3,
};

export const heisenbugDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isHeisenbug: true, fleesRemaining: bug.fleesRemaining };
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
    let points = diffConfig.bugPoints * HEISENBUG_MECHANICS.pointsMultiplier;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;
    state.score += points;
    player.score += points;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id, type: 'heisenbug', by: pid,
        activeBugs: Object.keys(state.bugs).length, score: state.score,
      });
    }

    ctx.events.emit({
      type: 'bug-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      score: state.score,
      playerScore: player.score,
      isHeisenbug: true,
      isMemoryLeak: false,
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },

  onCursorNear(bug: BugEntity, ctx: GameContext, _pid: string, x: number, y: number) {
    if (!bug.isHeisenbug || bug.fleesRemaining! <= 0) return;
    const now = Date.now();
    if (now - bug.lastFleeTime! < HEISENBUG_MECHANICS.fleeCooldown) return;

    const dx = bug.x - x;
    const dy = bug.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= HEISENBUG_MECHANICS.fleeRadius) return;

    const newPos = randomPosition();
    bug.x = newPos.x;
    bug.y = newPos.y;
    bug.fleesRemaining!--;
    bug.lastFleeTime = now;

    // Reset wander timer so bug stays put at new position briefly
    bug._timers.setInterval('wander', () => {
      if (!ctx.state.bugs[bug.id]) return;
      const wp = randomPosition();
      bug.x = wp.x;
      bug.y = wp.y;
      ctx.events.emit({ type: 'bug-wander', bugId: bug.id, x: wp.x, y: wp.y });
    }, bug.escapeTime * 0.45);

    ctx.events.emit({
      type: 'bug-flee',
      bugId: bug.id,
      x: newPos.x,
      y: newPos.y,
      fleesRemaining: bug.fleesRemaining,
    });
  },
};

export const heisenbugPlugin: BugTypePlugin = {
  typeKey: 'heisenbug',
  detect: (bug) => !!bug.isHeisenbug,
  descriptor: heisenbugDescriptor,
  escapeTimeMultiplier: HEISENBUG_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'single',
    chanceKey: 'heisenbugChance',
    createVariant: () => ({ isHeisenbug: true, fleesRemaining: HEISENBUG_MECHANICS.maxFlees, lastFleeTime: 0 }),
  },
};
