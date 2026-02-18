import type { MessageHandler } from './types.ts';
import { getCtxForPlayer } from '../helpers.ts';
import { ROLES, isValidRole } from '../roles.ts';
import { createPlayerLogger } from '../logger.ts';

export const handleSelectRole: MessageHandler = ({ pid, msg, playerInfo }) => {
  const ctx = getCtxForPlayer(pid, playerInfo);
  if (!ctx) return;

  const { state } = ctx;

  // Role selection only allowed in lobby phase
  if (state.phase !== 'lobby') return;

  const player = state.players[pid];
  if (!player) return;

  const role = msg.role as string | null;

  // Validate role (null = no role / vanilla)
  if (role !== null && !isValidRole(role)) return;

  player.role = role;

  const roleData = role ? ROLES[role] : null;

  ctx.events.emit({
    type: 'role-selected',
    playerId: pid,
    role,
    roleName: roleData?.name ?? null,
    roleIcon: roleData?.icon ?? null,
  });

  const playerLogger = createPlayerLogger(pid);
  playerLogger.info({ role }, 'Player selected role');
};
