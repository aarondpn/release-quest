// Typed WebSocket message protocol.
// ClientMessage = client→server, ServerMessage = server→client.
// Both are discriminated unions keyed on `type`.

import type {
  AuthUser, BugVariant, ShopItem, LeaderboardEntry, StatsData,
  QuestEntry, GamePhase, WirePlayer, RubberDuck, HotfixHammer,
  GameMode, RoguelikeMap, MapNodeType, EventDefinition, MiniBossEntity,
} from './types.ts';

// ─── Client → Server messages ────────────────────────────────────────────────

// Auth

export interface RegisterMsg {
  type: 'register';
  username: string;
  password: string;
  displayName: string;
  icon?: string;
}

export interface LoginMsg {
  type: 'login';
  username: string;
  password: string;
}

export interface LogoutMsg {
  type: 'logout';
  token: string | null;
}

export interface ResumeSessionMsg {
  type: 'resume-session';
  token: string;
}

export interface ResumeGuestMsg {
  type: 'resume-guest';
  token?: string;
}

// Identity

export interface SetNameMsg {
  type: 'set-name';
  name?: string | null;
  icon?: string | null;
}

// Lobby

export interface LobbyCustomConfig {
  startingHp?: number;
  hpDamage?: number;
  bugPoints?: number;
  scoreMultiplier?: number;
  levels?: Record<string, {
    bugsTotal?: number;
    escapeTime?: number;
    spawnRate?: number;
    maxOnScreen?: number;
  }>;
  boss?: {
    hp?: number;
    clickDamage?: number;
    clickPoints?: number;
    killBonus?: number;
    wanderInterval?: number;
    minionSpawnRate?: number;
    minionEscapeTime?: number;
    minionMaxOnScreen?: number;
    clickCooldownMs?: number;
    regenPerSecond?: number;
    timeLimit?: number;
  };
  specialBugs?: {
    heisenbugChance?: number;
    codeReviewChance?: number;
    codeReviewStartLevel?: number;
    mergeConflictChance?: number;
    pipelineBugChance?: number;
    pipelineBugStartLevel?: number;
    memoryLeakChance?: number;
    infiniteLoopChance?: number;
    infiniteLoopStartLevel?: number;
    azubiChance?: number;
    azubiStartLevel?: number;
    azubiSpawnInterval?: number;
    azubiFeatureChance?: number;
  };
  shop?: {
    duration?: number;
  };
  powerups?: {
    rubberDuckIntervalMin?: number;
    rubberDuckIntervalMax?: number;
    rubberDuckBuffDuration?: number;
    rubberDuckWanderInterval?: number;
    rubberDuckDespawnTime?: number;
    rubberDuckPoints?: number;
    rubberDuckPointsMultiplier?: number;
    hotfixHammerIntervalMin?: number;
    hotfixHammerIntervalMax?: number;
    hotfixHammerStunDuration?: number;
    hotfixHammerDespawnTime?: number;
    hotfixHammerPoints?: number;
  };
}

export interface ListLobbiesMsg {
  type: 'list-lobbies';
}

export interface CreateLobbyMsg {
  type: 'create-lobby';
  name?: string;
  maxPlayers?: number;
  difficulty?: string;
  customConfig?: LobbyCustomConfig;
  password?: string;
  gameMode?: GameMode;
}

export interface JoinLobbyMsg {
  type: 'join-lobby';
  lobbyId: number;
  password?: string;
}

export interface JoinLobbyByCodeMsg {
  type: 'join-lobby-by-code';
  code: string;
  password?: string;
}

export interface JoinSpectateMsg {
  type: 'join-spectate';
  lobbyId: number;
  password?: string;
}

export interface LeaveSpectateMsg {
  type: 'leave-spectate';
}

export interface LeaveLobbyMsg {
  type: 'leave-lobby';
}

// Game actions

export interface StartGameMsg {
  type: 'start-game';
}

export interface ClickBugMsg {
  type: 'click-bug';
  bugId: string;
}

export interface ClickBossMsg {
  type: 'click-boss';
}

export interface ClickDuckMsg {
  type: 'click-duck';
}

export interface ClickHammerMsg {
  type: 'click-hammer';
}

