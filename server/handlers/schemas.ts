import { z } from 'zod';
import type { ZodType } from 'zod';
import type {
  RegisterMsg, LoginMsg, LogoutMsg, ResumeSessionMsg, ResumeGuestMsg,
  SetNameMsg, ListLobbiesMsg, CreateLobbyMsg, JoinLobbyMsg, JoinLobbyByCodeMsg,
  LeaveLobbyMsg, JoinSpectateMsg, LeaveSpectateMsg, StartGameMsg,
  ClickBugMsg, ClickBossMsg, ClickDuckMsg, ClickHammerMsg, CursorMoveMsg,
  ClickBreakpointMsg, ClickMemoryLeakStartMsg, ClickMemoryLeakCompleteMsg,
  ShopBuyMsg, ShopReadyMsg, SelectRoleMsg, ChatMessageMsg,
  GetLeaderboardMsg, GetMyStatsMsg, GetRecordingsMsg,
  ShareRecordingMsg, UnshareRecordingMsg, GetQuestsMsg, GetBalanceMsg,
  GetShopCatalogMsg, ShopSeenMsg, ShopPurchaseMsg, DevCommandMsg,
} from '../../shared/messages.ts';

// --- No-payload messages ---

const listLobbiesSchema = z.object({ type: z.literal('list-lobbies') }) satisfies ZodType<ListLobbiesMsg>;
const leaveLobbySchema = z.object({ type: z.literal('leave-lobby') }) satisfies ZodType<LeaveLobbyMsg>;
const startGameSchema = z.object({ type: z.literal('start-game') }) satisfies ZodType<StartGameMsg>;
const clickBossSchema = z.object({ type: z.literal('click-boss') }) satisfies ZodType<ClickBossMsg>;
const clickDuckSchema = z.object({ type: z.literal('click-duck') }) satisfies ZodType<ClickDuckMsg>;
const clickHammerSchema = z.object({ type: z.literal('click-hammer') }) satisfies ZodType<ClickHammerMsg>;
const getLeaderboardSchema = z.object({ type: z.literal('get-leaderboard') }) satisfies ZodType<GetLeaderboardMsg>;
const getMyStatsSchema = z.object({ type: z.literal('get-my-stats') }) satisfies ZodType<GetMyStatsMsg>;
const getRecordingsSchema = z.object({ type: z.literal('get-recordings') }) satisfies ZodType<GetRecordingsMsg>;
const getQuestsSchema = z.object({ type: z.literal('get-quests') }) satisfies ZodType<GetQuestsMsg>;
const getBalanceSchema = z.object({ type: z.literal('get-balance') }) satisfies ZodType<GetBalanceMsg>;
const getShopCatalogSchema = z.object({ type: z.literal('get-shop-catalog') }) satisfies ZodType<GetShopCatalogMsg>;
const shopSeenSchema = z.object({ type: z.literal('shop-seen') }) satisfies ZodType<ShopSeenMsg>;
const shopPurchaseSchema = z.object({
  type: z.literal('shop-purchase'),
  itemId: z.string().max(64),
}) satisfies ZodType<ShopPurchaseMsg>;

const leaveSpectateSchema = z.object({ type: z.literal('leave-spectate') }) satisfies ZodType<LeaveSpectateMsg>;
const shopReadySchema = z.object({ type: z.literal('shop-ready') }) satisfies ZodType<ShopReadyMsg>;

// --- Custom config sub-schema (used by create-lobby) ---

