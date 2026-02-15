import type { HandlerContext, MessageHandler } from './types.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';

export const handleGetLeaderboard: MessageHandler = ({ ws }) => {
  db.getLeaderboard(10).then(entries => {
    network.send(ws, { type: 'leaderboard', entries });
  }).catch(() => {
    network.send(ws, { type: 'leaderboard', entries: [] });
  });
};

export const handleGetMyStats: MessageHandler = ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'my-stats', stats: null });
    return;
  }
  db.getUserStats(info.userId).then(stats => {
    network.send(ws, { type: 'my-stats', stats });
  }).catch(() => {
    network.send(ws, { type: 'my-stats', stats: null });
  });
};

export const handleGetRecordings: MessageHandler = ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'recordings-list', recordings: [] });
    return;
  }
  db.getRecordingsList(info.userId).then(recordings => {
    network.send(ws, { type: 'recordings-list', recordings });
  }).catch(() => {
    network.send(ws, { type: 'recording-error', message: 'Failed to load recordings' });
  });
};

export const handleShareRecording: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'recording-error', message: 'Not logged in' });
    return;
  }
  const recordingId = parseInt(msg.id, 10);
  if (!recordingId) {
    network.send(ws, { type: 'recording-error', message: 'Invalid recording ID' });
    return;
  }
  db.shareRecording(recordingId, info.userId).then(shareToken => {
    if (!shareToken) {
      network.send(ws, { type: 'recording-error', message: 'Recording not found' });
      return;
    }
    network.send(ws, { type: 'recording-shared', id: recordingId, shareToken });
  }).catch(() => {
    network.send(ws, { type: 'recording-error', message: 'Failed to share recording' });
  });
};

export const handleUnshareRecording: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'recording-error', message: 'Not logged in' });
    return;
  }
  const recordingId = parseInt(msg.id, 10);
  if (!recordingId) {
    network.send(ws, { type: 'recording-error', message: 'Invalid recording ID' });
    return;
  }
  db.unshareRecording(recordingId, info.userId).then(success => {
    if (!success) {
      network.send(ws, { type: 'recording-error', message: 'Recording not found or not shared' });
      return;
    }
    network.send(ws, { type: 'recording-unshared', id: recordingId });
  }).catch(() => {
    network.send(ws, { type: 'recording-error', message: 'Failed to unshare recording' });
  });
};
