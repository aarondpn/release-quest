import { baseDescriptor } from './base.ts';
import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import { getDifficultyConfig } from '../config.ts';
import { randomPosition, awardScore } from '../state.ts';
import { createTimerBag } from '../timer-bag.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import * as roles from '../roles.ts';
import { getKevlarDamageMultiplier } from '../shop.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin, LevelConfigEntry } from '../types.ts';

export const PIPELINE_BUG_MECHANICS = {
  minChainLength: 3,
  maxChainLength: 5,
  escapeTimeMultiplier: 2.0,
  pointsPerBug: 15,
  chainBonus: 40,
};

export const pipelineDescriptor: EntityDescriptor = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return {
      isPipeline: true,
      chainId: bug.chainId,
      chainIndex: bug.chainIndex,
      chainLength: bug.chainLength,
    };
  },

  // Pipeline bugs don't have individual wander — chain-level snake wander is managed separately
  createWander(_bug: BugEntity, _ctx: GameContext) {},

  onResume(bug: BugEntity, ctx: GameContext) {
    bug.isStunned = false;
    const remainingTime = bug.remainingEscapeTime!;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    // Only restart escape + chain wander on head bug (non-shared)
    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);

      // Restart chain wander
      const chain = ctx.state.pipelineChains[bug.chainId!];
      if (chain) {
        const pad = 40;
        const margin = 100;
        const snakeSpeed = 30;
        const snakeTickMs = 350;
        const { state } = ctx;
        const phaseCheck = state.phase;
        bug._timers.setInterval('chainWander', () => {
          if (state.phase !== phaseCheck || state.hammerStunActive) return;
          const ch = state.pipelineChains[bug.chainId!];
          if (!ch) { bug._timers.clear('chainWander'); return; }
          const alive = ch.bugIds.filter(bid => state.bugs[bid]);
          if (alive.length === 0) { bug._timers.clear('chainWander'); return; }
          const oldPos: Record<string, { x: number; y: number }> = {};
          for (const bid of alive) {
            const b = state.bugs[bid];
            oldPos[bid] = { x: b.x, y: b.y };
          }
          ch.snakeAngle += (Math.random() - 0.5) * 0.5;
          const head = state.bugs[alive[0]];
          if (head.x < margin || head.x > LOGICAL_W - margin ||
              head.y < margin || head.y > LOGICAL_H - margin) {
            const toCenter = Math.atan2(LOGICAL_H / 2 - head.y, LOGICAL_W / 2 - head.x);
            let diff = toCenter - ch.snakeAngle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            ch.snakeAngle += diff * 0.15;
          }
          head.x = Math.max(pad, Math.min(LOGICAL_W - pad, head.x + Math.cos(ch.snakeAngle) * snakeSpeed));
          head.y = Math.max(pad, Math.min(LOGICAL_H - pad, head.y + Math.sin(ch.snakeAngle) * snakeSpeed));
          for (let i = 1; i < alive.length; i++) {
            const b = state.bugs[alive[i]];
            b.x = oldPos[alive[i - 1]].x;
            b.y = oldPos[alive[i - 1]].y;
          }
          for (const bid of alive) {
            const b = state.bugs[bid];
            ctx.events.emit({ type: 'bug-wander', bugId: bid, x: b.x, y: b.y });
          }
        }, snakeTickMs);
      }
    }
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;
    const chain = state.pipelineChains[bug.chainId!];
    if (!chain) return;

    if (bug.chainIndex === chain.nextIndex) {
      // Correct order — squash
      delete state.bugs[bug.id];
      chain.nextIndex++;

      player.bugsSquashed = (player.bugsSquashed || 0) + 1;
      gameBugsSquashed.inc();
      let rawPoints = PIPELINE_BUG_MECHANICS.pointsPerBug;
      rawPoints *= roles.getSpecialBugMultiplier(state, pid);
      if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;
      const points = awardScore(ctx, pid, rawPoints);

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'pipeline', chainId: bug.chainId, chainIndex: bug.chainIndex, by: pid, score: state.score });
      }

      ctx.events.emit({
        type: 'pipeline-bug-squashed',
        bugId: bug.id, chainId: bug.chainId, chainIndex: bug.chainIndex,
        playerId: pid, playerColor: player.color,
        score: state.score, playerScore: player.score, points,
      });

      if (chain.nextIndex >= chain.length) {
        // Chain complete — bonus!
        let rawBonus = PIPELINE_BUG_MECHANICS.chainBonus;
        rawBonus *= roles.getSpecialBugMultiplier(state, pid);
        if (powerups.isDuckBuffActive(ctx)) rawBonus *= 2;
        const bonus = awardScore(ctx, pid, rawBonus);

        const hBug = state.bugs[chain.headBugId];
        if (hBug) hBug._timers.clearAll();
        bug._timers.clearAll();
        delete state.pipelineChains[bug.chainId!];

        if (ctx.matchLog) {
          ctx.matchLog.log('squash', { type: 'pipeline-chain-complete', chainId: bug.chainId, by: pid, score: state.score });
        }

        ctx.events.emit({
          type: 'pipeline-chain-resolved',
          chainId: bug.chainId,
          playerId: pid, playerColor: player.color,
          score: state.score, playerScore: player.score, bonus,
        });
      }

      if (state.phase === 'boss') game.checkBossGameState(ctx);
      else game.checkGameState(ctx);
    } else {
      // Wrong order — Architect gets one free reset per chain
      if (roles.hasRole(state, pid, 'architect')) {
        if (!chain.architectFreeResetsUsed) chain.architectFreeResetsUsed = {};
        if (!chain.architectFreeResetsUsed[pid]) {
          // Use the free reset: absorb this click without resetting
          chain.architectFreeResetsUsed[pid] = true;
          ctx.events.emit({
            type: 'pipeline-chain-reset',
            chainId: bug.chainId,
            positions: {},
            playerId: pid,
            architectAbsorbed: true,
          });
          return;
        }
      }

      // Reset chain
      const remaining = chain.bugIds.filter(bid => state.bugs[bid]);
      chain.nextIndex = Math.min(...remaining.map(bid => state.bugs[bid].chainIndex!));
      const startPos = randomPosition();
      const angle = Math.random() * Math.PI * 2;
      chain.snakeAngle = angle + Math.PI;
      const spacing = 40;
      const pad = 40;
      const newPositions: Record<string, { x: number; y: number }> = {};
      remaining.forEach((bid, i) => {
        const b = state.bugs[bid];
        b.x = Math.max(pad, Math.min(LOGICAL_W - pad, startPos.x + Math.cos(angle) * spacing * i));
        b.y = Math.max(pad, Math.min(LOGICAL_H - pad, startPos.y + Math.sin(angle) * spacing * i));
        newPositions[bid] = { x: b.x, y: b.y };
      });

      if (ctx.matchLog) {
        ctx.matchLog.log('pipeline-reset', { chainId: bug.chainId, by: pid, remaining: remaining.length });
      }

      ctx.events.emit({
        type: 'pipeline-chain-reset',
        chainId: bug.chainId,
        positions: newPositions,
        playerId: pid,
      });
    }
  },
};

