import type { MessageHandler } from './types.ts';
import * as boss from '../boss.ts';
import * as entityTypes from '../entity-types/index.ts';
import { getCtxForPlayer } from '../helpers.ts';

const CLICK_RADIUS_BUG = 80;

export const handleClickBug: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st } = ctx;
  if (st.phase !== 'playing' && st.phase !== 'boss') return;
  const bug = st.bugs[msg.bugId];
  if (!bug) return;
  const player = st.players[pid];
  if (player) {
    const dx = player.x - bug.x;
    const dy = player.y - bug.y;
    if (dx * dx + dy * dy > CLICK_RADIUS_BUG * CLICK_RADIUS_BUG) return;
  }
  const descriptor = entityTypes.getDescriptor(bug);
  descriptor.onClick(bug, ctx, pid, msg);
};

export const handleClickBoss: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  boss.handleBossClick(ctx, pid);
};
