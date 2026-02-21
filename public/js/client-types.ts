// Client-side type definitions

export type SendMessageFn = (msg: Record<string, unknown>) => void;

export interface ClientPlayer {
  id: string;
  name: string;
  color: string;
  icon: string;
  score: number;
  bugsSquashed?: number;
  isGuest?: boolean;
  role?: string | null;
  x?: number;
  y?: number;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  icon: string;
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

export interface DifficultyPreset {
  startingHp: number;
  hpDamage: number;
  bugPoints: number;
  boss: {
    hp: number;
    timeLimit: number;
    clickDamage: number;
    killBonus: number;
    regenPerSecond: number;
  };
  specialBugs: {
    heisenbugChance: number;
    codeReviewChance: number;
    mergeConflictChance: number;
    pipelineBugChance: number;
    memoryLeakChance: number;
    infiniteLoopChance: number;
    azubiChance?: number;
  };
  powerups: {
    rubberDuckBuffDuration: number;
    hotfixHammerStunDuration: number;
  };
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

export interface QuestData {
  quests: QuestEntry[];
  balance: number;
  dailyResetAt?: string;
  isGuest?: boolean;
}

export interface RecordingPlayerEntry {
  player_id?: string;
  id?: string;
  name: string;
  icon: string;
  color: string;
  score: number;
}

export interface RecordingEvent {
  t: number;
  msg: Record<string, unknown>;
}

export interface MouseMoveEntry {
  t: number;
  playerId: string;
  x: number;
  y: number;
}

export interface PlaybackRecording {
  id: number;
  duration_ms: number;
  outcome: 'win' | 'loss';
  score: number;
  difficulty: string;
  players?: RecordingPlayerEntry[];
  events: RecordingEvent[];
  mouseMovements?: MouseMoveEntry[];
}

export interface MergeTether {
  svg: SVGSVGElement;
  line: SVGLineElement;
  bug1: string;
  bug2: string;
}

export interface PipelineSegment {
  line: SVGLineElement;
  from: string;
  to: string;
}

export interface PipelineTether {
  svg: SVGSVGElement;
  lines: PipelineSegment[];
  bugIds: string[];
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
}

export interface InfiniteLoopOverlay {
  svg: SVGSVGElement;
  ellipse: SVGEllipseElement;
  breakpoint: HTMLElement;
  variant: BugVariant;
  dashOffset: number;
  dashSpeed: number;
  trailTimer: ReturnType<typeof setInterval> | null;
  rafId?: number;
}

export interface BugElement extends HTMLElement {
  _memoryLeakHandlers?: {
    mousedown: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    mouseleave: (e: MouseEvent) => void;
  };
  _clickHandler?: (e: MouseEvent) => void;
}

export interface ClientState {
  myId: string | null;
  myColor: string | null;
  myIcon: string | null;
  myName: string | null;
  hasJoined: boolean;
  ws: WebSocket | null;
  bugs: Record<string, BugElement>;
  bugPositions: Record<string, { x: number; y: number }>;
  remoteCursors: Record<string, HTMLElement>;
  players: Record<string, ClientPlayer>;
  lastCursorSend: number;
  selectedIcon: string | null;
  currentPhase: string | null;
  bossElement: HTMLElement | null;
  bossHpBarContainer: HTMLElement | null;
  bossPhase: number;
  bossPhaseName: string;
  bossShieldActive: boolean;
  bossType: string | null;
  currentLobbyId: number | null;
  currentLobbyCode: string | null;
  pendingJoinCode: string | null;
  lobbies: LobbyListEntry[];
  authToken: string | null;
  authUser: AuthUser | null;
  isLoggedIn: boolean;
  duckElement: HTMLElement | null;
  hammerElement: HTMLElement | null;
  difficultyPresets: Record<string, DifficultyPreset> | null;
  hasCustomSettings: boolean;
  lobbyCreatorId: string | null;
  questData: QuestData | null;
  byteCoinsBalance: number;
  questTimerInterval: ReturnType<typeof setInterval> | null;
  devMode: boolean;
  isSpectating: boolean;
  isPlayback: boolean;
  playbackTimers: ReturnType<typeof setTimeout>[];
  playbackSpeed: number;
  playbackPaused: boolean;
  playbackRecording: PlaybackRecording | null;
  playbackGameTimeOffset: number;
  playbackWallTimeRef: number;
  // Dynamic properties added at runtime
  mergeTethers?: Record<string, MergeTether>;
  pipelineTethers?: Record<string, PipelineTether>;
  infiniteLoopOverlays?: Record<string, InfiniteLoopOverlay>;
  shopPlayerScore?: number;
  playbackPlayerColors?: Record<string, string> | null;
  playbackMouseTimers?: ReturnType<typeof setTimeout>[];
  pendingLobbyPassword?: string | null;
}

export interface DomRefs {
  arena: HTMLElement | null;
  scoreEl: HTMLElement | null;
  levelEl: HTMLElement | null;
  hpBar: HTMLElement | null;
  playerCountEl: HTMLElement | null;
  connStatus: HTMLElement | null;
  startScreen: HTMLElement | null;
  gameoverScreen: HTMLElement | null;
  winScreen: HTMLElement | null;
  levelScreen: HTMLElement | null;
  bossScreen: HTMLElement | null;
  shopScreen: HTMLElement | null;
  nameEntry: HTMLElement | null;
  nameInput: HTMLInputElement | null;
  iconPicker: HTMLElement | null;
  joinBtn: HTMLElement | null;
  lobbyBrowser: HTMLElement | null;
  lobbyList: HTMLElement | null;
  lobbyNameInput: HTMLInputElement | null;
  lobbyMaxPlayers: HTMLElement | null;
  lobbyPasswordInput: HTMLInputElement | null;
  createLobbyBtn: HTMLElement | null;
  lobbyError: HTMLElement | null;
  authStatus: HTMLElement | null;
  authShowLoginBtn: HTMLElement | null;
  authLogoutBtn: HTMLElement | null;
  authUsername: HTMLElement | null;
  authOverlay: HTMLElement | null;
  authTabs: HTMLElement | null;
  authLoginForm: HTMLElement | null;
  authRegisterForm: HTMLElement | null;
  authError: HTMLElement | null;
  authLoginUsername: HTMLInputElement | null;
  authLoginPassword: HTMLInputElement | null;
  authLoginSubmit: HTMLElement | null;
  authRegUsername: HTMLInputElement | null;
  authRegDisplayName: HTMLInputElement | null;
  authRegPassword: HTMLInputElement | null;
  authRegConfirm: HTMLInputElement | null;
  authRegSubmit: HTMLElement | null;
  authBackBtn: HTMLElement | null;
  lobbyListPanel: HTMLElement | null;
  leaderboardPanel: HTMLElement | null;
  leaderboardList: HTMLElement | null;
  leaderboardTab: HTMLElement | null;
  lobbiesTab: HTMLElement | null;
  liveDashboard: HTMLElement | null;
  replaysPanel: HTMLElement | null;
  replaysList: HTMLElement | null;
  replaysTab: HTMLElement | null;
  playbackControls: HTMLElement | null;
  playbackProgressFill: HTMLElement | null;
  playbackProgressBar: HTMLElement | null;
  playbackTimeCurrent: HTMLElement | null;
  playbackTimeTotal: HTMLElement | null;
  lobbyDifficulty: HTMLElement | null;
  advancedToggleBtn: HTMLElement | null;
  lobbyAdvancedConfig: HTMLElement | null;
  advancedResetBtn: HTMLElement | null;
  configStartingHp: HTMLInputElement | null;
  configHpDamage: HTMLInputElement | null;
  configBugPoints: HTMLInputElement | null;
  configBossHp: HTMLInputElement | null;
  configBossTime: HTMLInputElement | null;
  configBossClickDamage: HTMLInputElement | null;
  configBossKillBonus: HTMLInputElement | null;
  configBossRegen: HTMLInputElement | null;
  configHeisenbug: HTMLInputElement | null;
  configCodeReview: HTMLInputElement | null;
  configMergeConflict: HTMLInputElement | null;
  configPipelineBug: HTMLInputElement | null;
  configMemoryLeak: HTMLInputElement | null;
  configInfiniteLoop: HTMLInputElement | null;
  configAzubi: HTMLInputElement | null;
  toggleHeisenbug: HTMLInputElement | null;
  toggleCodeReview: HTMLInputElement | null;
  toggleMergeConflict: HTMLInputElement | null;
  togglePipelineBug: HTMLInputElement | null;
  toggleMemoryLeak: HTMLInputElement | null;
  toggleInfiniteLoop: HTMLInputElement | null;
  toggleAzubi: HTMLInputElement | null;
  configDuckDuration: HTMLInputElement | null;
  configHammerDuration: HTMLInputElement | null;
  statsCardPanel: HTMLElement | null;
  statsCardTab: HTMLElement | null;
  statsCardPreview: HTMLElement | null;
  statsCardThemes: HTMLElement | null;
  statsCardDownloadBtn: HTMLButtonElement | null;
  lobbyProfileBar: HTMLElement | null;
  lobbyProfileIcon: HTMLElement | null;
  lobbyProfileName: HTMLElement | null;
  lobbyProfileEditBtn: HTMLElement | null;
  lobbyProfileAuth: HTMLElement | null;
  lobbyProfileEditor: HTMLElement | null;
  lobbyEditorIconPicker: HTMLElement | null;
  lobbyEditorNameInput: HTMLInputElement | null;
  lobbyEditorSaveBtn: HTMLElement | null;
  lobbyProfileLoginBtn: HTMLElement | null;
  lobbyProfileLogoutBtn: HTMLElement | null;
  lobbyProfileGuestView: HTMLElement | null;
  lobbyProfileLoggedInView: HTMLElement | null;
  lobbyProfileAuthName: HTMLElement | null;
  spectatorCount: HTMLElement | null;
  spectatorBanner: HTMLElement | null;
  onlineCountEl: HTMLElement | null;
  chatPanel: HTMLElement | null;
  chatMessages: HTMLElement | null;
  chatInput: HTMLInputElement | null;
  chatSendBtn: HTMLButtonElement | null;
  chatToggleBtn: HTMLElement | null;
  chatHandle: HTMLElement | null;
  chatBadge: HTMLElement | null;
  questTracker: HTMLElement | null;
  questTrackerList: HTMLElement | null;
  questTrackerLocked: HTMLElement | null;
  questTrackerTimer: HTMLElement | null;
  qtBalance: HTMLElement | null;
  profileCoinBalance: HTMLElement | null;
  profileCoins: HTMLElement | null;
  shopPanel: HTMLElement | null;
  shopTab: HTMLElement | null;
  questsPanel: HTMLElement | null;
  questsTab: HTMLElement | null;
  shopGrid: HTMLElement | null;
  shopBalanceAmount: HTMLElement | null;
  shopGuestLock: HTMLElement | null;
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

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
}

export interface ActiveBuff {
  itemId: string;
  icon: string;
  name: string;
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

declare global {
  interface Window {
    _buildIconPicker?: () => void;
    _submitJoin?: () => void;
  }
}
