import type { MessageHandler } from './types.ts';
import { handleRegister, handleLogin, handleLogout, handleResumeSession } from './auth.ts';
import { handleSetName } from './profile.ts';
import { handleListLobbies, handleCreateLobby, handleJoinLobby, handleJoinLobbyByCode, handleLeaveLobby } from './lobby.ts';
import { handleStartGame } from './game.ts';
import { handleClickBug, handleClickBreakpoint, handleClickMemoryLeakStart, handleClickMemoryLeakComplete, handleClickBoss } from './bugs.ts';
import { handleClickDuck, handleClickHammer } from './powerups.ts';
import { handleGetLeaderboard, handleGetMyStats, handleGetRecordings, handleShareRecording, handleUnshareRecording } from './stats.ts';
import { handleCursorMove } from './cursor.ts';

export const handlers: Record<string, MessageHandler> = {
  'register': handleRegister,
  'login': handleLogin,
  'logout': handleLogout,
  'resume-session': handleResumeSession,
  'set-name': handleSetName,
  'list-lobbies': handleListLobbies,
  'create-lobby': handleCreateLobby,
  'join-lobby': handleJoinLobby,
  'join-lobby-by-code': handleJoinLobbyByCode,
  'leave-lobby': handleLeaveLobby,
  'start-game': handleStartGame,
  'click-bug': handleClickBug,
  'click-breakpoint': handleClickBreakpoint,
  'click-memory-leak-start': handleClickMemoryLeakStart,
  'click-memory-leak-complete': handleClickMemoryLeakComplete,
  'click-boss': handleClickBoss,
  'click-duck': handleClickDuck,
  'click-hammer': handleClickHammer,
  'get-leaderboard': handleGetLeaderboard,
  'get-my-stats': handleGetMyStats,
  'get-recordings': handleGetRecordings,
  'share-recording': handleShareRecording,
  'unshare-recording': handleUnshareRecording,
  'cursor-move': handleCursorMove,
};
