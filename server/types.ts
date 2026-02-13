// Shared type definitions — no runtime code

export type GamePhase = 'lobby' | 'playing' | 'boss' | 'gameover' | 'win';

export interface TimerBag {
  setTimeout(name: string, fn: () => void, ms: number): void;
  setInterval(name: string, fn: () => void, ms: number): void;
  clear(name: string): void;
  clearAll(): void;
  has(name: string): boolean;
}

export interface MatchLog {
  log(event: string, data: Record<string, unknown>): void;
  close(): void;
}

export interface PlayerData {
  id: string;
  name: string;
  color: string;
  icon: string;
  x: number;
  y: number;
  score: number;
  bugsSquashed: number;
}

export interface PlayerInfo {
  name: string;
  color: string;
  icon: string;
  userId?: number;
}

export interface PlayerScoreEntry {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
}

export interface BugEntity {
  id: string;
  x: number;
  y: number;
  _timers: TimerBag;
  escapeTime: number;
  escapeStartedAt: number;
  _onEscape?: () => void;
  _sharedEscapeWith?: string;
  isStunned?: boolean;
  remainingEscapeTime?: number;
  isMinion?: boolean;
  // Heisenbug
  isHeisenbug?: boolean;
  fleesRemaining?: number;
  lastFleeTime?: number;
  // Feature
  isFeature?: boolean;
  // Memory Leak
  isMemoryLeak?: boolean;
  growthStage?: number;
  holders?: Map<string, number>;
  holdStartStage?: number;
  firstHolderStartTime?: number;
  // Merge Conflict
  mergeConflict?: string;
  mergePartner?: string;
  mergeSide?: 'left' | 'right';
  mergeClicked?: boolean;
  mergeClickedBy?: string | null;
  mergeClickedAt?: number;
  // Pipeline
  isPipeline?: boolean;
  chainId?: string;
  chainIndex?: number;
  chainLength?: number;
}

export interface PipelineChain {
  bugIds: string[];
  nextIndex: number;
  length: number;
  headBugId: string;
  snakeAngle: number;
}

export interface BossState {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  enraged: boolean;
  lastClickBy: Record<string, number>;
  timeRemaining: number;
  escalationLevel: number;
  currentSpawnRate: number;
  currentMaxOnScreen: number;
  regenPerSecond: number;
  extraPlayers: number;
  _wanderPaused?: boolean;
  _minionSpawnPaused?: boolean;
}

export interface RubberDuck {
  id: string;
  x: number;
  y: number;
}

export interface DuckBuff {
  expiresAt: number;
}

export interface HotfixHammer {
  id: string;
  x: number;
  y: number;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  hp: number;
  level: number;
  bugsRemaining: number;
  bugsSpawned: number;
  bugs: Record<string, BugEntity>;
  players: Record<string, PlayerData>;
  boss: BossState | null;
  rubberDuck: RubberDuck | null;
  duckBuff: DuckBuff | null;
  hotfixHammer: HotfixHammer | null;
  hammerStunActive: boolean;
  pipelineChains: Record<string, PipelineChain>;
  gameStartedAt?: number;
  difficulty: string;
  customConfig?: CustomDifficultyConfig;
}

export interface GameCounters {
  nextBugId: number;
  nextPlayerId: number;
  colorIndex: number;
  nextDuckId: number;
  nextConflictId: number;
  nextChainId: number;
  nextHammerId: number;
}

export type GameTimers = Record<string, any>;

export interface GameContext {
  lobbyId: number;
  state: GameState;
  counters: GameCounters;
  timers: GameTimers;
  matchLog: MatchLog | null;
  playerInfo: Map<string, PlayerInfo>;
}

export interface LobbyMemory {
  state: GameState;
  counters: GameCounters;
  timers: GameTimers;
}

