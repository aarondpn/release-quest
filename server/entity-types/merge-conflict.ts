import { baseDescriptor, applyMagnetBias } from './base.ts';
import { getDifficultyConfig } from '../config.ts';
import { randomPosition, awardScore } from '../state.ts';
import { createTimerBag } from '../timer-bag.ts';
import * as game from '../game.ts';
import * as roles from '../roles.ts';
import * as powerups from '../powerups.ts';
import { getKevlarDamageMultiplier } from '../shop.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin, LevelConfigEntry } from '../types.ts';

export const MERGE_CONFLICT_MECHANICS = {
  resolveWindow: 1500,
  bonusPoints: 50,
  doubleDamage: true,
  escapeTimeMultiplier: 1.2,
  minPlayers: 2,
};

export const mergeConflictDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return {
      mergeConflict: bug.mergeConflict,
      mergePartner: bug.mergePartner,
      mergeSide: bug.mergeSide,
    };
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const partner = state.bugs[bug.mergePartner!];
    let damage = MERGE_CONFLICT_MECHANICS.doubleDamage ? diffConfig.hpDamage * 2 : diffConfig.hpDamage;
    damage = Math.ceil(damage * getKevlarDamageMultiplier(ctx));
    bug._timers.clearAll();
    delete state.bugs[bug.id];
    if (partner) {
      partner._timers.clearAll();
      delete state.bugs[partner.id];
    }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    ctx.events.emit({ type: 'merge-conflict-escaped', bugId: bug.id, partnerId: bug.mergePartner, hp: state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;
    const partner = state.bugs[bug.mergePartner!];

    // Same player can't resolve both sides — unless they're an Architect or in an elite encounter
    if (partner && partner.mergeClicked && partner.mergeClickedBy === pid) {
      if (!roles.hasRole(state, pid, 'architect') && !state.eliteConfig) return;
    }

    bug.mergeClicked = true;
    bug.mergeClickedBy = pid;
    bug.mergeClickedAt = Date.now();

    if (partner && partner.mergeClicked && (Date.now() - partner.mergeClickedAt!) < MERGE_CONFLICT_MECHANICS.resolveWindow) {
      // Both clicked in time — resolve!
      bug._timers.clearAll();
      partner._timers.clearAll();
      delete state.bugs[bug.id];
      delete state.bugs[partner.id];

      const clickers = new Set([pid, partner.mergeClickedBy!]);
      // Debugger passive: +50% bonus points if any clicker is a Debugger
      const debuggerBonus = [...clickers].some(c => roles.hasRole(state, c, 'debugger')) ? 1.5 : 1;
      let bonusPoints = Math.round(MERGE_CONFLICT_MECHANICS.bonusPoints * debuggerBonus);
      if (powerups.isDuckBuffActive(ctx)) bonusPoints *= 2;
      for (const clickerId of clickers) {
        if (state.players[clickerId]) {
          awardScore(ctx, clickerId, bonusPoints);
          state.players[clickerId].bugsSquashed = (state.players[clickerId].bugsSquashed || 0) + 1;
          gameBugsSquashed.inc();
        }
      }

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'merge-conflict', by: [...clickers], activeBugs: Object.keys(state.bugs).length, score: state.score });
      }

      ctx.events.emit({
        type: 'merge-conflict-resolved',
        bugId: bug.id,
        partnerId: partner.id,
        clickers: [...clickers],
        score: state.score,
        players: Object.fromEntries(
          [...clickers].filter(c => state.players[c]).map(c => [c, state.players[c].score])
        ),
      });

      if (state.phase === 'boss') game.checkBossGameState(ctx);
      else game.checkGameState(ctx);
    } else {
      // Only one clicked — set timeout for reset
      ctx.events.emit({ type: 'merge-conflict-halfclick', bugId: bug.id });
      bug._timers.setTimeout('mergeReset', () => {
        if (state.bugs[bug.id]) {
          bug.mergeClicked = false;
          bug.mergeClickedBy = null;
          bug.mergeClickedAt = 0;
        }
      }, MERGE_CONFLICT_MECHANICS.resolveWindow);
    }
  },
};

