// Shared type definitions — no runtime code

import type { GameEventBus } from './event-bus.ts';
import type { ZodType } from 'zod';

// Re-export wire-format types from shared so existing server consumers need no changes
export type {
  GamePhase, WirePlayer, BugVariant, ShopItem, RubberDuck, HotfixHammer,
  LeaderboardEntry, StatsData, AuthUser, QuestEntry, RecordingEvent, MouseMoveEvent,
  MapNodeType, GameMode, MapNode, RoguelikeMap, EventOption, EventDefinition,
  EventModifiers,
} from '../shared/types.ts';

export type { ClientMessage, ServerMessage } from '../shared/messages.ts';

import type { GamePhase, WirePlayer, ShopItem, RubberDuck, HotfixHammer, AuthUser, RecordingEvent, GameMode, RoguelikeMap, EventModifiers } from '../shared/types.ts';

export interface ActiveBuff {
  itemId: string;
  playerId: string;
  expiresAtPhaseEnd: boolean;
  source?: string;  // e.g. 'shop', 'powerup', 'boss-drop' — defaults to 'shop'
}

export type CleanupHook = () => void;

export interface GameLifecycle {
  onCleanup(hook: CleanupHook): () => void;
  transition(state: GameState, to: GamePhase): void;
  teardown(): void;
  destroy(): void;
}

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

export interface PlayerData extends WirePlayer {
  x: number;
  y: number;
}

export interface PlayerInfo {
  name: string;
  color: string;
  icon: string;
  userId?: number;
  guestToken?: string;
  shopSeenRotation?: string;
}

export interface PlayerScoreEntry {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
  bugsSquashed: number;
  isGuest: boolean;
  role?: string | null;
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
  // Azubi
  isAzubi?: boolean;
  azubiSpawnInterval?: number;
  azubiTarget?: string;
  // Infinite Loop
  isInfiniteLoop?: boolean;
  loopCenterX?: number;
  loopCenterY?: number;
  loopRadiusX?: number;
  loopRadiusY?: number;
  loopAngle?: number;
  loopSpeed?: number;
  breakpointAngle?: number;
}

export interface PipelineChain {
  bugIds: string[];
  nextIndex: number;
  length: number;
  headBugId: string;
  snakeAngle: number;
  architectFreeResetsUsed?: Record<string, boolean>;
}

export interface BossState {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  lastClickBy: Record<string, number>;
  timeRemaining: number;
  currentSpawnRate: number;
  currentMaxOnScreen: number;
  regenPerSecond: number;
  extraPlayers: number;
  bossType: string;
  _wanderPaused?: boolean;
  _minionSpawnPaused?: boolean;
  data: Record<string, unknown>;
}

export interface BossClickResult {
  damageApplied: number;
  blocked: boolean;
  points: number;
  emit?: Record<string, unknown>;
}

export interface BossTypePluginInterface {
  typeKey: string;
  displayName: string;
  init(ctx: GameContext, bossConfig: DifficultyConfig['boss']): BossState;
  onTick(ctx: GameContext): void;
  onClick(ctx: GameContext, pid: string, damage: number): BossClickResult;
  onStun(ctx: GameContext): void;
  onResume(ctx: GameContext): void;
  onDefeat(ctx: GameContext): void;
  getSpawnRate(ctx: GameContext): number;
  getMaxOnScreen(ctx: GameContext): number;
  broadcastFields(ctx: GameContext): Record<string, unknown>;
  handlers?: Record<string, (ctx: any) => void | Promise<void>>;
  schemas?: Record<string, ZodType>;
}

