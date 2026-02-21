import { dom, clientState } from './state.ts';
import { updateHUD, updatePlayerCount, hideAllScreens, hideLiveDashboard, showGameOverScreen, showWinScreen } from './hud.ts';
import { clearAllBugs } from './bugs.ts';
import { removeBossElement } from './boss.ts';
import { addRemoteCursor, clearRemoteCursors } from './players.ts';
import { removeDuckBuffOverlay } from './vfx.ts';
import { showLobbyBrowser } from './lobby-ui.ts';
import { handleMessageInternal } from './network.ts';
import type { PlaybackRecording } from './client-types.ts';

let progressRafId: number | null = null;
let progressBarClickBound = false;
let playbackEnded = false;

function formatPlaybackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

function getPlaybackDuration(): number {
  const recording = clientState.playbackRecording;
  if (!recording) return 0;
  return recording.duration_ms || 0;
}

function updateProgressBar(): void {
  const duration = getPlaybackDuration();
  const gameTime = getCurrentGameTime();
  const progress = duration > 0 ? Math.min(gameTime / duration, 1) : 0;

  if (dom.playbackProgressFill) {
    dom.playbackProgressFill.style.width = (progress * 100) + '%';
  }
  if (dom.playbackTimeCurrent) {
    dom.playbackTimeCurrent.textContent = formatPlaybackTime(Math.min(gameTime, duration));
  }
  if (dom.playbackTimeTotal) {
    dom.playbackTimeTotal.textContent = formatPlaybackTime(duration);
  }

  if (!playbackEnded && duration > 0 && gameTime >= duration) {
    playbackEnded = true;
    const recording = clientState.playbackRecording;
    if (recording) {
      const players = Object.values(clientState.players).map(p => ({
        id: p.id, name: p.name, icon: p.icon, color: p.color, score: p.score, bugsSquashed: p.bugsSquashed || 0, isGuest: false as const,
      }));
      if (recording.outcome === 'win') {
        showWinScreen(recording.score, players);
      } else {
        showGameOverScreen(recording.score, 3, players);
      }
    }
  }
}

function startProgressLoop(): void {
  stopProgressLoop();
  function tick(): void {
    if (!clientState.isPlayback) return;
    updateProgressBar();
    progressRafId = requestAnimationFrame(tick);
  }
  progressRafId = requestAnimationFrame(tick);
}

function stopProgressLoop(): void {
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId);
    progressRafId = null;
  }
}

function initProgressBarClick(): void {
  if (!dom.playbackProgressBar || progressBarClickBound) return;
  progressBarClickBound = true;
  dom.playbackProgressBar.addEventListener('click', (e: MouseEvent) => {
    if (!clientState.isPlayback) return;
    const rect = dom.playbackProgressBar!.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = getPlaybackDuration();
    const targetTime = ratio * duration;
    seekTo(targetTime);
  });
}

function seekTo(targetTime: number): void {
  playbackEnded = false;
  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  updateHUD(0, 1, 100);

  const recording = clientState.playbackRecording;
  if (recording) {
    const gameStartEvent = recording.events.find(e => e.msg.type === 'game-start');
    if (gameStartEvent && gameStartEvent.msg.players) {
      (gameStartEvent.msg.players as any[]).forEach((p: any) => {
        addRemoteCursor(p.id, p.name, p.color, p.icon);
      });
    }
  }

  if (recording && recording.events) {
    for (const event of recording.events) {
      if (event.t <= targetTime) {
        handleMessageInternal(event.msg);
      }
    }
  }

  clientState.playbackGameTimeOffset = targetTime;
  clientState.playbackWallTimeRef = Date.now();

  if (!clientState.playbackPaused) {
    rescheduleFrom(targetTime);
  }

  updateProgressBar();
}

export function startPlayback(recording: PlaybackRecording): void {
  clientState.isPlayback = true;
  clientState.playbackRecording = recording;
  clientState.playbackSpeed = 1;
  clientState.playbackPaused = false;
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];
  playbackEnded = false;
  clientState.myId = null;

  const playerColorMap: Record<string, string> = {};
  if (recording.players) {
    recording.players.forEach(p => {
      const id = p.player_id || p.id || ('replay_player_' + p.name);
      playerColorMap[id] = p.color;
    });
  }

  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  hideLiveDashboard();
  updateHUD(0, 1, 100);

  clientState.players = {};
  const gameStartEvent = recording.events.find(e => e.msg.type === 'game-start');
  if (gameStartEvent && gameStartEvent.msg.players) {
    (gameStartEvent.msg.players as any[]).forEach((p: any) => {
      clientState.players[p.id] = { id: p.id, name: p.name || 'Player', icon: p.icon || '', color: p.color || '#4ecdc4', score: 0 };
      playerColorMap[p.id] = p.color;
      addRemoteCursor(p.id, p.name, p.color, p.icon);
    });
  } else if (recording.players) {
    recording.players.forEach((p, i) => {
      const id = p.player_id || ('replay_player_' + i);
      clientState.players[id] = { id, name: p.name, icon: p.icon, color: p.color, score: 0 };
      playerColorMap[id] = p.color;
      addRemoteCursor(id, p.name, p.color, p.icon);
    });
  }
  clientState.playbackPlayerColors = playerColorMap;

  updatePlayerCount();

  document.getElementById('lobby-browser')!.classList.add('hidden');
  document.getElementById('hud-leave-btn')!.classList.remove('hidden');

  if (dom.playbackControls) {
    dom.playbackControls.classList.remove('hidden');
    const speedBtn = dom.playbackControls.querySelector<HTMLElement>('.playback-speed-btn');
    if (speedBtn) speedBtn.textContent = '1x';
    const pauseBtn = dom.playbackControls.querySelector<HTMLElement>('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u275A\u275A';
  }

  clientState.playbackGameTimeOffset = 0;
  clientState.playbackWallTimeRef = Date.now();

  if (dom.playbackTimeTotal) {
    dom.playbackTimeTotal.textContent = formatPlaybackTime(getPlaybackDuration());
  }
  if (dom.playbackTimeCurrent) {
    dom.playbackTimeCurrent.textContent = '0:00';
  }
  if (dom.playbackProgressFill) {
    dom.playbackProgressFill.style.width = '0%';
  }
  initProgressBarClick();
  startProgressLoop();

  scheduleEvents(recording.events);
  scheduleMouseMoves(recording.mouseMovements || []);
}