function spawnMergeConflict(ctx: GameContext, cfg: LevelConfigEntry): void {
  const { state, counters } = ctx;
  const conflictId = 'conflict_' + (counters.nextConflictId++);
  const escapeTime = cfg.escapeTime * MERGE_CONFLICT_MECHANICS.escapeTimeMultiplier;
  const id1 = 'bug_' + (counters.nextBugId++);
  const id2 = 'bug_' + (counters.nextBugId++);

  state.bugsSpawned += 2;

  const pos1 = randomPosition();
  const pos2 = randomPosition();

  const bug1: BugEntity = {
    id: id1, x: pos1.x, y: pos1.y, _timers: createTimerBag(),
    mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };
  const bug2: BugEntity = {
    id: id2, x: pos2.x, y: pos2.y, _timers: createTimerBag(),
    mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
    mergeClicked: false, mergeClickedBy: null, mergeClickedAt: 0,
    escapeTime, escapeStartedAt: Date.now(),
  };

  state.bugs[id1] = bug1;
  state.bugs[id2] = bug2;

  ctx.events.emit({ type: 'bug-spawned', bug: {
    id: id1, x: bug1.x, y: bug1.y, mergeConflict: conflictId, mergePartner: id2, mergeSide: 'left',
  }});
  ctx.events.emit({ type: 'bug-spawned', bug: {
    id: id2, x: bug2.x, y: bug2.y, mergeConflict: conflictId, mergePartner: id1, mergeSide: 'right',
  }});

  bug1._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id1]) return;
    const np = randomPosition();
    applyMagnetBias(ctx, np, bug1.x, bug1.y);
    bug1.x = np.x; bug1.y = np.y;
    ctx.events.emit({ type: 'bug-wander', bugId: id1, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  bug2._timers.setInterval('wander', () => {
    if (state.phase !== 'playing' || !state.bugs[id2]) return;
    const np = randomPosition();
    applyMagnetBias(ctx, np, bug2.x, bug2.y);
    bug2.x = np.x; bug2.y = np.y;
    ctx.events.emit({ type: 'bug-wander', bugId: id2, x: np.x, y: np.y });
  }, escapeTime * 0.45);

  const escapeHandler = () => {
    if (!state.bugs[id1] && !state.bugs[id2]) return;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    let damage = MERGE_CONFLICT_MECHANICS.doubleDamage ? diffConfig.hpDamage * 2 : diffConfig.hpDamage;
    damage = Math.ceil(damage * getKevlarDamageMultiplier(ctx));
    if (state.bugs[id1]) { bug1._timers.clearAll(); delete state.bugs[id1]; }
    if (state.bugs[id2]) { bug2._timers.clearAll(); delete state.bugs[id2]; }
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: id1, type: 'merge-conflict', activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }
    ctx.events.emit({ type: 'merge-conflict-escaped', bugId: id1, partnerId: id2, hp: state.hp });
    game.checkGameState(ctx);
  };

  bug1._onEscape = escapeHandler;
  bug2._onEscape = escapeHandler;

  bug1._timers.setTimeout('escape', escapeHandler, escapeTime);
  bug2._sharedEscapeWith = id1;
}

export const mergeConflictPlugin: BugTypePlugin = {
  typeKey: 'mergeConflict',
  detect: (bug) => !!bug.mergeConflict,
  descriptor: mergeConflictDescriptor,
  escapeTimeMultiplier: MERGE_CONFLICT_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'multi',
    chanceKey: 'mergeConflictChance',
    trySpawn(ctx: GameContext, cfg: LevelConfigEntry): boolean {
      const playerCount = Object.keys(ctx.state.players).length;
      const minPlayers = roles.teamHasRole(ctx.state, 'architect') ? 1 : MERGE_CONFLICT_MECHANICS.minPlayers;
      if (playerCount < minPlayers) return false;
      if (Object.keys(ctx.state.bugs).length + 2 > cfg.maxOnScreen) return false;
      spawnMergeConflict(ctx, cfg);
      return true;
    },
  },
};
