import type { GameState } from './types.ts';

export interface RoleDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const ROLES: Record<string, RoleDefinition> = {
  debugger: {
    id: 'debugger',
    name: 'Debugger',
    icon: '🔍',
    description: '+50% pts on special bugs',
  },
  qa: {
    id: 'qa',
    name: 'QA Engineer',
    icon: '🎯',
    description: '+40% click hitbox radius',
  },
  devops: {
    id: 'devops',
    name: 'DevOps',
    icon: '⚡',
    description: 'Power-ups last 50% longer; team spawns 20% more often',
  },
  architect: {
    id: 'architect',
    name: 'Architect',
    icon: '🏗️',
    description: 'Solo-resolve merge conflicts; one free pipeline reset per chain',
  },
};

export const ROLE_IDS = Object.keys(ROLES);

export function isValidRole(role: string): boolean {
  return role in ROLES;
}

/** Check if a specific player has a given role */
export function hasRole(state: GameState, pid: string, role: string): boolean {
  return state.players[pid]?.role === role;
}

/** Check if any player in the lobby has a given role */
export function teamHasRole(state: GameState, role: string): boolean {
  return Object.values(state.players).some(p => p.role === role);
}

/** Returns the special bug point multiplier for a player (Debugger passive) */
export function getSpecialBugMultiplier(state: GameState, pid: string): number {
  return hasRole(state, pid, 'debugger') ? 1.5 : 1;
}

/** Returns the powerup duration multiplier for a player (DevOps passive) */
export function getPowerupDurationMultiplier(state: GameState, pid: string): number {
  return hasRole(state, pid, 'devops') ? 1.5 : 1;
}

/** Returns the team powerup spawn interval multiplier (DevOps team passive).
 *  Returns 0.8 if any player has DevOps (spawns 20% more frequently), 1.0 otherwise. */
export function getTeamPowerupSpawnMultiplier(state: GameState): number {
  return teamHasRole(state, 'devops') ? 0.8 : 1.0;
}

/** Returns the hitbox radius multiplier for a player (QA Engineer passive) */
export function getHitboxMultiplier(state: GameState, pid: string): number {
  return hasRole(state, pid, 'qa') ? 1.4 : 1;
}