export interface CursorMoveMsg {
  type: 'cursor-move';
  x: number;
  y: number;
}

// Plugin entity actions

export interface ClickBreakpointMsg {
  type: 'click-breakpoint';
  bugId: string;
}

export interface ClickMemoryLeakStartMsg {
  type: 'click-memory-leak-start';
  bugId: string;
}

export interface ClickMemoryLeakCompleteMsg {
  type: 'click-memory-leak-complete';
  bugId: string;
}

// Shop (in-game)

export interface ShopBuyMsg {
  type: 'shop-buy';
  itemId: string;
}

export interface ShopReadyMsg {
  type: 'shop-ready';
}

// Role selection

export interface SelectRoleMsg {
  type: 'select-role';
  role: string | null;
}

// Chat

export interface ChatMessageMsg {
  type: 'chat-message';
  message: string;
}

// Stats & recordings

export interface GetLeaderboardMsg {
  type: 'get-leaderboard';
}

export interface GetMyStatsMsg {
  type: 'get-my-stats';
}

export interface GetRecordingsMsg {
  type: 'get-recordings';
}

export interface ShareRecordingMsg {
  type: 'share-recording';
  id: number;
}

export interface UnshareRecordingMsg {
  type: 'unshare-recording';
  id: number;
}

// Quests & cosmetic shop

export interface GetQuestsMsg {
  type: 'get-quests';
}

export interface GetBalanceMsg {
  type: 'get-balance';
}

export interface GetShopCatalogMsg {
  type: 'get-shop-catalog';
}

export interface ShopSeenMsg {
  type: 'shop-seen';
}

export interface ShopPurchaseMsg {
  type: 'shop-purchase';
  itemId: string;
}

// Dev

// Roguelike

export interface MapVoteMsg {
  type: 'map-vote';
  nodeId: string;
}

export interface EventVoteMsg {
  type: 'event-vote';
  optionId: string;
}

export interface RestVoteMsg {
  type: 'rest-vote';
  option: 'rest' | 'train';
}

export interface MiniBossClickMsg {
  type: 'mini-boss-click';
  entityId: string;
}

export interface EncounterRewardContinueMsg {
  type: 'encounter-reward-continue';
}

export interface DevCommandMsg {
  type: 'dev-command';
  command: string;
  level?: number;
  value?: number;
}

export type ClientMessage =
  | RegisterMsg
  | LoginMsg
  | LogoutMsg
  | ResumeSessionMsg
  | ResumeGuestMsg
  | SetNameMsg
  | ListLobbiesMsg
  | CreateLobbyMsg
  | JoinLobbyMsg
  | JoinLobbyByCodeMsg
  | JoinSpectateMsg
  | LeaveSpectateMsg
  | LeaveLobbyMsg
  | StartGameMsg
  | ClickBugMsg
  | ClickBossMsg
  | ClickDuckMsg
  | ClickHammerMsg
  | CursorMoveMsg
  | ClickBreakpointMsg
  | ClickMemoryLeakStartMsg
  | ClickMemoryLeakCompleteMsg
  | ShopBuyMsg
  | ShopReadyMsg
  | SelectRoleMsg
  | ChatMessageMsg
  | GetLeaderboardMsg
  | GetMyStatsMsg
  | GetRecordingsMsg
  | ShareRecordingMsg
  | UnshareRecordingMsg
  | GetQuestsMsg
  | GetBalanceMsg
  | GetShopCatalogMsg
  | ShopSeenMsg
  | ShopPurchaseMsg
  | MapVoteMsg
  | EventVoteMsg
  | RestVoteMsg
  | MiniBossClickMsg
  | EncounterRewardContinueMsg
  | DevCommandMsg;

// ─── Server → Client messages ────────────────────────────────────────────────

// Connection

export interface WelcomeMsg {
  type: 'welcome';
  playerId: string;
  name: string;
  color: string;
  icon: string;
  onlineCount: number;
}

export interface OnlineCountMsg {
  type: 'online-count';
  count: number;
}

export interface ErrorMsg {
  type: 'error';
  message: string;
}

export interface ValidationErrorMsg {
  type: 'validation-error';
  messageType: string;
  errors: { path: string; message: string; code: string }[];
}

// Auth

