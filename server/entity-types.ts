import { getDifficultyConfig, HEISENBUG_MECHANICS, CODE_REVIEW_MECHANICS, MERGE_CONFLICT_MECHANICS, PIPELINE_BUG_MECHANICS, MEMORY_LEAK_MECHANICS, INFINITE_LOOP_MECHANICS, LOGICAL_W, LOGICAL_H } from './config.ts';
import { randomPosition } from './state.ts';
import * as network from './network.ts';
import * as game from './game.ts';
import * as powerups from './powerups.ts';
import type { BugEntity, GameContext, EntityDescriptor } from './types.ts';

// ── Base descriptor — shared defaults for all entity types ──

const baseDescriptor: EntityDescriptor = {
  init(_bug: BugEntity, _ctx: GameContext, _opts: { phaseCheck: string }) {},

  broadcastFields(_bug: BugEntity) { return {}; },

  setupTimers(_bug: BugEntity, _ctx: GameContext) {},

  createWander(bug: BugEntity, ctx: GameContext) {
    const { lobbyId, state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      const newPos = randomPosition();
      bug.x = newPos.x;
      bug.y = newPos.y;
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
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
    ctx.state.hp -= diffConfig.hpDamage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'bug-escaped', bugId: bug.id, hp: ctx.state.hp });
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
    let points = diffConfig.bugPoints;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;
    state.score += points;
    player.score += points;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id,
        type: bug.isMinion ? 'minion' : 'normal',
        by: pid,
        activeBugs: Object.keys(state.bugs).length,
        score: state.score,
      });
    }

    network.broadcastToLobby(ctx.lobbyId, {
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

// ── Type-specific descriptors ──

const types: Record<string, EntityDescriptor> = {};

types.normal = { ...baseDescriptor };

types.minion = { ...baseDescriptor };

types.heisenbug = {
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

    network.broadcastToLobby(ctx.lobbyId, {
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
      network.broadcastToLobby(ctx.lobbyId, { type: 'bug-wander', bugId: bug.id, x: wp.x, y: wp.y });
    }, bug.escapeTime * 0.45);

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'bug-flee',
      bugId: bug.id,
      x: newPos.x,
      y: newPos.y,
      fleesRemaining: bug.fleesRemaining,
    });
  },
};

types.feature = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isFeature: true };
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'feature', activeBugs: Object.keys(ctx.state.bugs).length });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'feature-escaped', bugId: bug.id });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    bug._timers.clearAll();
    delete state.bugs[bug.id];

    state.hp -= CODE_REVIEW_MECHANICS.hpPenalty;
    if (state.hp < 0) state.hp = 0;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', { bugId: bug.id, type: 'feature', by: pid, activeBugs: Object.keys(state.bugs).length, hp: state.hp });
    }

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'feature-squashed',
      bugId: bug.id,
      playerId: pid,
      playerColor: player.color,
      hp: state.hp,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};

