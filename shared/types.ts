// Shared wire-format types — the canonical contract between server and client.
// Both server/types.ts and public/js/client-types.ts re-export these so
// existing consumer imports remain unchanged.

export type GamePhase = 'lobby' | 'playing' | 'shopping' | 'boss' | 'gameover' | 'win' | 'map_view';

export type MapNodeType = 'bug_level' | 'elite' | 'shop' | 'event' | 'rest' | 'mini_boss' | 'boss';
export type GameMode = 'classic' | 'roguelike';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: MapNodeType;
  connections: string[];
  visited: boolean;
  label: string;
  icon: string;
}

export interface RoguelikeMap {
  nodes: MapNode[];
  currentNodeId: string | null;
  seed: number;
}

export interface EventOption { id: string; label: string; description: string; icon: string; }
export interface EventDefinition { id: string; title: string; description: string; icon: string; options: EventOption[]; }

/** Fields sent over the wire for every player. */
export interface WirePlayer {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
  bugsSquashed: number;
  isGuest: boolean;
  role?: string | null;
}

export interface BugVariant {
  isHeisenbug?: boolean;
  isMemoryLeak?: boolean;
  growthStage?: number;
  isFeature?: boolean;
  eagleEye?: boolean;
  mergeConflict?: string;
  mergeSide?: 'left' | 'right';
  mergePartner?: string;
  isPipeline?: boolean;
  chainId?: string;
  chainIndex?: number;
  chainLength?: number;
  isInfiniteLoop?: boolean;
  loopCenterX?: number;
  loopCenterY?: number;
  loopRadiusX?: number;
  loopRadiusY?: number;
  loopAngle?: number;
  loopSpeed?: number;
  breakpointAngle?: number;
  loopTickMs?: number;
  isAzubi?: boolean;
  isMinion?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
}

export interface RubberDuck {
  id: string;
  x: number;
  y: number;
}

export interface HotfixHammer {
  id: string;
  x: number;
  y: number;
}

export interface LeaderboardEntry {
  display_name: string;
  icon: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  total_score: number;
  highest_score: number;
  bugs_squashed: number;
}

export interface StatsData {
  games_played: number;
  games_won: number;
  games_lost: number;
  total_score: number;
  highest_score: number;
  bugs_squashed: number;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  icon: string;
}

export interface QuestEntry {
  id: number;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed?: boolean;
}

export interface RecordingEvent {
  t: number;
  msg: Record<string, unknown>;
}

export interface MouseMoveEvent {
  t: number;
  playerId: string;
  x: number;
  y: number;
}