function scheduleEvents(events: PlaybackRecording['events']): void {
  for (const event of events) {
    const delay = event.t / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback) return;
      handleMessageInternal(event.msg);
    }, delay);
    clientState.playbackTimers.push(timerId);
  }
}

function scheduleMouseMoves(mouseMovements: NonNullable<PlaybackRecording['mouseMovements']>): void {
  for (const mm of mouseMovements) {
    const delay = mm.t / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback) return;
      handleMessageInternal({ type: 'player-cursor', playerId: mm.playerId, x: mm.x, y: mm.y });
    }, delay);
    clientState.playbackMouseTimers!.push(timerId);
  }
}

export function stopPlayback(): void {
  for (const t of clientState.playbackTimers) clearTimeout(t);
  for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];

  clientState.isPlayback = false;
  clientState.playbackRecording = null;
  clientState.playbackPaused = false;
  clientState.playbackSpeed = 1;
  clientState.playbackPlayerColors = null;

  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  hideLiveDashboard();
  updateHUD(0, 1, 100);
  clientState.players = {};

  stopProgressLoop();
  if (dom.playbackProgressFill) dom.playbackProgressFill.style.width = '0%';
  if (dom.playbackTimeCurrent) dom.playbackTimeCurrent.textContent = '0:00';
  if (dom.playbackTimeTotal) dom.playbackTimeTotal.textContent = '0:00';

  if (dom.playbackControls) dom.playbackControls.classList.add('hidden');
  document.getElementById('hud-leave-btn')!.classList.add('hidden');

  if (new URLSearchParams(location.search).has('replay')) {
    history.replaceState(null, '', location.pathname);
  }

  showLobbyBrowser();
}

function getCurrentGameTime(): number {
  return clientState.playbackGameTimeOffset +
    (Date.now() - clientState.playbackWallTimeRef) * clientState.playbackSpeed;
}

function rescheduleFrom(gameTime: number): void {
  for (const t of clientState.playbackTimers) clearTimeout(t);
  for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];

  const recording = clientState.playbackRecording;
  if (!recording) return;

  for (const event of recording.events) {
    if (event.t <= gameTime) continue;
    const delay = (event.t - gameTime) / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback || clientState.playbackPaused) return;
      handleMessageInternal(event.msg);
    }, delay);
    clientState.playbackTimers.push(timerId);
  }

  const mouseMovements = recording.mouseMovements || [];
  for (const mm of mouseMovements) {
    if (mm.t <= gameTime) continue;
    const delay = (mm.t - gameTime) / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback || clientState.playbackPaused) return;
      handleMessageInternal({ type: 'player-cursor', playerId: mm.playerId, x: mm.x, y: mm.y });
    }, delay);
    clientState.playbackMouseTimers!.push(timerId);
  }
}

export function togglePause(): void {
  if (!clientState.isPlayback) return;

  if (clientState.playbackPaused) {
    clientState.playbackPaused = false;
    clientState.playbackWallTimeRef = Date.now();
    rescheduleFrom(clientState.playbackGameTimeOffset);
    startProgressLoop();

    const pauseBtn = dom.playbackControls?.querySelector<HTMLElement>('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u275A\u275A';
  } else {
    clientState.playbackGameTimeOffset = getCurrentGameTime();
    for (const t of clientState.playbackTimers) clearTimeout(t);
    for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
    clientState.playbackTimers = [];
    clientState.playbackMouseTimers = [];
    clientState.playbackPaused = true;
    stopProgressLoop();
    updateProgressBar();

    const pauseBtn = dom.playbackControls?.querySelector<HTMLElement>('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u25B6';
  }
}

export function cycleSpeed(): void {
  if (!clientState.isPlayback) return;

  if (!clientState.playbackPaused) {
    clientState.playbackGameTimeOffset = getCurrentGameTime();
    clientState.playbackWallTimeRef = Date.now();
  }

  const speeds = [0.5, 1, 2, 4];
  const currentIdx = speeds.indexOf(clientState.playbackSpeed);
  clientState.playbackSpeed = speeds[(currentIdx + 1) % speeds.length];

  const speedBtn = dom.playbackControls?.querySelector<HTMLElement>('.playback-speed-btn');
  if (speedBtn) speedBtn.textContent = clientState.playbackSpeed + 'x';

  if (!clientState.playbackPaused) {
    for (const t of clientState.playbackTimers) clearTimeout(t);
    for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
    rescheduleFrom(clientState.playbackGameTimeOffset);
  }
}