types.memoryLeak = {
  ...baseDescriptor,
  broadcastFields(bug: BugEntity) {
    return { isMemoryLeak: true, growthStage: bug.growthStage };
  },

  createWander(bug: BugEntity, ctx: GameContext) {
    const { lobbyId, state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('wander', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      // Don't move while players are actively defusing
      if (bug.holders && bug.holders.size > 0) return;
      const newPos = randomPosition();
      bug.x = newPos.x;
      bug.y = newPos.y;
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: newPos.x, y: newPos.y });
    }, bug.escapeTime * 0.45);
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
      const { lobbyId, state } = ctx;
      bug._timers.setInterval('growth', () => {
        if (!state.bugs[bug.id]) return;
        if (bug.growthStage! < MEMORY_LEAK_MECHANICS.maxGrowthStage) {
          bug.growthStage!++;
          network.broadcastToLobby(lobbyId, { type: 'memory-leak-grow', bugId: bug.id, growthStage: bug.growthStage });
        }
      }, MEMORY_LEAK_MECHANICS.growthInterval);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    const diffConfig = getDifficultyConfig(ctx.state.difficulty);
    bug._timers.clearAll();
    const damage = MEMORY_LEAK_MECHANICS.damageByStage[bug.growthStage!] || diffConfig.hpDamage;
    delete ctx.state.bugs[bug.id];
    ctx.state.hp -= damage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;
    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'memory-leak', growthStage: bug.growthStage, damage, activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }
    network.broadcastToLobby(ctx.lobbyId, { type: 'memory-leak-escaped', bugId: bug.id, growthStage: bug.growthStage, damage, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(_bug: BugEntity, _ctx: GameContext, _pid: string, _msg: any) {
    // Memory leak uses hold mechanic — regular clicks are ignored
    return;
  },

  onHoldStart(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string) {
    const { state } = ctx;

    // Initialize holders tracking if needed
    if (!bug.holders) {
      bug.holders = new Map();
      bug.holdStartStage = bug.growthStage;
      bug.firstHolderStartTime = Date.now();
    }

    // Add this player to holders
    if (!bug.holders.has(pid)) {
      bug.holders.set(pid, Date.now());

      const elapsedSinceFirst = Date.now() - bug.firstHolderStartTime!;
      const requiredTime = MEMORY_LEAK_MECHANICS.holdTimeByStage[bug.holdStartStage!];
      const effectiveRequiredTime = requiredTime / bug.holders.size;

      network.broadcastToLobby(ctx.lobbyId, {
        type: 'memory-leak-hold-update',
        bugId: bug.id,
        playerId: pid,
        holderCount: bug.holders.size,
        requiredHoldTime: requiredTime,
        elapsedTime: elapsedSinceFirst,
      });

      const remainingTime = Math.max(0, effectiveRequiredTime - elapsedSinceFirst);
      bug._timers.setTimeout('completion', () => {
        this._completeHold!(bug, ctx);
      }, remainingTime);
    }
  },

  onHoldComplete(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    if (!bug.holders || !bug.holders.has(pid)) return;

    const requiredTime = MEMORY_LEAK_MECHANICS.holdTimeByStage[bug.holdStartStage!];
    const elapsedSinceFirst = Date.now() - bug.firstHolderStartTime!;

    bug.holders.delete(pid);

    // If no holders left, reset completely
    if (bug.holders.size === 0) {
      bug._timers.clear('completion');
      delete bug.holders;
      delete bug.holdStartStage;
      delete bug.firstHolderStartTime;

      network.broadcastToLobby(ctx.lobbyId, {
        type: 'memory-leak-hold-update',
        bugId: bug.id,
        playerId: pid,
        holderCount: 0,
        requiredHoldTime: requiredTime,
        elapsedTime: elapsedSinceFirst,
        dropOut: true,
      });
      return;
    }

    // Recalculate completion timer with new holder count
    const newEffectiveTime = requiredTime / bug.holders.size;
    const remainingTime = Math.max(0, newEffectiveTime - elapsedSinceFirst);

    bug._timers.setTimeout('completion', () => {
      this._completeHold!(bug, ctx);
    }, remainingTime);

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'memory-leak-hold-update',
      bugId: bug.id,
      playerId: pid,
      holderCount: bug.holders.size,
      requiredHoldTime: requiredTime,
      elapsedTime: elapsedSinceFirst,
      dropOut: true,
    });
  },

  _completeHold(bug: BugEntity, ctx: GameContext) {
    const { state } = ctx;
    const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
    if (!state.bugs[bug.id] || !bug.holders || bug.holders.size === 0) return;

    bug._timers.clearAll();

    const allHolders = Array.from(bug.holders.keys());
    const holderCount = allHolders.length;
    delete state.bugs[bug.id];

    let points = MEMORY_LEAK_MECHANICS.pointsByStage[bug.holdStartStage!] || diffConfig.bugPoints;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;

    for (const holderId of allHolders) {
      if (state.players[holderId]) {
        state.players[holderId].bugsSquashed = (state.players[holderId].bugsSquashed || 0) + 1;
        state.players[holderId].score += points;
        state.score += points;
      }
    }

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id,
        type: 'memory-leak',
        by: allHolders,
        growthStage: bug.holdStartStage,
        holderCount,
        activeBugs: Object.keys(state.bugs).length,
        score: state.score,
      });
    }

    network.broadcastToLobby(ctx.lobbyId, {
      type: 'memory-leak-cleared',
      bugId: bug.id,
      holders: allHolders,
      holderCount,
      score: state.score,
      players: Object.fromEntries(
        allHolders.filter(h => state.players[h]).map(h => [h, state.players[h].score])
      ),
      points,
    });

    if (state.phase === 'boss') game.checkBossGameState(ctx);
    else game.checkGameState(ctx);
  },
};