export interface AuthResultMsg {
  type: 'auth-result';
  action: 'login' | 'logout' | 'register' | 'resume';
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  name?: string;
  icon?: string;
}

export interface GuestSessionMsg {
  type: 'guest-session';
  success: boolean;
  resumed?: boolean;
  name?: string;
  icon?: string;
  token?: string;
}

// Lobby

export interface LobbyListMsg {
  type: 'lobby-list';
  lobbies: LobbyListEntry[];
}

export interface LobbyListEntry {
  id: number;
  name: string;
  code: string;
  max_players: number;
  player_count: number;
  started: boolean;
  hasPassword?: boolean;
  hasCustomSettings?: boolean;
  spectatorCount?: number;
  settings?: Record<string, unknown>;
}

export interface LobbyCreatedMsg {
  type: 'lobby-created';
  lobby: LobbyListEntry;
}

export interface LobbyErrorMsg {
  type: 'lobby-error';
  message: string;
  needsPassword?: boolean;
  lobbyId?: number;
  code?: string;
}

/** Wire bug: variant fields + position + id */
export interface WireBug extends BugVariant {
  id: string;
  x: number;
  y: number;
}

/** Boss snapshot as sent in lobby-joined / spectator-joined */
export interface WireBossSnapshot {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  timeRemaining: number;
  bossType?: string;
  phase?: number;
  phaseName?: string;
  shieldActive?: boolean;
  invulnUntil?: number;
  damageReduction?: number;
}

export interface LobbyJoinedMsg {
  type: 'lobby-joined';
  lobbyId: number;
  lobbyName: string;
  lobbyCode: string;
  creatorId: string | null;
  phase: GamePhase;
  score: number;
  hp: number;
  level: number;
  bugsRemaining: number;
  bugs: WireBug[];
  players: WirePlayer[];
  rubberDuck: RubberDuck | null;
  duckBuff: { expiresAt: number } | null;
  hotfixHammer: HotfixHammer | null;
  boss: WireBossSnapshot | null;
  hasCustomSettings: boolean;
  gameMode?: GameMode;
  roguelikeMap?: RoguelikeMap;
}

export interface SpectatorJoinedMsg {
  type: 'spectator-joined';
  lobbyId: number;
  lobbyName: string;
  lobbyCode: string;
  hasCustomSettings: boolean;
  phase: GamePhase;
  score: number;
  hp: number;
  level: number;
  bugsRemaining: number;
  bugs: WireBug[];
  players: WirePlayer[];
  rubberDuck: RubberDuck | null;
  duckBuff: { expiresAt: number } | null;
  hotfixHammer: HotfixHammer | null;
  boss: WireBossSnapshot | null;
  gameMode?: GameMode;
  roguelikeMap?: RoguelikeMap;
}

export interface SpectatorCountMsg {
  type: 'spectator-count';
  count: number;
  spectators: { id: string; name: string; icon: string }[];
}

export interface SpectatorKickedMsg {
  type: 'spectator-kicked';
  reason: string;
}

export interface LobbyLeftMsg {
  type: 'lobby-left';
}

// Players

/** Player info as sent with player-joined (bugsSquashed may be omitted for new joins). */
export interface WirePlayerBrief {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
  isGuest: boolean;
  bugsSquashed?: number;
  role?: string | null;
}

export interface PlayerJoinedMsg {
  type: 'player-joined';
  player: WirePlayerBrief;
  playerCount: number;
}

export interface PlayerLeftMsg {
  type: 'player-left';
  playerId: string;
  playerCount: number;
}

export interface PlayerCursorMsg {
  type: 'player-cursor';
  playerId: string;
  x: number;
  y: number;
}

export interface RoleSelectedMsg {
  type: 'role-selected';
  playerId: string;
  role: string | null;
  roleName: string | null;
  roleIcon: string | null;
}

// Game lifecycle

export interface GameStartMsg {
  type: 'game-start';
  level: number;
  hp: number;
  score: number;
  players: WirePlayer[];
}

export interface LevelStartMsg {
  type: 'level-start';
  level: number;
  bugsTotal: number;
  hp: number;
  score: number;
}

export interface LevelCompleteMsg {
  type: 'level-complete';
  level: number;
  score: number;
}