const customConfigSchema = z.object({
  startingHp: z.number().int().min(1).max(150).optional(),
  hpDamage: z.number().int().min(0).max(50).optional(),
  bugPoints: z.number().int().min(0).max(100).optional(),
  scoreMultiplier: z.number().min(0.1).max(10).optional(),
  levels: z.record(z.string(), z.object({
    bugsTotal: z.number().int().min(1).max(100).optional(),
    escapeTime: z.number().int().min(1000).max(30000).optional(),
    spawnRate: z.number().int().min(500).max(10000).optional(),
    maxOnScreen: z.number().int().min(1).max(100).optional(),
  })).optional(),
  boss: z.object({
    hp: z.number().int().min(1).max(10000).optional(),
    clickDamage: z.number().int().min(1).max(100).optional(),
    clickPoints: z.number().int().min(0).max(100).optional(),
    killBonus: z.number().int().min(0).max(10000).optional(),
    wanderInterval: z.number().int().min(500).max(10000).optional(),
    minionSpawnRate: z.number().int().min(500).max(30000).optional(),
    minionEscapeTime: z.number().int().min(1000).max(30000).optional(),
    minionMaxOnScreen: z.number().int().min(1).max(50).optional(),
    clickCooldownMs: z.number().int().min(0).max(5000).optional(),
    regenPerSecond: z.number().min(0).max(100).optional(),
    timeLimit: z.number().int().min(30).max(600).optional(),
  }).optional(),
  specialBugs: z.object({
    heisenbugChance: z.number().min(0).max(1).optional(),
    codeReviewChance: z.number().min(0).max(1).optional(),
    codeReviewStartLevel: z.number().int().min(1).max(3).optional(),
    mergeConflictChance: z.number().min(0).max(1).optional(),
    pipelineBugChance: z.number().min(0).max(1).optional(),
    pipelineBugStartLevel: z.number().int().min(1).max(3).optional(),
    memoryLeakChance: z.number().min(0).max(1).optional(),
    infiniteLoopChance: z.number().min(0).max(1).optional(),
    infiniteLoopStartLevel: z.number().int().min(1).max(3).optional(),
    azubiChance: z.number().min(0).max(1).optional(),
    azubiStartLevel: z.number().int().min(1).max(3).optional(),
    azubiSpawnInterval: z.number().int().min(500).max(30000).optional(),
    azubiFeatureChance: z.number().min(0).max(1).optional(),
  }).optional(),
  shop: z.object({
    duration: z.number().int().min(5000).max(60000).optional(),
  }).optional(),
  powerups: z.object({
    rubberDuckIntervalMin: z.number().int().min(5000).max(120000).optional(),
    rubberDuckIntervalMax: z.number().int().min(5000).max(120000).optional(),
    rubberDuckBuffDuration: z.number().int().min(1000).max(30000).optional(),
    rubberDuckWanderInterval: z.number().int().min(500).max(10000).optional(),
    rubberDuckDespawnTime: z.number().int().min(1000).max(30000).optional(),
    rubberDuckPoints: z.number().int().min(0).max(1000).optional(),
    rubberDuckPointsMultiplier: z.number().min(0.1).max(10).optional(),
    hotfixHammerIntervalMin: z.number().int().min(5000).max(120000).optional(),
    hotfixHammerIntervalMax: z.number().int().min(5000).max(120000).optional(),
    hotfixHammerStunDuration: z.number().int().min(500).max(10000).optional(),
    hotfixHammerDespawnTime: z.number().int().min(1000).max(30000).optional(),
    hotfixHammerPoints: z.number().int().min(0).max(1000).optional(),
  }).optional(),
}).optional();

// --- Messages with fields ---

const registerSchema = z.object({
  type: z.literal('register'),
  username: z.string().max(16),
  password: z.string().max(64),
  displayName: z.string().max(32),
  icon: z.string().max(64).optional(),
}) satisfies ZodType<RegisterMsg>;

const loginSchema = z.object({
  type: z.literal('login'),
  username: z.string().max(16),
  password: z.string().max(64),
}) satisfies ZodType<LoginMsg>;

const logoutSchema = z.object({
  type: z.literal('logout'),
  token: z.string().max(64),
}) satisfies ZodType<LogoutMsg>;

const resumeSessionSchema = z.object({
  type: z.literal('resume-session'),
  token: z.string().max(64),
}) satisfies ZodType<ResumeSessionMsg>;

const resumeGuestSchema = z.object({
  type: z.literal('resume-guest'),
  token: z.string().max(64).optional(),
}) satisfies ZodType<ResumeGuestMsg>;

const setNameSchema = z.object({
  type: z.literal('set-name'),
  name: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
}) satisfies ZodType<SetNameMsg>;

const createLobbySchema = z.object({
  type: z.literal('create-lobby'),
  name: z.string().max(32).optional(),
  maxPlayers: z.number().optional(),
  difficulty: z.string().max(16).optional(),
  customConfig: customConfigSchema,
  password: z.string().max(64).optional(),
}) satisfies ZodType<CreateLobbyMsg>;

const joinLobbySchema = z.object({
  type: z.literal('join-lobby'),
  lobbyId: z.number(),
  password: z.string().max(64).optional(),
}) satisfies ZodType<JoinLobbyMsg>;

