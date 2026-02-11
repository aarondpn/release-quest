import { reactive } from 'vue';

export interface BugData {
  id: string;
  x: number;
  y: number;
  isHeisenbug?: boolean;
  isMemoryLeak?: boolean;
  isFeature?: boolean;
  mergeConflict?: string;
  mergeSide?: 'left' | 'right';
  mergePartner?: string;
  isPipeline?: boolean;
  chainId?: string;
  chainIndex?: number;
  chainLength?: number;
  growthStage?: number;
  // Client-side rendering state
  transition?: string;
  popping?: boolean;
  featureRevealed?: boolean;
  stabilized?: boolean;
  beingHeld?: boolean;
  holdProgress?: number;
  holderCount?: number;
  holdStartTime?: number;
  requiredHoldTime?: number;
  stunned?: boolean;
  mergeHalfclick?: boolean;
  pipelineReset?: boolean;
  featureLeaving?: boolean;
}

export interface PlayerData {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
}

export interface BossData {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  enraged: boolean;
  timeRemaining: number;
  transition?: string;
  stunned?: boolean;
}

export interface PowerUpData {
  x: number;
  y: number;
  transition?: string;
}

export interface LobbyData {
  id: number;
  name: string;
  code: string;
  player_count: number;
  max_players: number;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  icon: string;
}

export interface LeaderboardEntry {
  display_name: string;
  icon: string;
  total_score: number;
  games_played: number;
  games_won: number;
}

export interface VfxEvent {
  type: string;
  [key: string]: any;
}

export const gameState = reactive({
  // Connection
  connected: false,

  // Player identity
  myId: null as string | null,
  myColor: null as string | null,
  myIcon: null as string | null,
  myName: null as string | null,
  hasJoined: false,
  selectedIcon: null as string | null,

  // Game state
  currentPhase: null as string | null,
  score: 0,
  level: 1,
  hp: 100,

  // Entities
  bugs: {} as Record<string, BugData>,
  players: {} as Record<string, PlayerData>,
  remoteCursors: {} as Record<string, { x: number; y: number }>,
  boss: null as BossData | null,
  duck: null as PowerUpData | null,
  hammer: null as PowerUpData | null,

  // Powerup visual state
  duckBuffActive: false,
  duckBuffDuration: 0,
  hammerShockwave: null as { color: string } | null,

  // Lobby
  currentLobbyId: null as number | null,
  lobbies: [] as LobbyData[],

  // Auth
  authToken: null as string | null,
  authUser: null as AuthUser | null,
  isLoggedIn: false,

  // UI overlays
  showNameEntry: false,
  showLobbyBrowser: false,
  showAuthOverlay: false,

  // Leaderboard
  leaderboardEntries: [] as LeaderboardEntry[],

  // Screen overlays
  activeScreen: null as string | null, // 'start' | 'gameover' | 'win' | 'level' | 'boss' | null
  screenData: {} as Record<string, any>,

  // VFX event bus - array that components watch for changes
  vfxEvents: [] as VfxEvent[],

  // Merge tethers: conflictId -> { bug1, bug2 }
  mergeTethers: {} as Record<string, { bug1: string; bug2: string }>,
  // Pipeline tethers: chainId -> ordered bugIds
  pipelineTethers: {} as Record<string, string[]>,
});

export function emitVfx(event: VfxEvent) {
  gameState.vfxEvents.push(event);
  // Auto-clear after processing
  setTimeout(() => {
    const idx = gameState.vfxEvents.indexOf(event);
    if (idx !== -1) gameState.vfxEvents.splice(idx, 1);
  }, 0);
}
