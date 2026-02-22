import type { HandlerContext, MessageHandler } from './types.ts';
import type { DevCommandMsg } from '../../shared/messages.ts';
import { DEV_MODE, getDifficultyConfig } from '../config.ts';
import { getCtxForPlayer } from '../helpers.ts';
import { getMiniBossKeys } from '../mini-boss-types/index.ts';
import { ELITE_KEYS, startEliteDirect } from '../elite.ts';
import { startMiniBossDirect } from '../mini-boss.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import * as boss from '../boss.ts';
import * as bugs from '../bugs.ts';
import * as powerups from '../powerups.ts';
import logger from '../logger.ts';
import type { GameContext } from '../types.ts';

function sendDevError(ws: HandlerContext['ws'], message: string): void {
  network.send(ws, { type: 'dev-error', message });
}

function initPlayground(ctx: GameContext): void {
  const { state } = ctx;

  // Already in playground lobby — just clear timers
  if (state.playground && state.phase === 'lobby') {
    ctx.timers.lobby.clearAll();
    ctx.timers.boss.clearAll();
    return;
  }

  // Teardown any running encounter
  ctx.lifecycle.teardown();
  ctx.timers.lobby.clearAll();
  ctx.timers.boss.clearAll();

  const diffConfig = getDifficultyConfig(state.difficulty, state.customConfig);
  state.playground = true;
  state.hp = diffConfig.startingHp;
  state.score = 0;
  state.level = 1;
  state.bugsRemaining = 0;
  state.bugsSpawned = 0;
  state.boss = null;
  state.eliteConfig = undefined;
  state.miniBoss = undefined;
  state.pipelineChains = {};

  // Clear all bugs
  for (const bugId of Object.keys(state.bugs)) {
    state.bugs[bugId]._timers.clearAll();
    delete state.bugs[bugId];
  }

  // Ensure we're in lobby phase
  if (state.phase !== 'lobby') {
    ctx.lifecycle.transition(state, 'lobby');
  }
}

export const handleDevCommand: MessageHandler<DevCommandMsg> = ({ ws, msg, pid, playerInfo }) => {
  if (!DEV_MODE) {
    sendDevError(ws, 'Dev mode is not enabled');
    return;
  }

  const info = playerInfo.get(pid);
  if (!info?.userId) {
    sendDevError(ws, 'Authentication required for dev commands');
    return;
  }

  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) {
    sendDevError(ws, 'Not in a lobby');
    return;
  }

  const { state } = ctx;

  logger.info({ command: msg.command, level: msg.level, value: msg.value, target: msg.target, lobbyId: ctx.lobbyId }, 'Dev command');

  switch (msg.command) {
    case 'skip-to-boss': {
      // If in lobby or end state, start a fresh game first
      if (state.phase === 'lobby' || state.phase === 'gameover' || state.phase === 'win') {
        game.startGame(ctx);
      }
      // Now in 'playing' phase — tear down level state and jump to boss
      if (state.phase === 'playing') {
        bugs.clearSpawnTimer(ctx);
        // Clear all bugs
        for (const bugId of Object.keys(state.bugs)) {
          delete state.bugs[bugId];
        }
        boss.startBoss(ctx);
      }
      break;
    }

    case 'skip-to-level': {
      const level = msg.level ?? 1;
      // If in lobby or end state, start a fresh game (which starts at level 1)
      if (state.phase === 'lobby' || state.phase === 'gameover' || state.phase === 'win') {
        game.startGame(ctx);
      }
      // If already playing or now playing, adjust level
      if (state.phase === 'playing') {
        bugs.clearSpawnTimer(ctx);
        for (const bugId of Object.keys(state.bugs)) {
          delete state.bugs[bugId];
        }
        state.level = level;
        game.startLevel(ctx);
      }
      break;
    }

    case 'set-boss-hp': {
      if (state.phase !== 'boss' || !state.boss) {
        sendDevError(ws, 'Not in boss fight');
        return;
      }
      const hp = msg.value ?? 1;
      state.boss.hp = Math.max(0, Math.min(hp, state.boss.maxHp));
      const activePlugin = boss.getActivePlugin();
      const broadcastExtra = activePlugin ? activePlugin.broadcastFields(ctx) : {};
      ctx.events.emit({
        type: 'boss-tick',
        timeRemaining: state.boss.timeRemaining,
        bossHp: state.boss.hp,
        bossMaxHp: state.boss.maxHp,
        ...broadcastExtra,
      });
      break;
    }

    case 'spawn-mini-boss': {
      const target = msg.target;
      const validKeys = getMiniBossKeys();
      if (!target || !validKeys.includes(target)) {
        sendDevError(ws, `Invalid mini-boss type. Valid: ${validKeys.join(', ')}`);
        return;
      }
      initPlayground(ctx);
      startMiniBossDirect(ctx, target);
      break;
    }

    case 'spawn-elite': {
      const target = msg.target;
      if (!target || !ELITE_KEYS.includes(target)) {
        sendDevError(ws, `Invalid elite type. Valid: ${ELITE_KEYS.join(', ')}`);
        return;
      }
      initPlayground(ctx);
      startEliteDirect(ctx, target);
      break;
    }

    case 'spawn-boss': {
      initPlayground(ctx);
      ctx.events.emit({
        type: 'game-start',
        level: state.level,
        hp: state.hp,
        score: state.score,
        players: [],
      });
      boss.startBoss(ctx);
      break;
    }

    case 'spawn-level': {
      const level = msg.level ?? 1;
      initPlayground(ctx);
      state.level = level;
      ctx.lifecycle.transition(state, 'playing');
      ctx.events.emit({
        type: 'game-start',
        level: state.level,
        hp: state.hp,
        score: state.score,
        players: [],
      });
      game.startLevel(ctx);
      powerups.startDuckSpawning(ctx);
      powerups.startHammerSpawning(ctx);
      break;
    }

    case 'set-hp': {
      const hp = msg.value ?? 100;
      state.hp = Math.max(1, Math.min(hp, 150));
      ctx.events.emit({
        type: 'level-start',
        level: state.level,
        bugsTotal: 0,
        hp: state.hp,
        score: state.score,
      });
      break;
    }

    default:
      sendDevError(ws, `Unknown dev command: ${msg.command}`);
  }
};