types.mergeConflict = {
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
    const damage = MERGE_CONFLICT_MECHANICS.doubleDamage ? diffConfig.hpDamage * 2 : diffConfig.hpDamage;
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
    network.broadcastToLobby(ctx.lobbyId, { type: 'merge-conflict-escaped', bugId: bug.id, partnerId: bug.mergePartner, hp: state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;
    const partner = state.bugs[bug.mergePartner!];

    // Same player can't resolve both sides
    if (partner && partner.mergeClicked && partner.mergeClickedBy === pid) return;

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
      for (const clickerId of clickers) {
        if (state.players[clickerId]) {
          state.players[clickerId].score += MERGE_CONFLICT_MECHANICS.bonusPoints;
          state.score += MERGE_CONFLICT_MECHANICS.bonusPoints;
          state.players[clickerId].bugsSquashed = (state.players[clickerId].bugsSquashed || 0) + 1;
        }
      }

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'merge-conflict', by: [...clickers], activeBugs: Object.keys(state.bugs).length, score: state.score });
      }

      network.broadcastToLobby(ctx.lobbyId, {
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
      network.broadcastToLobby(ctx.lobbyId, { type: 'merge-conflict-halfclick', bugId: bug.id });
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

types.pipeline = {
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
        const { lobbyId, state } = ctx;
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
            network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId: bid, x: b.x, y: b.y });
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
      let points = PIPELINE_BUG_MECHANICS.pointsPerBug;
      if (powerups.isDuckBuffActive(ctx)) points *= 2;
      state.score += points;
      player.score += points;

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'pipeline', chainId: bug.chainId, chainIndex: bug.chainIndex, by: pid, score: state.score });
      }

      network.broadcastToLobby(ctx.lobbyId, {
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

        network.broadcastToLobby(ctx.lobbyId, {
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

      network.broadcastToLobby(ctx.lobbyId, {
        type: 'pipeline-chain-reset',
        chainId: bug.chainId,
        positions: newPositions,
        playerId: pid,
      });
    }
  },
};

types.infiniteLoop = {
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
    const { lobbyId, state } = ctx;
    const bugId = bug.id;
    bug._timers.setInterval('loopTick', () => {
      if (!state.bugs[bugId] || state.hammerStunActive) return;
      bug.loopAngle = (bug.loopAngle! + bug.loopSpeed!) % (2 * Math.PI);
      bug.x = bug.loopCenterX! + Math.cos(bug.loopAngle) * bug.loopRadiusX!;
      bug.y = bug.loopCenterY! + Math.sin(bug.loopAngle) * bug.loopRadiusY!;
      network.broadcastToLobby(lobbyId, { type: 'bug-wander', bugId, x: bug.x, y: bug.y });
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

// ── Type detection ──

function getType(bug: BugEntity): string {
  if (bug.isInfiniteLoop) return 'infiniteLoop';
  if (bug.isPipeline) return 'pipeline';
  if (bug.mergeConflict) return 'mergeConflict';
  if (bug.isMemoryLeak) return 'memoryLeak';
  if (bug.isHeisenbug) return 'heisenbug';
  if (bug.isFeature) return 'feature';
  if (bug.isMinion) return 'minion';
  return 'normal';
}

export function getDescriptor(bug: BugEntity): EntityDescriptor {
  return types[getType(bug)];
}

export function handleBreakpointClick(bug: BugEntity, ctx: GameContext, pid: string): void {
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
    let points = INFINITE_LOOP_MECHANICS.points;
    if (powerups.isDuckBuffActive(ctx)) points *= 2;
    state.score += points;
    player.score += points;

    if (ctx.matchLog) {
      ctx.matchLog.log('squash', {
        bugId: bug.id, type: 'infinite-loop', by: pid,
        activeBugs: Object.keys(state.bugs).length, score: state.score,
      });
    }

    network.broadcastToLobby(ctx.lobbyId, {
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
    network.broadcastToLobby(ctx.lobbyId, {
      type: 'infinite-loop-miss',
      bugId: bug.id,
      playerId: pid,
    });
  }
}

export { types, getType };
