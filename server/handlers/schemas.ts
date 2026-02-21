import { z } from 'zod';
import type { ZodType } from 'zod';

// --- No-payload messages (9) ---

const listLobbiesSchema = z.object({ type: z.literal('list-lobbies') });
const leaveLobbSchema = z.object({ type: z.literal('leave-lobby') });
const startGameSchema = z.object({ type: z.literal('start-game') });
const clickBossSchema = z.object({ type: z.literal('click-boss') });
const clickDuckSchema = z.object({ type: z.literal('click-duck') });
const clickHammerSchema = z.object({ type: z.literal('click-hammer') });
const getLeaderboardSchema = z.object({ type: z.literal('get-leaderboard') });
const getMyStatsSchema = z.object({ type: z.literal('get-my-stats') });
const getRecordingsSchema = z.object({ type: z.literal('get-recordings') });
const getQuestsSchema = z.object({ type: z.literal('get-quests') });
const getBalanceSchema = z.object({ type: z.literal('get-balance') });
const getShopCatalogSchema = z.object({ type: z.literal('get-shop-catalog') });
const shopSeenSchema = z.object({ type: z.literal('shop-seen') });
const shopPurchaseSchema = z.object({
  type: z.literal('shop-purchase'),
  itemId: z.string().max(64),
});

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

// --- Messages with fields (15) ---

const registerSchema = z.object({
  type: z.literal('register'),
  username: z.string().max(16),
  password: z.string().max(64),
  displayName: z.string().max(32),
  icon: z.string().max(64).optional(),
});

const loginSchema = z.object({
  type: z.literal('login'),
  username: z.string().max(16),
  password: z.string().max(64),
});

const logoutSchema = z.object({
  type: z.literal('logout'),
  token: z.string().max(64),
});

const resumeSessionSchema = z.object({
  type: z.literal('resume-session'),
  token: z.string().max(64),
});

const resumeGuestSchema = z.object({
  type: z.literal('resume-guest'),
  token: z.string().max(64).optional(),
});

const setNameSchema = z.object({
  type: z.literal('set-name'),
  name: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
});

const createLobbySchema = z.object({
  type: z.literal('create-lobby'),
  name: z.string().max(32).optional(),
  maxPlayers: z.number().optional(),
  difficulty: z.string().max(16).optional(),
  customConfig: customConfigSchema,
  password: z.string().max(64).optional(),
});

const joinLobbySchema = z.object({
  type: z.literal('join-lobby'),
  lobbyId: z.number(),
  password: z.string().max(64).optional(),
});

const joinLobbyByCodeSchema = z.object({
  type: z.literal('join-lobby-by-code'),
  code: z.string().max(6),
  password: z.string().max(64).optional(),
});

const joinSpectateSchema = z.object({
  type: z.literal('join-spectate'),
  lobbyId: z.number(),
  password: z.string().max(64).optional(),
});

const leaveSpectateSchema = z.object({ type: z.literal('leave-spectate') });

const clickBugSchema = z.object({
  type: z.literal('click-bug'),
  bugId: z.string().max(64),
});

const shareRecordingSchema = z.object({
  type: z.literal('share-recording'),
  id: z.number(),
});

const unshareRecordingSchema = z.object({
  type: z.literal('unshare-recording'),
  id: z.number(),
});

const cursorMoveSchema = z.object({
  type: z.literal('cursor-move'),
  x: z.number().min(0).max(800),
  y: z.number().min(0).max(500),
});

// --- Plugin message schemas (3) ---

const clickBreakpointSchema = z.object({
  type: z.literal('click-breakpoint'),
  bugId: z.string().max(64),
});

const clickMemoryLeakStartSchema = z.object({
  type: z.literal('click-memory-leak-start'),
  bugId: z.string().max(64),
});

const clickMemoryLeakCompleteSchema = z.object({
  type: z.literal('click-memory-leak-complete'),
  bugId: z.string().max(64),
});

// --- Chat messages ---

const chatMessageSchema = z.object({
  type: z.literal('chat-message'),
  message: z.string().min(1).max(200),
});

// --- Role selection ---

const selectRoleSchema = z.object({
  type: z.literal('select-role'),
  role: z.string().max(32).nullable(),
});

// --- Shop messages ---

const shopBuySchema = z.object({
  type: z.literal('shop-buy'),
  itemId: z.string().max(64),
});

const shopReadySchema = z.object({
  type: z.literal('shop-ready'),
});

// --- Dev mode ---

const devCommandSchema = z.object({
  type: z.literal('dev-command'),
  command: z.string().max(32),
  level: z.number().int().min(1).max(3).optional(),
  value: z.number().optional(),
});

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
  'leave-lobby': leaveLobbSchema,
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

// --- Inferred types for future handler opt-in ---

export type RegisterMessage = z.infer<typeof registerSchema>;
export type LoginMessage = z.infer<typeof loginSchema>;
export type LogoutMessage = z.infer<typeof logoutSchema>;
export type ResumeSessionMessage = z.infer<typeof resumeSessionSchema>;
export type SetNameMessage = z.infer<typeof setNameSchema>;
export type CreateLobbyMessage = z.infer<typeof createLobbySchema>;
export type JoinLobbyMessage = z.infer<typeof joinLobbySchema>;
export type JoinLobbyByCodeMessage = z.infer<typeof joinLobbyByCodeSchema>;
export type ClickBugMessage = z.infer<typeof clickBugSchema>;
export type ShareRecordingMessage = z.infer<typeof shareRecordingSchema>;
export type UnshareRecordingMessage = z.infer<typeof unshareRecordingSchema>;
export type CursorMoveMessage = z.infer<typeof cursorMoveSchema>;
export type ClickBreakpointMessage = z.infer<typeof clickBreakpointSchema>;
export type ClickMemoryLeakStartMessage = z.infer<typeof clickMemoryLeakStartSchema>;
export type ClickMemoryLeakCompleteMessage = z.infer<typeof clickMemoryLeakCompleteSchema>;
export type ChatMessageMessage = z.infer<typeof chatMessageSchema>;
export type DevCommandMessage = z.infer<typeof devCommandSchema>;
