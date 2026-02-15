import { baseDescriptor } from './base.ts';
import { PIPELINE_BUG_MECHANICS, LOGICAL_W, LOGICAL_H } from '../config.ts';
import { randomPosition } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor } from '../types.ts';

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
      let points = PIPELINE_BUG_MECHANICS.pointsPerBug;
      if (powerups.isDuckBuffActive(ctx)) points *= 2;
      state.score += points;
      player.score += points;

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
        let bonus = PIPELINE_BUG_MECHANICS.chainBonus;
        if (powerups.isDuckBuffActive(ctx)) bonus *= 2;
        state.score += bonus;
        player.score += bonus;

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
      // Wrong order — reset chain
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