function spawnPipelineChain(ctx: GameContext, cfg: LevelConfigEntry, chainLength: number): void {
  const { state, counters } = ctx;
  const chainId = 'chain_' + (counters.nextChainId++);
  const escapeTime = cfg.escapeTime * PIPELINE_BUG_MECHANICS.escapeTimeMultiplier;
  const pad = 40;

  state.bugsSpawned += chainLength;

  const startPos = randomPosition();
  const angle = Math.random() * Math.PI * 2;
  const spacing = 40;

  const bugIds: string[] = [];
  const chainBugs: BugEntity[] = [];
  for (let i = 0; i < chainLength; i++) {
    const id = 'bug_' + (counters.nextBugId++);
    const x = Math.max(pad, Math.min(LOGICAL_W - pad, startPos.x + Math.cos(angle) * spacing * i));
    const y = Math.max(pad, Math.min(LOGICAL_H - pad, startPos.y + Math.sin(angle) * spacing * i));
    const bug: BugEntity = {
      id, x, y, _timers: createTimerBag(),
      isPipeline: true, chainId, chainIndex: i, chainLength,
      escapeTime, escapeStartedAt: Date.now(),
    };
    state.bugs[id] = bug;
    bugIds.push(id);
    chainBugs.push(bug);
  }

  const snakeSpeed = 30;
  const snakeTickMs = 350;
  let snakeAngle = angle + Math.PI;
  const margin = 100;

  const headBug = chainBugs[0];
  headBug._timers.setInterval('chainWander', () => {
    if (state.phase !== 'playing' || state.hammerStunActive) return;
    const chain = state.pipelineChains[chainId];
    if (!chain) { headBug._timers.clear('chainWander'); return; }
    const alive = chain.bugIds.filter(bid => state.bugs[bid]);
    if (alive.length === 0) { headBug._timers.clear('chainWander'); return; }

    const oldPos: Record<string, { x: number; y: number }> = {};
    for (const bid of alive) {
      const b = state.bugs[bid];
      oldPos[bid] = { x: b.x, y: b.y };
    }

    chain.snakeAngle += (Math.random() - 0.5) * 0.5;

    const head = state.bugs[alive[0]];
    if (head.x < margin || head.x > LOGICAL_W - margin ||
        head.y < margin || head.y > LOGICAL_H - margin) {
      const toCenter = Math.atan2(LOGICAL_H / 2 - head.y, LOGICAL_W / 2 - head.x);
      let diff = toCenter - chain.snakeAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      chain.snakeAngle += diff * 0.15;
    }

    head.x = Math.max(pad, Math.min(LOGICAL_W - pad, head.x + Math.cos(chain.snakeAngle) * snakeSpeed));
    head.y = Math.max(pad, Math.min(LOGICAL_H - pad, head.y + Math.sin(chain.snakeAngle) * snakeSpeed));

    for (let i = 1; i < alive.length; i++) {
      const b = state.bugs[alive[i]];
      b.x = oldPos[alive[i - 1]].x;
      b.y = oldPos[alive[i - 1]].y;
    }

    for (const bid of alive) {
      const b = state.bugs[bid];
      ctx.events.emit({ type: 'bug-wander', bugId: bid, x: b.x, y: b.y });
    }
  }, snakeTickMs);

  state.pipelineChains[chainId] = {
    bugIds, nextIndex: 0, length: chainLength,
    headBugId: headBug.id,
    snakeAngle,
  };

  for (const bug of chainBugs) {
    ctx.events.emit({ type: 'bug-spawned', bug: {
      id: bug.id, x: bug.x, y: bug.y,
      isPipeline: true, chainId, chainIndex: bug.chainIndex, chainLength,
    }});
  }

  const escapeHandler = () => {
    const chain = state.pipelineChains[chainId];
    if (!chain) return;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    const hBug = state.bugs[chain.headBugId];
    if (hBug) hBug._timers.clear('chainWander');
    const remaining = bugIds.filter(bid => state.bugs[bid]);
    if (remaining.length === 0) return;
    let damage = diffConfig.hpDamage * remaining.length;
    damage = Math.ceil(damage * getKevlarDamageMultiplier(ctx));
    for (const bid of remaining) {
      if (state.bugs[bid]) {
        state.bugs[bid]._timers.clearAll();
        delete state.bugs[bid];
      }
    }
    delete state.pipelineChains[chainId];
    state.hp -= damage;
    if (state.hp < 0) state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { chainId, type: 'pipeline-chain', bugsLost: remaining.length, hp: state.hp });
    }
    ctx.events.emit({
      type: 'pipeline-chain-escaped', chainId, bugIds: remaining, hp: state.hp,
    });
    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  };

  for (const bug of chainBugs) {
    bug._onEscape = escapeHandler;
  }

  headBug._timers.setTimeout('escape', escapeHandler, escapeTime);
  for (const bug of chainBugs) {
    if (bug !== headBug) bug._sharedEscapeWith = headBug.id;
  }
}

export const pipelinePlugin: BugTypePlugin = {
  typeKey: 'pipeline',
  detect: (bug) => !!bug.isPipeline,
  descriptor: pipelineDescriptor,
  escapeTimeMultiplier: PIPELINE_BUG_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'multi',
    chanceKey: 'pipelineBugChance',
    startLevelKey: 'pipelineBugStartLevel',
    trySpawn(ctx: GameContext, cfg: LevelConfigEntry): boolean {
      const { state } = ctx;
      const minChain = PIPELINE_BUG_MECHANICS.minChainLength;
      if (Object.keys(state.bugs).length + minChain > cfg.maxOnScreen + minChain) return false;
      if (state.bugsSpawned + minChain > cfg.bugsTotal) return false;
      const maxLen = Math.min(PIPELINE_BUG_MECHANICS.maxChainLength, cfg.bugsTotal - state.bugsSpawned);
      if (maxLen < minChain) return false;
      const chainLength = minChain + Math.floor(Math.random() * (maxLen - minChain + 1));
      spawnPipelineChain(ctx, cfg, chainLength);
      return true;
    },
  },
};