export interface DuckBuff {
  expiresAt: number;
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
  playerBuffs: Record<string, ActiveBuff[]>;
  shopReadyPlayers?: Set<string>;
  gameStartedAt?: number;
  difficulty: string;
  customConfig?: CustomDifficultyConfig;
  gameMode: GameMode;
  roguelikeMap?: RoguelikeMap;
  mapVotes?: Record<string, string>;
  voteDeadline?: number;
  eventModifiers?: EventModifiers;
  eventVotes?: Record<string, string>;
  activeEventId?: string;
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

export interface GameTimers {
  lobby: TimerBag;
  boss: TimerBag;
}

export interface GameContext {
  lobbyId: number;
  state: GameState;
  counters: GameCounters;
  timers: GameTimers;
  matchLog: MatchLog | null;
  playerInfo: Map<string, PlayerInfo>;
  events: GameEventBus;
  lifecycle: GameLifecycle;
}

export interface LobbyMemory {
  state: GameState;
  counters: GameCounters;
  timers: GameTimers;
  matchLog: MatchLog | null;
  events: GameEventBus;
  lifecycle: GameLifecycle;
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

export interface BugTypePlugin {
  typeKey: string;
  detect(bug: BugEntity): boolean;
  descriptor: EntityDescriptor;
  escapeTimeMultiplier?: number;
  spawn:
    | { mode: 'single'; chanceKey: keyof DifficultyConfig['specialBugs']; startLevelKey?: keyof DifficultyConfig['specialBugs'];
        createVariant(ctx: GameContext): Partial<BugEntity>;
        canSpawn?(ctx: GameContext): boolean; }
    | { mode: 'multi'; chanceKey: keyof DifficultyConfig['specialBugs']; startLevelKey?: keyof DifficultyConfig['specialBugs'];
        trySpawn(ctx: GameContext, cfg: LevelConfigEntry): boolean; };
  handlers?: Record<string, (ctx: any) => void | Promise<void>>;
  schemas?: Record<string, ZodType>;
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
  scoreMultiplier: number;
  levels: Record<number, LevelConfigEntry>;
  boss: {
    hp: number;
    clickDamage: number;
    clickPoints: number;
    killBonus: number;
    wanderInterval: number;
    minionSpawnRate: number;
    minionEscapeTime: number;
    minionMaxOnScreen: number;
    clickCooldownMs: number;
    regenPerSecond: number;
    timeLimit: number;
    escalation: EscalationEntry[];
    bossPhases: {
      phase2Threshold: number;
      phase3Threshold: number;
      shieldDuration: number;
      shieldInterval: number;
      phase2WanderInterval: number;
      phase2SpawnRateMultiplier: number;
      phase3SpawnRateMultiplier: number;
      phase3MaxOnScreenMultiplier: number;
      screenWipeInterval: number;
      screenWipeBugCount: number;
      transitionInvulnTime: number;
      phase3TimeReduction: number;
      phase3SizeMultiplier: number;
      phase3DamageReductionPerMinion: number;
      phase3MaxDamageReduction: number;
    };
  };
  specialBugs: {
    heisenbugChance: number;
    codeReviewChance: number;
    codeReviewStartLevel: number;
    mergeConflictChance: number;
    pipelineBugChance: number;
    pipelineBugStartLevel: number;
    memoryLeakChance: number;
    infiniteLoopChance: number;
    infiniteLoopStartLevel: number;
    azubiChance: number;
    azubiStartLevel: number;
    azubiSpawnInterval: number;
    azubiFeatureChance: number;
  };
  shop: {
    duration: number;
    items: ShopItem[];
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

// Quest types

export type QuestMetric = 'bugs_squashed' | 'games_played' | 'games_won' | 'single_game_score' | 'total_score';

export interface QuestDefinition {
  key: string;
  type: 'daily' | 'weekly';
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardMin: number;
  rewardMax: number;
  metric: QuestMetric;
}

export interface UserQuestRow {
  id: number;
  user_id: number;
  quest_key: string;
  quest_type: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
  assigned_at: Date;
  period_start: Date;
  period_end: Date;
}

export interface CurrencyBalance {
  balance: number;
  totalEarned: number;
}

export interface CosmeticShopItem {
  id: string;
  name: string;
  category: 'avatar';
  price: number;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
}

export interface InventoryItem {
  item_id: string;
  category: string;
  purchased_at: Date;
}

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

export interface DbGuestSessionRow {
  token: string;
  name: string;
  icon: string;
  created_at: Date;
  expires_at: Date;
}

export interface DbSessionRow {
  token: string;
  expires_at: Date;
  user_id: number;
  username: string;
  display_name: string;
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
  players: { id: string; name: string; icon: string; color: string; score: number }[];
}

// Relational row types for normalized recording tables

export interface RecordingPlayerRow {
  id: number;
  recording_id: number;
  player_id: string;
  name: string;
  icon: string;
  color: string;
  score: number;
}

export interface RecordingEventRow {
  id: number;
  recording_id: number;
  t: number;
  type: string;
  data: Record<string, unknown>;
}

export interface RecordingMouseMoveRow {
  id: number;
  recording_id: number;
  player_id: string;
  t: number;
  x: number;
  y: number;
}

export interface RecordingRow {
  id: number;
  user_id: number;
  recorded_at: Date;
  duration_ms: number;
  outcome: 'win' | 'loss';
  score: number;
  difficulty: string;
  player_count: number;
  share_token?: string | null;
  shared_at?: Date | null;
  players?: RecordingPlayerRow[];
  events?: RecordingEventRow[];
  mouseMovements?: RecordingMouseMoveRow[];
}