const joinLobbyByCodeSchema = z.object({
  type: z.literal('join-lobby-by-code'),
  code: z.string().max(6),
  password: z.string().max(64).optional(),
}) satisfies ZodType<JoinLobbyByCodeMsg>;

const joinSpectateSchema = z.object({
  type: z.literal('join-spectate'),
  lobbyId: z.number(),
  password: z.string().max(64).optional(),
}) satisfies ZodType<JoinSpectateMsg>;

const clickBugSchema = z.object({
  type: z.literal('click-bug'),
  bugId: z.string().max(64),
}) satisfies ZodType<ClickBugMsg>;

const shareRecordingSchema = z.object({
  type: z.literal('share-recording'),
  id: z.number(),
}) satisfies ZodType<ShareRecordingMsg>;

const unshareRecordingSchema = z.object({
  type: z.literal('unshare-recording'),
  id: z.number(),
}) satisfies ZodType<UnshareRecordingMsg>;

const cursorMoveSchema = z.object({
  type: z.literal('cursor-move'),
  x: z.number().min(0).max(800),
  y: z.number().min(0).max(500),
}) satisfies ZodType<CursorMoveMsg>;

// --- Plugin message schemas ---

const clickBreakpointSchema = z.object({
  type: z.literal('click-breakpoint'),
  bugId: z.string().max(64),
}) satisfies ZodType<ClickBreakpointMsg>;

const clickMemoryLeakStartSchema = z.object({
  type: z.literal('click-memory-leak-start'),
  bugId: z.string().max(64),
}) satisfies ZodType<ClickMemoryLeakStartMsg>;

const clickMemoryLeakCompleteSchema = z.object({
  type: z.literal('click-memory-leak-complete'),
  bugId: z.string().max(64),
}) satisfies ZodType<ClickMemoryLeakCompleteMsg>;

// --- Chat ---

const chatMessageSchema = z.object({
  type: z.literal('chat-message'),
  message: z.string().min(1).max(200),
}) satisfies ZodType<ChatMessageMsg>;

// --- Role selection ---

const selectRoleSchema = z.object({
  type: z.literal('select-role'),
  role: z.string().max(32).nullable(),
}) satisfies ZodType<SelectRoleMsg>;

// --- Shop (in-game) ---

const shopBuySchema = z.object({
  type: z.literal('shop-buy'),
  itemId: z.string().max(64),
}) satisfies ZodType<ShopBuyMsg>;

// --- Dev mode ---

const devCommandSchema = z.object({
  type: z.literal('dev-command'),
  command: z.string().max(32),
  level: z.number().int().min(1).max(3).optional(),
  value: z.number().optional(),
}) satisfies ZodType<DevCommandMsg>;

// --- Registry ---

export const staticSchemas: Record<string, ZodType> = {
  'register': registerSchema,
  'login': loginSchema,
  'logout': logoutSchema,
  'resume-session': resumeSessionSchema,
  'resume-guest': resumeGuestSchema,
  'set-name': setNameSchema,
  'list-lobbies': listLobbiesSchema,
  'create-lobby': createLobbySchema,
  'join-lobby': joinLobbySchema,
  'join-lobby-by-code': joinLobbyByCodeSchema,
  'leave-lobby': leaveLobbySchema,
  'join-spectate': joinSpectateSchema,
  'leave-spectate': leaveSpectateSchema,
  'start-game': startGameSchema,
  'click-bug': clickBugSchema,
  'click-boss': clickBossSchema,
  'click-duck': clickDuckSchema,
  'click-hammer': clickHammerSchema,
  'get-leaderboard': getLeaderboardSchema,
  'get-my-stats': getMyStatsSchema,
  'get-recordings': getRecordingsSchema,
  'share-recording': shareRecordingSchema,
  'unshare-recording': unshareRecordingSchema,
  'cursor-move': cursorMoveSchema,
  'click-breakpoint': clickBreakpointSchema,
  'click-memory-leak-start': clickMemoryLeakStartSchema,
  'click-memory-leak-complete': clickMemoryLeakCompleteSchema,
  'chat-message': chatMessageSchema,
  'shop-buy': shopBuySchema,
  'shop-ready': shopReadySchema,
  'dev-command': devCommandSchema,
  'select-role': selectRoleSchema,
  'get-quests': getQuestsSchema,
  'get-balance': getBalanceSchema,
  'get-shop-catalog': getShopCatalogSchema,
  'shop-seen': shopSeenSchema,
  'shop-purchase': shopPurchaseSchema,
};
