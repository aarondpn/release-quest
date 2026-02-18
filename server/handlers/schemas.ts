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

// --- Messages with fields (15) ---

const registerSchema = z.object({
  type: z.literal('register'),
  username: z.string(),
  password: z.string(),
  displayName: z.string(),
  icon: z.string().optional(),
});

const loginSchema = z.object({
  type: z.literal('login'),
  username: z.string(),
  password: z.string(),
});

const logoutSchema = z.object({
  type: z.literal('logout'),
  token: z.string(),
});

const resumeSessionSchema = z.object({
  type: z.literal('resume-session'),
  token: z.string(),
});

const resumeGuestSchema = z.object({
  type: z.literal('resume-guest'),
  token: z.string().optional(),
});

const setNameSchema = z.object({
  type: z.literal('set-name'),
  name: z.string().optional(),
  icon: z.string().optional(),
});

const createLobbySchema = z.object({
  type: z.literal('create-lobby'),
  name: z.string().optional(),
  maxPlayers: z.number().optional(),
  difficulty: z.string().optional(),
  customConfig: z.record(z.string(), z.unknown()).optional(),
  password: z.string().optional(),
});

const joinLobbySchema = z.object({
  type: z.literal('join-lobby'),
  lobbyId: z.number(),
  password: z.string().optional(),
});

const joinLobbyByCodeSchema = z.object({
  type: z.literal('join-lobby-by-code'),
  code: z.string(),
  password: z.string().optional(),
});

const clickBugSchema = z.object({
  type: z.literal('click-bug'),
  bugId: z.string(),
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
  x: z.number(),
  y: z.number(),
});

// --- Plugin message schemas (3) ---

const clickBreakpointSchema = z.object({
  type: z.literal('click-breakpoint'),
  bugId: z.string(),
});

const clickMemoryLeakStartSchema = z.object({
  type: z.literal('click-memory-leak-start'),
  bugId: z.string(),
});

const clickMemoryLeakCompleteSchema = z.object({
  type: z.literal('click-memory-leak-complete'),
  bugId: z.string(),
});

// --- Chat messages ---

const chatMessageSchema = z.object({
  type: z.literal('chat-message'),
  message: z.string().min(1).max(200),
});

// --- Role selection ---

const selectRoleSchema = z.object({
  type: z.literal('select-role'),
  role: z.string().nullable(),
});

// --- Shop messages ---

const shopBuySchema = z.object({
  type: z.literal('shop-buy'),
  itemId: z.string(),
});

const shopReadySchema = z.object({
  type: z.literal('shop-ready'),
});

// --- Dev mode ---

const devCommandSchema = z.object({
  type: z.literal('dev-command'),
  command: z.string(),
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