export interface EntityDescriptor {
  init(bug: BugEntity, ctx: GameContext, opts: { phaseCheck: string }): void;
  broadcastFields(bug: BugEntity): Record<string, unknown>;
  setupTimers(bug: BugEntity, ctx: GameContext): void;
  createWander(bug: BugEntity, ctx: GameContext): void;
  onStun(bug: BugEntity, ctx: GameContext): void;
  onResume(this: EntityDescriptor, bug: BugEntity, ctx: GameContext): void;
  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void): void;
  onClick(bug: BugEntity, ctx: GameContext, pid: string, msg: any): void;
  onCursorNear?(bug: BugEntity, ctx: GameContext, pid: string, x: number, y: number): void;
  onHoldStart?(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string): void;
  onHoldComplete?(this: EntityDescriptor, bug: BugEntity, ctx: GameContext, pid: string): void;
  _completeHold?(bug: BugEntity, ctx: GameContext): void;
}

export interface SpawnEntityOptions {
  phaseCheck: GamePhase;
  maxOnScreen: number;
  escapeTime: number;
  isMinion: boolean;
  onEscapeCheck: () => void;
  variant: Partial<BugEntity> | null;
}

export interface LevelConfigEntry {
  bugsTotal: number;
  escapeTime: number;
  spawnRate: number;
  maxOnScreen: number;
}

export interface EscalationEntry {
  timeRemaining: number;
  spawnRate: number;
  maxOnScreen: number;
}

export interface DifficultyConfig {
  startingHp: number;
  hpDamage: number;
  bugPoints: number;
  levels: Record<number, LevelConfigEntry>;
  boss: {
    hp: number;
    clickDamage: number;
    clickPoints: number;
    killBonus: number;
    wanderInterval: number;
    enrageThreshold: number;
    enrageWanderInterval: number;
    minionSpawnRate: number;
    enrageMinionSpawnRate: number;
    minionEscapeTime: number;
    minionMaxOnScreen: number;
    enrageMinionMaxOnScreen: number;
    clickCooldownMs: number;
    regenPerSecond: number;
    timeLimit: number;
    escalation: EscalationEntry[];
  };
  specialBugs: {
    heisenbugChance: number;
    codeReviewChance: number;
    codeReviewStartLevel: number;
    mergeConflictChance: number;
    pipelineBugChance: number;
    pipelineBugStartLevel: number;
    memoryLeakChance: number;
  };
  powerups: {
    rubberDuckIntervalMin: number;
    rubberDuckIntervalMax: number;
    rubberDuckBuffDuration: number;
    rubberDuckWanderInterval: number;
    rubberDuckDespawnTime: number;
    rubberDuckPoints: number;
    rubberDuckPointsMultiplier: number;
    hotfixHammerIntervalMin: number;
    hotfixHammerIntervalMax: number;
    hotfixHammerStunDuration: number;
    hotfixHammerDespawnTime: number;
    hotfixHammerPoints: number;
  };
}

export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type CustomDifficultyConfig = DeepPartial<DifficultyConfig>;

// DB row types

export interface DbLobbyRow {
  id: number;
  name: string;
  code: string;
  max_players: number;
  status: string;
  created_at: Date;
  settings: Record<string, unknown>;
  player_count?: number;
}

export interface DbUserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  icon: string;
  created_at: Date;
}

export interface DbSessionRow {
  token: string;
  expires_at: Date;
  user_id: number;
  username: string;
  display_name: string;
  icon: string;
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

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  icon: string;
}

export type AuthSuccess = {
  user: AuthUser;
  token: string;
  error?: undefined;
};

export type AuthError = {
  error: string;
  user?: undefined;
  token?: undefined;
};

export type AuthResult = AuthSuccess | AuthError;

// Recording types

export interface RecordingEvent {
  t: number;
  msg: Record<string, unknown>;
}

export interface RecordingBuffer {
  startTime: number;
  events: RecordingEvent[];
}

export interface RecordingMetadata {
  userId: number;
  duration_ms: number;
  outcome: string;
  score: number;
  difficulty: string;
  player_count: number;
  players: { name: string; icon: string; color: string; score: number }[];
}

export interface RecordingRow {
  id: number;
  user_id: number;
  recorded_at: Date;
  duration_ms: number;
  outcome: string;
  score: number;
  difficulty: string;
  player_count: number;
  players: { name: string; icon: string; color: string; score: number }[];
  events?: RecordingEvent[];
}