export interface GameOverMsg {
  type: 'game-over';
  score: number;
  level: number;
  players: WirePlayer[];
}

export interface GameWinMsg {
  type: 'game-win';
  score: number;
  level?: number;
  players: WirePlayer[];
}

export interface GameResetMsg {
  type: 'game-reset';
}

// Bugs

export interface BugSpawnedMsg {
  type: 'bug-spawned';
  bug: WireBug;
}

export interface BugWanderMsg {
  type: 'bug-wander';
  bugId: string;
  x: number;
  y: number;
}

export interface BugSquashedMsg {
  type: 'bug-squashed';
  bugId: string;
  playerId: string;
  playerColor: string;
  playerScore: number;
  score: number;
}

export interface BugEscapedMsg {
  type: 'bug-escaped';
  bugId: string;
  hp: number;
}

export interface BugFleeMsg {
  type: 'bug-flee';
  bugId: string;
  x: number;
  y: number;
  fleesRemaining: number;
}

// Feature

export interface FeatureSquashedMsg {
  type: 'feature-squashed';
  bugId: string;
  hp: number;
}

export interface FeatureEscapedMsg {
  type: 'feature-escaped';
  bugId: string;
}

// Memory Leak

export interface MemoryLeakGrowMsg {
  type: 'memory-leak-grow';
  bugId: string;
  growthStage: number;
}

export interface MemoryLeakEscapedMsg {
  type: 'memory-leak-escaped';
  bugId: string;
  growthStage: number;
  damage: number;
  hp: number;
}

export interface MemoryLeakHoldUpdateMsg {
  type: 'memory-leak-hold-update';
  bugId: string;
  holderCount: number;
  elapsedTime: number;
  requiredHoldTime: number;
  dropOut?: boolean;
}

export interface MemoryLeakClearedMsg {
  type: 'memory-leak-cleared';
  bugId: string;
  score: number;
  holders: string[];
  players: Record<string, number>;
}

// Merge Conflict

export interface MergeConflictResolvedMsg {
  type: 'merge-conflict-resolved';
  bugId: string;
  partnerId: string;
  score: number;
  players: Record<string, number>;
}

export interface MergeConflictHalfclickMsg {
  type: 'merge-conflict-halfclick';
  bugId: string;
}

export interface MergeConflictEscapedMsg {
  type: 'merge-conflict-escaped';
  bugId: string;
  partnerId: string;
  hp: number;
}

// Pipeline

export interface PipelineBugSquashedMsg {
  type: 'pipeline-bug-squashed';
  bugId: string;
  chainId: string;
  playerId: string;
  playerColor: string;
  playerScore: number;
  score: number;
}

export interface PipelineChainResolvedMsg {
  type: 'pipeline-chain-resolved';
  chainId: string;
  playerId: string;
  playerScore: number;
  score: number;
}

export interface PipelineChainResetMsg {
  type: 'pipeline-chain-reset';
  chainId: string;
  positions: Record<string, { x: number; y: number }>;
}

export interface PipelineChainEscapedMsg {
  type: 'pipeline-chain-escaped';
  chainId: string;
  bugIds: string[];
  hp: number;
}

// Infinite Loop

export interface InfiniteLoopSquashedMsg {
  type: 'infinite-loop-squashed';
  bugId: string;
  playerId: string;
  playerScore: number;
  score: number;
}

export interface InfiniteLoopMissMsg {
  type: 'infinite-loop-miss';
  bugId: string;
}

// Azubi

export interface AzubiEscapedMsg {
  type: 'azubi-escaped';
  bugId: string;
}

// Powerups — Duck

export interface DuckSpawnMsg {
  type: 'duck-spawn';
  duck: RubberDuck;
}

export interface DuckWanderMsg {
  type: 'duck-wander';
  x: number;
  y: number;
}

export interface DuckDespawnMsg {
  type: 'duck-despawn';
}

export interface DuckCollectedMsg {
  type: 'duck-collected';
  playerId: string;
  playerColor: string;
  score: number;
  playerScore: number;
  buffDuration: number;
}

export interface DuckBuffExpiredMsg {
  type: 'duck-buff-expired';
}

// Powerups — Hammer

export interface HammerSpawnMsg {
  type: 'hammer-spawn';
  hammer: HotfixHammer;
}

