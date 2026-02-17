import express from 'express';
import type { Request, Response } from 'express';
import { DIFFICULTY_PRESETS, DEV_MODE } from './config.ts';
import { HEISENBUG_MECHANICS } from './entity-types/heisenbug.ts';
import { MEMORY_LEAK_MECHANICS } from './entity-types/memory-leak.ts';
import { MERGE_CONFLICT_MECHANICS } from './entity-types/merge-conflict.ts';
import { PIPELINE_BUG_MECHANICS } from './entity-types/pipeline.ts';
import { INFINITE_LOOP_MECHANICS } from './entity-types/infinite-loop.ts';
import { CODE_REVIEW_MECHANICS } from './entity-types/feature.ts';
import * as db from './db.ts';
import * as auth from './auth.ts';
import { asyncHandler, NotFoundError, UnauthorizedError, BadRequestError } from './utils.ts';
import type { RecordingRow } from './types.ts';

const router = express.Router();

// Helper to format recording data for client
function formatRecordingForClient(recording: RecordingRow) {
  const events = (recording.events || []).map(ev => ({
    t: ev.t,
    msg: ev.data,
  }));
  const mouseMovements = (recording.mouseMovements || []).map(mm => ({
    t: mm.t,
    playerId: mm.player_id,
    x: mm.x,
    y: mm.y,
  }));
  return {
    id: recording.id,
    recorded_at: recording.recorded_at,
    duration_ms: recording.duration_ms,
    outcome: recording.outcome,
    score: recording.score,
    difficulty: recording.difficulty,
    player_count: recording.player_count,
    players: recording.players,
    events,
    mouseMovements,
  };
}

// ── API Routes ──

// Dev mode check
router.get('/dev-mode', (_req: Request, res: Response) => {
  res.json({ enabled: DEV_MODE });
});

// Get difficulty presets
router.get('/difficulty-presets', (req: Request, res: Response) => {
  res.json(DIFFICULTY_PRESETS);
});

// Get full wiki config (difficulty presets + entity mechanics)
router.get('/wiki-config', (req: Request, res: Response) => {
  res.json({
    difficulties: DIFFICULTY_PRESETS,
    mechanics: {
      heisenbug: HEISENBUG_MECHANICS,
      memoryLeak: MEMORY_LEAK_MECHANICS,
      mergeConflict: MERGE_CONFLICT_MECHANICS,
      pipeline: PIPELINE_BUG_MECHANICS,
      infiniteLoop: INFINITE_LOOP_MECHANICS,
      feature: CODE_REVIEW_MECHANICS,
      bossHpPerExtraPlayer: 150,
      bossRegenPerExtraPlayer: 1,
    },
  });
});

// Get shared replay by token (no auth required)
router.get('/replay/:token', asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.params.token);
  
  if (!/^[a-f0-9]{32}$/.test(token)) {
    throw new NotFoundError('Recording not found');
  }
  
  const recording = await db.getRecordingByToken(token);
  if (!recording) {
    throw new NotFoundError('Recording not found');
  }
  
  res.json(formatRecordingForClient(recording));
}));

// Get private recording by ID (requires auth)
router.get('/recording/:id', asyncHandler(async (req: Request, res: Response) => {
  const recordingId = parseInt(String(req.params.id), 10);
  
  if (!recordingId || isNaN(recordingId)) {
    throw new BadRequestError('Invalid recording ID');
  }
  
  const sessionToken = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!sessionToken) {
    throw new UnauthorizedError();
  }
  
  const user = await auth.validateSession(sessionToken);
  if (!user) {
    throw new UnauthorizedError();
  }
  
  const recording = await db.getRecording(recordingId, user.id);
  if (!recording) {
    throw new NotFoundError('Recording not found');
  }
  
  res.json(formatRecordingForClient(recording));
}));

export default router;
