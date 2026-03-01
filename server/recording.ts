import type { RecordingBuffer, RecordingEvent, MouseMoveEvent } from './types.ts';

const buffers = new Map<number, RecordingBuffer>();

export function startRecording(lobbyId: number): void {
  buffers.set(lobbyId, { startTime: Date.now(), events: [] });
}

export function recordEvent(lobbyId: number, msg: Record<string, unknown>): void {
  const buf = buffers.get(lobbyId);
  if (!buf) return;
  buf.events.push({ t: Date.now() - buf.startTime, msg });
}

export interface StopRecordingResult {
  duration_ms: number;
  events: RecordingEvent[];
  mouseMovements: MouseMoveEvent[];
}

export function stopRecording(lobbyId: number): StopRecordingResult | null {
  const buf = buffers.get(lobbyId);
  if (!buf) return null;
  buffers.delete(lobbyId);

  const events: RecordingEvent[] = [];
  const mouseMovements: MouseMoveEvent[] = [];

  for (const ev of buf.events) {
    if (ev.msg.type === 'player-cursor') {
      mouseMovements.push({
        t: ev.t,
        playerId: String(ev.msg.playerId),
        x: Number(ev.msg.x),
        y: Number(ev.msg.y),
      });
    } else {
      events.push(ev);
    }
  }

  return { duration_ms: Date.now() - buf.startTime, events, mouseMovements };
}