export interface HammerDespawnMsg {
  type: 'hammer-despawn';
}

export interface HammerCollectedMsg {
  type: 'hammer-collected';
  playerId: string;
  playerColor: string;
  score: number;
  playerScore: number;
  stunDuration: number;
}

export interface HammerStunExpiredMsg {
  type: 'hammer-stun-expired';
}

// Boss

export interface BossSpawnMsg {
  type: 'boss-spawn';
  boss: WireBossSnapshot;
  hp: number;
  score: number;
  timeRemaining: number;
}

export interface BossWanderMsg {
  type: 'boss-wander';
  x: number;
  y: number;
}

export interface BossHitMsg {
  type: 'boss-hit';
  bossHp: number;
  bossMaxHp: number;
  damage: number;
  playerId: string;
  playerColor: string;
  score: number;
  playerScore: number;
  // Plugin fields
  phase?: number;
  phaseName?: string;
  shieldActive?: boolean;
  damageReduction?: number;
  bossType?: string;
  invulnUntil?: number;
}

export interface BossTickMsg {
  type: 'boss-tick';
  timeRemaining: number;
  bossHp: number;
  bossMaxHp: number;
  // Plugin fields
  phase?: number;
  phaseName?: string;
  shieldActive?: boolean;
  damageReduction?: number;
  bossType?: string;
  invulnUntil?: number;
}

export interface BossRegenMsg {
  type: 'boss-regen';
  regenAmount: number;
  bossHp: number;
  bossMaxHp: number;
}

export interface BossPhaseChangeMsg {
  type: 'boss-phase-change';
  phase: number;
  phaseName: string;
  bossHp: number;
  bossMaxHp: number;
  x: number;
  y: number;
  timeRemaining: number;
}

export interface BossShieldToggleMsg {
  type: 'boss-shield-toggle';
  active: boolean;
}

export interface BossHitBlockedMsg {
  type: 'boss-hit-blocked';
  playerId: string;
  playerColor: string;
  bossHp: number;
  bossMaxHp: number;
  // Plugin fields
  phase?: number;
  phaseName?: string;
  shieldActive?: boolean;
  damageReduction?: number;
  bossType?: string;
  invulnUntil?: number;
}

export interface BossScreenWipeMsg {
  type: 'boss-screen-wipe';
}

export interface MinionsClearedMsg {
  type: 'minions-cleared';
  bugIds: string[];
}

export interface BossDefeatedMsg {
  type: 'boss-defeated';
  score: number;
  level: number;
  players: WirePlayer[];
}

// Shop (in-game)

export interface ShopOpenMsg {
  type: 'shop-open';
  items: ShopItem[];
  playerScores: Record<string, number>;
  duration: number;
  level: number;
  nextLevel: number | 'boss';
}

export interface ShopBuyResultMsg {
  type: 'shop-buy';
  playerId: string;
  playerName: string;
  playerColor: string;
  itemId: string;
  itemName: string;
  itemIcon: string;
  cost: number;
  playerScore: number;
  teamScore: number;
  hp: number;
}

export interface ShopReadyResultMsg {
  type: 'shop-ready';
  playerId: string;
  readyCount: number;
  totalPlayers: number;
}

export interface ShopCloseMsg {
  type: 'shop-close';
}

// Leaderboard & stats

export interface LeaderboardMsg {
  type: 'leaderboard';
  entries: LeaderboardEntry[];
}

export interface MyStatsMsg {
  type: 'my-stats';
  stats: StatsData | null;
}

// Recordings

export interface RecordingsListMsg {
  type: 'recordings-list';
  recordings: RecordingListItem[];
}

export interface RecordingListItem {
  id: number;
  score: number;
  outcome: 'win' | 'loss';
  difficulty: string;
  recorded_at: string | Date;
  duration_ms: number;
  players?: { icon?: string }[];
  share_token?: string | null;
}

export interface RecordingErrorMsg {
  type: 'recording-error';
  message: string;
}

export interface RecordingSharedMsg {
  type: 'recording-shared';
  id: number;
  shareToken: string;
}

export interface RecordingUnsharedMsg {
  type: 'recording-unshared';
  id: number;
}

// Chat

