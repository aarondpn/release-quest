import { baseDescriptor } from './base.ts';
import { LOGICAL_W, LOGICAL_H } from '../config.ts';
import { awardScore } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import { getCtxForPlayer } from '../helpers.ts';
import { z } from 'zod';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin } from '../types.ts';

export const INFINITE_LOOP_MECHANICS = {
  loopTickMs: 50,
  loopPeriodMs: 2800,
  radiusMin: 70,
  radiusMax: 130,
  hitWindowRadians: 0.45,
  points: 30,
  escapeTimeMultiplier: 1.8,
};

export const infiniteLoopDescriptor: EntityDescriptor = {
  ...baseDescriptor,

  init(bug: BugEntity, _ctx: GameContext, _opts: { phaseCheck: string }) {
    const { radiusMin, radiusMax, loopPeriodMs, loopTickMs } = INFINITE_LOOP_MECHANICS;
    // Generate eccentric ellipses: one axis 60-80% of the other for visual interest
    const major = radiusMin + Math.random() * (radiusMax - radiusMin);
    const eccentricity = 0.6 + Math.random() * 0.2;
    const minor = major * eccentricity;
    const rx = Math.random() > 0.5 ? major : minor;
    const ry = Math.random() > 0.5 ? major : minor;
    // Pick a center that keeps the ellipse within bounds
    const pad = 30;
    bug.loopCenterX = rx + pad + Math.random() * (LOGICAL_W - 2 * (rx + pad));
    bug.loopCenterY = ry + pad + Math.random() * (LOGICAL_H - 2 * (ry + pad));
    bug.loopRadiusX = rx;
    bug.loopRadiusY = ry;
    bug.loopAngle = Math.random() * 2 * Math.PI; // randomize starting position
    bug.loopSpeed = (2 * Math.PI) / (loopPeriodMs / loopTickMs); // radians per tick
    bug.breakpointAngle = Math.random() * 2 * Math.PI;
    // Set initial position on the ellipse
    bug.x = bug.loopCenterX + Math.cos(bug.loopAngle) * bug.loopRadiusX;
    bug.y = bug.loopCenterY + Math.sin(bug.loopAngle) * bug.loopRadiusY;
  },

  broadcastFields(bug: BugEntity) {
    return {
      isInfiniteLoop: true,
      loopCenterX: bug.loopCenterX,
      loopCenterY: bug.loopCenterY,
      loopRadiusX: bug.loopRadiusX,
      loopRadiusY: bug.loopRadiusY,
      breakpointAngle: bug.breakpointAngle,
      loopSpeed: bug.loopSpeed,
      loopTickMs: INFINITE_LOOP_MECHANICS.loopTickMs,
    };
  },

  createWander(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('loopTick', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      bug.loopAngle = (bug.loopAngle! + bug.loopSpeed!) % (2 * Math.PI);
      bug.x = bug.loopCenterX! + Math.cos(bug.loopAngle) * bug.loopRadiusX!;
      bug.y = bug.loopCenterY! + Math.sin(bug.loopAngle) * bug.loopRadiusY!;
      ctx.events.emit({ type: 'bug-wander', bugId, x: bug.x, y: bug.y });
    }, INFINITE_LOOP_MECHANICS.loopTickMs);
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

    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);
    }

    if (remainingTime > 0) {
      this.createWander(bug, ctx);
    }
  },

  onClick(_bug: BugEntity, _ctx: GameContext, _pid: string, _msg: any) {
    // Infinite loop bug is invulnerable to direct clicks — do nothing
    return;
  },
};

function handleBreakpointClick(bug: BugEntity, ctx: GameContext, pid: string): void {
  if (!bug.isInfiniteLoop) return;
  const { state } = ctx;
  const player = state.players[pid];
  if (!player) return;

  // Check if bug is near the breakpoint
  let angleDiff = Math.abs(bug.loopAngle! - bug.breakpointAngle!);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  if (angleDiff <= INFINITE_LOOP_MECHANICS.hitWindowRadians) {
    // Hit! Squash the bug
    bug._timers.clearAll();
    delete state.bugs[bug.id];

    player.bugsSquashed = (player.bugsSquashed || 0) + 1;
    gameBugsSquashed.inc();
    let rawPoints = INFINITE_LOOP_MECHANICS.points;
    if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;
    const points = awardScore(ctx, pid, rawPoints);

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id, type: 'infinite-loop', by: pid,
        activeBugs: Object.keys(state.bugs).length, score: state.score,
      });
    }

    ctx.events.emit({
      type: 'infinite-loop-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      score: state.score,
      playerScore: player.score,
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  } else {
    // Miss — visual feedback only, no penalty
    ctx.events.emit({
      type: 'infinite-loop-miss',
      bugId: bug.id,
      playerId: pid,
    });
  }
}

export const infiniteLoopPlugin: BugTypePlugin = {
  typeKey: 'infiniteLoop',
  detect: (bug) => !!bug.isInfiniteLoop,
  descriptor: infiniteLoopDescriptor,
  escapeTimeMultiplier: INFINITE_LOOP_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'single',
    chanceKey: 'infiniteLoopChance',
    startLevelKey: 'infiniteLoopStartLevel',
    createVariant: () => ({ isInfiniteLoop: true, loopAngle: 0 }),
  },
  schemas: {
    'click-breakpoint': z.object({
      type: z.literal('click-breakpoint'),
      bugId: z.string(),
    }),
  },
  handlers: {
    'click-breakpoint': ({ msg, pid, playerInfo }: any) => {
      const ctx = getCtxForPlayer(pid, playerInfo);
      if (!ctx) return;
      const { state: st } = ctx;
      if (st.phase !== 'playing' && st.phase !== 'boss') return;
      const bug = st.bugs[msg.bugId];
      if (!bug || !bug.isInfiniteLoop) return;
      handleBreakpointClick(bug, ctx, pid);
    },
  },
};
