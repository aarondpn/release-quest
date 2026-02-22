import type { ZodType } from 'zod';
import type { MessageHandler } from './types.ts';
import { staticSchemas } from './schemas.ts';
import { handleRegister, handleLogin, handleLogout, handleResumeSession, handleResumeGuest } from './auth.ts';
import { handleSetName } from './profile.ts';
import { handleListLobbies, handleCreateLobby, handleJoinLobby, handleJoinLobbyByCode, handleLeaveLobby, handleJoinSpectate, handleLeaveSpectate } from './lobby.ts';
import { handleStartGame } from './game.ts';
import { handleClickBug, handleClickBoss } from './bugs.ts';
import { handleClickDuck, handleClickHammer } from './powerups.ts';
import { handleGetLeaderboard, handleGetMyStats, handleGetRecordings, handleShareRecording, handleUnshareRecording } from './stats.ts';
import { handleCursorMove } from './cursor.ts';
import { handleChatMessage } from './chat.ts';
import { handleShopBuy, handleShopReady } from './shop.ts';
import { handleDevCommand } from './dev.ts';
import { handleSelectRole } from './role.ts';
import { handleGetQuests, handleGetBalance } from './quests.ts';
import { handleGetShopCatalog, handleShopPurchase, handleShopSeen } from './cosmetic-shop.ts';
import { handleMapVote, handleEventVote, handleRestVote } from './roguelike.ts';
import { getHandlers as getPluginHandlers, getSchemas as getPluginSchemas } from '../entity-types/index.ts';
import { getBossHandlers, getBossSchemas } from '../boss-types/index.ts';

const staticHandlers: Record<string, MessageHandler> = {
  'register': handleRegister,
  'login': handleLogin,
  'logout': handleLogout,
  'resume-session': handleResumeSession,
  'resume-guest': handleResumeGuest,
  'set-name': handleSetName,
  'list-lobbies': handleListLobbies,
  'create-lobby': handleCreateLobby,
  'join-lobby': handleJoinLobby,
  'join-lobby-by-code': handleJoinLobbyByCode,
  'leave-lobby': handleLeaveLobby,
  'join-spectate': handleJoinSpectate,
  'leave-spectate': handleLeaveSpectate,
  'start-game': handleStartGame,
  'click-bug': handleClickBug,
  'click-boss': handleClickBoss,
  'click-duck': handleClickDuck,
  'click-hammer': handleClickHammer,
  'get-leaderboard': handleGetLeaderboard,
  'get-my-stats': handleGetMyStats,
  'get-recordings': handleGetRecordings,
  'share-recording': handleShareRecording,
  'unshare-recording': handleUnshareRecording,
  'cursor-move': handleCursorMove,
  'chat-message': handleChatMessage,
  'shop-buy': handleShopBuy,
  'shop-ready': handleShopReady,
  'dev-command': handleDevCommand,
  'select-role': handleSelectRole,
  'get-quests': handleGetQuests,
  'get-balance': handleGetBalance,
  'get-shop-catalog': handleGetShopCatalog,
  'shop-purchase': handleShopPurchase,
  'shop-seen': handleShopSeen,
  'map-vote': handleMapVote,
  'event-vote': handleEventVote,
  'rest-vote': handleRestVote,
};

export const handlers: Record<string, MessageHandler> = {
  ...staticHandlers,
  ...getPluginHandlers(),
  ...getBossHandlers(),
};

export const schemas: Record<string, ZodType> = {
  ...staticSchemas,
  ...getPluginSchemas(),
  ...getBossSchemas(),
};