export interface ChatBroadcastMsg {
  type: 'chat-broadcast';
  system: boolean;
  message: string;
  timestamp: number;
  playerId?: string;
  playerName?: string;
  playerIcon?: string;
  playerColor?: string;
}

export interface ChatErrorMsg {
  type: 'chat-error';
  message: string;
}

// Dev

export interface DevErrorMsg {
  type: 'dev-error';
  message: string;
}

// Quests

export interface QuestsDataMsg {
  type: 'quests-data';
  quests: QuestEntry[] | null;
  isGuest: boolean;
  balance?: number;
  dailyResetAt?: string;
}

export interface QuestProgressUpdate {
  questId: number;
  progress: number;
  completed: boolean;
  icon?: string;
  reward?: number;
  newBalance?: number | null;
}

export interface QuestProgressMsg {
  type: 'quest-progress';
  updates: QuestProgressUpdate[];
}

export interface BalanceDataMsg {
  type: 'balance-data';
  balance: number;
}

// Cosmetic shop

export interface ShopCatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: string;
}

export interface ShopCatalogMsg {
  type: 'shop-catalog';
  rotatingItems: ShopCatalogItem[];
  rotationEndUtc: string;
  owned: string[];
  balance: number;
  isNewRotation: boolean;
}

export interface ShopPurchaseResultMsg {
  type: 'shop-purchase-result';
  success: boolean;
  error?: string;
  itemId?: string;
  newBalance?: number;
}

// Roguelike (server → client)

export interface RoguelikeMapMsg {
  type: 'roguelike-map';
  map: RoguelikeMap;
  hp: number;
  score: number;
  players: WirePlayer[];
}

export interface MapViewMsg {
  type: 'map-view';
  currentNodeId: string | null;
  visitedNodeIds: string[];
  availableNodes: string[];
  soloMode: boolean;
  hp: number;
  maxHp: number;
  score: number;
  persistentScoreMultiplier: number;
  activeBuffs: string[];
  eventModifierLabel?: string;
}

export interface MapVoteUpdateMsg {
  type: 'map-vote-update';
  votes: Record<string, string>;
  timeRemaining: number;
}

export interface MapNodeSelectedMsg {
  type: 'map-node-selected';
  nodeId: string;
  nodeType: MapNodeType;
}

// Event nodes

export interface EventShowMsg {
  type: 'event-show';
  event: EventDefinition;
  soloMode: boolean;
}

export interface EventVoteUpdateMsg {
  type: 'event-vote-update';
  votes: Record<string, string>;
  timeRemaining: number;
}

export interface EventResolvedMsg {
  type: 'event-resolved';
  eventId: string;
  chosenOptionId: string;
  hpChange?: number;
  scoreChange?: number;
  newHp?: number;
  newScore?: number;
  modifierSummary?: string;
}

// Rest nodes

export interface RestStartMsg {
  type: 'rest-start';
  restHpGain: number;
  trainScoreBonus: number;
  currentHp: number;
  maxHp: number;
  currentScoreMultiplier: number;
  soloMode: boolean;
}

export interface RestVoteUpdateMsg {
  type: 'rest-vote-update';
  votes: Record<string, string>;
  timeRemaining: number;
}

export interface RestResolvedMsg {
  type: 'rest-resolved';
  chosenOption: 'rest' | 'train';
  hpAfter: number;
  newScoreMultiplier: number;
}

// Elite encounters

export interface EliteStartMsg {
  type: 'elite-start';
  eliteType: string;
  title: string;
  icon: string;
  description: string;
  scoreMultiplier: number;
  waveIndex: number;
  wavesTotal: number;
}

// Mini-boss encounters

export interface MiniBossSpawnMsg {
  type: 'mini-boss-spawn';
  miniBossType: string;
  title: string;
  icon: string;
  description: string;
  timeLimit: number;
  entities: MiniBossEntity[];
}

export interface MiniBossTickMsg {
  type: 'mini-boss-tick';
  timeRemaining: number;
  entities: MiniBossEntity[];
}

export interface MiniBossEntityUpdateMsg {
  type: 'mini-boss-entity-update';
  entities: MiniBossEntity[];
  warning?: string;
}

export interface MiniBossDefeatedMsg {
  type: 'mini-boss-defeated';
  victory: boolean;
  hpChange?: number;
  newHp?: number;
}

