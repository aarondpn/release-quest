import type { HandlerContext, MessageHandler } from './types.ts';
import type { DevCommandMsg } from '../../shared/messages.ts';
import { DEV_MODE } from '../config.ts';
import { getCtxForPlayer } from '../helpers.ts';
import * as network from '../network.ts';
import * as game from '../game.ts';
import * as boss from '../boss.ts';
import * as bugs from '../bugs.ts';
import * as powerups from '../powerups.ts';
import logger from '../logger.ts';

function sendDevError(ws: HandlerContext['ws'], message: string): void {
  network.send(ws, { type: 'dev-error', message });
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

  logger.info({ command: msg.command, level: msg.level, value: msg.value, lobbyId: ctx.lobbyId }, 'Dev command');

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

    default:
      sendDevError(ws, `Unknown dev command: ${msg.command}`);
  }
};
