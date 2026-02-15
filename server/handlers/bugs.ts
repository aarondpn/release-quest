import type { HandlerContext, MessageHandler } from './types.ts';
import * as boss from '../boss.ts';
import * as entityTypes from '../entity-types/index.ts';
import { getCtxForPlayer } from '../helpers.ts';

export const handleClickBug: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st } = ctx;
  if (st.phase !== 'playing' && st.phase !== 'boss') return;
  const bug = st.bugs[msg.bugId];
  if (!bug) return;
  const descriptor = entityTypes.getDescriptor(bug);
  descriptor.onClick(bug, ctx, pid, msg);
};

export const handleClickBreakpoint: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st } = ctx;
  if (st.phase !== 'playing' && st.phase !== 'boss') return;
  const bug = st.bugs[msg.bugId];
  if (!bug || !bug.isInfiniteLoop) return;
  entityTypes.handleBreakpointClick(bug, ctx, pid);
};

export const handleClickMemoryLeakStart: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st } = ctx;
  if (st.phase !== 'playing' && st.phase !== 'boss') return;
  const bug = st.bugs[msg.bugId];
  if (!bug || !bug.isMemoryLeak) return;
  entityTypes.getDescriptor(bug).onHoldStart!(bug, ctx, pid);
};

export const handleClickMemoryLeakComplete: MessageHandler = ({ msg, pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  const { state: st } = ctx;
  if (st.phase !== 'playing' && st.phase !== 'boss') return;
  const bug = st.bugs[msg.bugId];
  if (!bug || !bug.isMemoryLeak) return;
  entityTypes.getDescriptor(bug).onHoldComplete!(bug, ctx, pid);
};

export const handleClickBoss: MessageHandler = ({ pid, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;
  boss.handleBossClick(ctx, pid);
};