// Encounter reward (shared by elite + mini-boss)

export interface EncounterRewardMsg {
  type: 'encounter-reward';
  encounterType: 'elite' | 'mini_boss';
  title: string;
  scoreGained: number;
  freeItem?: { id: string; name: string; icon: string; description: string } | null;
  totalScore: number;
  soloMode: boolean;
}

export type ServerMessage =
  // Connection
  | WelcomeMsg
  | OnlineCountMsg
  | ErrorMsg
  | ValidationErrorMsg
  // Auth
  | AuthResultMsg
  | GuestSessionMsg
  // Lobby
  | LobbyListMsg
  | LobbyCreatedMsg
  | LobbyErrorMsg
  | LobbyJoinedMsg
  | SpectatorJoinedMsg
  | SpectatorCountMsg
  | SpectatorKickedMsg
  | LobbyLeftMsg
  // Players
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | PlayerCursorMsg
  | RoleSelectedMsg
  // Game lifecycle
  | GameStartMsg
  | LevelStartMsg
  | LevelCompleteMsg
  | GameOverMsg
  | GameWinMsg
  | GameResetMsg
  // Bugs
  | BugSpawnedMsg
  | BugWanderMsg
  | BugSquashedMsg
  | BugEscapedMsg
  | BugFleeMsg
  // Feature
  | FeatureSquashedMsg
  | FeatureEscapedMsg
  // Memory Leak
  | MemoryLeakGrowMsg
  | MemoryLeakEscapedMsg
  | MemoryLeakHoldUpdateMsg
  | MemoryLeakClearedMsg
  // Merge Conflict
  | MergeConflictResolvedMsg
  | MergeConflictHalfclickMsg
  | MergeConflictEscapedMsg
  // Pipeline
  | PipelineBugSquashedMsg
  | PipelineChainResolvedMsg
  | PipelineChainResetMsg
  | PipelineChainEscapedMsg
  // Infinite Loop
  | InfiniteLoopSquashedMsg
  | InfiniteLoopMissMsg
  // Azubi
  | AzubiEscapedMsg
  // Powerups — Duck
  | DuckSpawnMsg
  | DuckWanderMsg
  | DuckDespawnMsg
  | DuckCollectedMsg
  | DuckBuffExpiredMsg
  // Powerups — Hammer
  | HammerSpawnMsg
  | HammerDespawnMsg
  | HammerCollectedMsg
  | HammerStunExpiredMsg
  // Boss
  | BossSpawnMsg
  | BossWanderMsg
  | BossHitMsg
  | BossTickMsg
  | BossRegenMsg
  | BossPhaseChangeMsg
  | BossShieldToggleMsg
  | BossHitBlockedMsg
  | BossScreenWipeMsg
  | MinionsClearedMsg
  | BossDefeatedMsg
  // Shop (in-game)
  | ShopOpenMsg
  | ShopBuyResultMsg
  | ShopReadyResultMsg
  | ShopCloseMsg
  // Leaderboard & stats
  | LeaderboardMsg
  | MyStatsMsg
  // Recordings
  | RecordingsListMsg
  | RecordingErrorMsg
  | RecordingSharedMsg
  | RecordingUnsharedMsg
  // Chat
  | ChatBroadcastMsg
  | ChatErrorMsg
  // Dev
  | DevErrorMsg
  // Quests
  | QuestsDataMsg
  | QuestProgressMsg
  | BalanceDataMsg
  // Cosmetic shop
  | ShopCatalogMsg
  | ShopPurchaseResultMsg
  // Roguelike
  | RoguelikeMapMsg
  | MapViewMsg
  | MapVoteUpdateMsg
  | MapNodeSelectedMsg
  // Events
  | EventShowMsg
  | EventVoteUpdateMsg
  | EventResolvedMsg
  // Rest
  | RestStartMsg
  | RestVoteUpdateMsg
  | RestResolvedMsg
  // Elite
  | EliteStartMsg
  // Mini-boss
  | MiniBossSpawnMsg
  | MiniBossTickMsg
  | MiniBossEntityUpdateMsg
  | MiniBossDefeatedMsg
  // Encounter reward
  | EncounterRewardMsg;
