import type { RecordingBuffer, RecordingEvent } from './types.ts';

const buffers = new Map<number, RecordingBuffer>();
// Throttle cursor recording to ~100ms per player
const lastCursorRecord = new Map<string, number>();
const CURSOR_RECORD_INTERVAL = 100;

export function startRecording(lobbyId: number): void {
  buffers.set(lobbyId, { startTime: Date.now(), events: [] });
}

export function recordEvent(lobbyId: number, msg: Record<string, unknown>): void {
  const buf = buffers.get(lobbyId);
  if (!buf) return;
  // Throttle cursor messages to keep recording size reasonable
  if (msg.type === 'player-cursor') {
    const key = `${lobbyId}:${msg.playerId}`;
    const now = Date.now();
    const last = lastCursorRecord.get(key) || 0;
    if (now - last < CURSOR_RECORD_INTERVAL) return;
    lastCursorRecord.set(key, now);
  }
  buf.events.push({ t: Date.now() - buf.startTime, msg });
}

export function stopRecording(lobbyId: number): { duration_ms: number; events: RecordingEvent[] } | null {
  const buf = buffers.get(lobbyId);
  if (!buf) return null;
  buffers.delete(lobbyId);
  // Clean up cursor throttle entries for this lobby
  for (const key of lastCursorRecord.keys()) {
    if (key.startsWith(`${lobbyId}:`)) lastCursorRecord.delete(key);
  }
  return { duration_ms: Date.now() - buf.startTime, events: buf.events };
}
