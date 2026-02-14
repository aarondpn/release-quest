import { dom, clientState } from './state.js';
import { updateHUD, updatePlayerCount, hideAllScreens, hideLiveDashboard } from './hud.js';
import { clearAllBugs } from './bugs.js';
import { removeBossElement } from './boss.js';
import { addRemoteCursor, clearRemoteCursors } from './players.js';
import { removeDuckBuffOverlay } from './vfx.js';
import { showLobbyBrowser } from './lobby-ui.js';
import { handleMessageInternal } from './network.js';

let progressRafId = null;
let progressBarClickBound = false;

function formatPlaybackTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

function getPlaybackDuration() {
  const recording = clientState.playbackRecording;
  if (!recording) return 0;
  let maxT = 0;
  if (recording.events) {
    for (const e of recording.events) {
      if (e.t > maxT) maxT = e.t;
    }
  }
  if (recording.mouseMovements) {
    for (const m of recording.mouseMovements) {
      if (m.t > maxT) maxT = m.t;
    }
  }
  return maxT;
}

function updateProgressBar() {
  const duration = getPlaybackDuration();
  const gameTime = getCurrentGameTime();
  const progress = duration > 0 ? Math.min(gameTime / duration, 1) : 0;

  if (dom.playbackProgressFill) {
    dom.playbackProgressFill.style.width = (progress * 100) + '%';
  }
  if (dom.playbackTimeCurrent) {
    dom.playbackTimeCurrent.textContent = formatPlaybackTime(gameTime);
  }
  if (dom.playbackTimeTotal) {
    dom.playbackTimeTotal.textContent = formatPlaybackTime(duration);
  }
}

function startProgressLoop() {
  stopProgressLoop();
  function tick() {
    if (!clientState.isPlayback) return;
    updateProgressBar();
    progressRafId = requestAnimationFrame(tick);
  }
  progressRafId = requestAnimationFrame(tick);
}

function stopProgressLoop() {
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId);
    progressRafId = null;
  }
}

function initProgressBarClick() {
  if (!dom.playbackProgressBar || progressBarClickBound) return;
  progressBarClickBound = true;
  dom.playbackProgressBar.addEventListener('click', (e) => {
    if (!clientState.isPlayback) return;
    const rect = dom.playbackProgressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = getPlaybackDuration();
    const targetTime = ratio * duration;
    seekTo(targetTime);
  });
}

function seekTo(targetTime) {
  // Reset game state for replay
  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  updateHUD(0, 1, 100);

  // Re-add cursors for replay players
  const recording = clientState.playbackRecording;
  if (recording) {
    const gameStartEvent = recording.events.find(e => e.msg.type === 'game-start');
    if (gameStartEvent && gameStartEvent.msg.players) {
      gameStartEvent.msg.players.forEach(p => {
        addRemoteCursor(p.id, p.name, p.color, p.icon);
      });
    }
  }

  // Fast-forward: replay all events up to targetTime synchronously
  if (recording && recording.events) {
    for (const event of recording.events) {
      if (event.t <= targetTime) {
        handleMessageInternal(event.msg);
      }
    }
  }

  // Update playback time references
  clientState.playbackGameTimeOffset = targetTime;
  clientState.playbackWallTimeRef = Date.now();

  // Reschedule future events
  if (!clientState.playbackPaused) {
    rescheduleFrom(targetTime);
  }

  // Update progress bar immediately
  updateProgressBar();
}

export function startPlayback(recording) {
  clientState.isPlayback = true;
  clientState.playbackRecording = recording;
  clientState.playbackSpeed = 1;
  clientState.playbackPaused = false;
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];
  // Clear myId so all player cursors are shown during replay
  clientState.myId = null;

  // Build a color lookup from recording players
  const playerColorMap = {};
  if (recording.players) {
    recording.players.forEach(p => {
      const id = p.player_id || p.id || ('replay_player_' + p.name);
      playerColorMap[id] = p.color;
    });
  }

  // Reset UI first
  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  hideLiveDashboard();
  updateHUD(0, 1, 100);

  // Discover real player IDs from the game-start event in the recording
  clientState.players = {};
  const gameStartEvent = recording.events.find(e => e.msg.type === 'game-start');
  if (gameStartEvent && gameStartEvent.msg.players) {
    gameStartEvent.msg.players.forEach(p => {
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

  // Hide lobby browser, show arena with playback controls
  document.getElementById('lobby-browser').classList.add('hidden');
  document.getElementById('hud-leave-btn').classList.remove('hidden');

  // Show playback controls
  if (dom.playbackControls) {
    dom.playbackControls.classList.remove('hidden');
    const speedBtn = dom.playbackControls.querySelector('.playback-speed-btn');
    if (speedBtn) speedBtn.textContent = '1x';
    const pauseBtn = dom.playbackControls.querySelector('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u275A\u275A';
  }

  // Track playback position: gameTimeOffset + (now - wallTimeRef) * speed = current game time
  clientState.playbackGameTimeOffset = 0;
  clientState.playbackWallTimeRef = Date.now();

  // Set total time label and start progress loop
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

  // Schedule game events
  scheduleEvents(recording.events);
  // Schedule mouse movements separately
  scheduleMouseMoves(recording.mouseMovements || []);
}

function scheduleEvents(events) {
  for (const event of events) {
    const delay = event.t / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback) return;
      handleMessageInternal(event.msg);
    }, delay);
    clientState.playbackTimers.push(timerId);
  }
}

function scheduleMouseMoves(mouseMovements) {
  for (const mm of mouseMovements) {
    const delay = mm.t / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback) return;
      // Dispatch as a player-cursor message for cursor position updates
      handleMessageInternal({ type: 'player-cursor', playerId: mm.playerId, x: mm.x, y: mm.y });
    }, delay);
    clientState.playbackMouseTimers.push(timerId);
  }
}

export function stopPlayback() {
  for (const t of clientState.playbackTimers) clearTimeout(t);
  for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];

  clientState.isPlayback = false;
  clientState.playbackRecording = null;
  clientState.playbackPaused = false;
  clientState.playbackSpeed = 1;
  clientState.playbackPlayerColors = null;

  // Reset UI
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
  document.getElementById('hud-leave-btn').classList.add('hidden');

  // Clear ?replay= param from URL
  if (new URLSearchParams(location.search).has('replay')) {
    history.replaceState(null, '', location.pathname);
  }

  showLobbyBrowser();
}

function getCurrentGameTime() {
  return clientState.playbackGameTimeOffset +
    (Date.now() - clientState.playbackWallTimeRef) * clientState.playbackSpeed;
}

function rescheduleFrom(gameTime) {
  // Clear both event and mouse timers
  for (const t of clientState.playbackTimers) clearTimeout(t);
  for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
  clientState.playbackTimers = [];
  clientState.playbackMouseTimers = [];

  const recording = clientState.playbackRecording;
  if (!recording) return;

  // Reschedule game events
  for (const event of recording.events) {
    if (event.t <= gameTime) continue;
    const delay = (event.t - gameTime) / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback || clientState.playbackPaused) return;
      handleMessageInternal(event.msg);
    }, delay);
    clientState.playbackTimers.push(timerId);
  }

  // Reschedule mouse movements
  const mouseMovements = recording.mouseMovements || [];
  for (const mm of mouseMovements) {
    if (mm.t <= gameTime) continue;
    const delay = (mm.t - gameTime) / clientState.playbackSpeed;
    const timerId = setTimeout(() => {
      if (!clientState.isPlayback || clientState.playbackPaused) return;
      handleMessageInternal({ type: 'player-cursor', playerId: mm.playerId, x: mm.x, y: mm.y });
    }, delay);
    clientState.playbackMouseTimers.push(timerId);
  }
}

export function togglePause() {
  if (!clientState.isPlayback) return;

  if (clientState.playbackPaused) {
    clientState.playbackPaused = false;
    clientState.playbackWallTimeRef = Date.now();
    rescheduleFrom(clientState.playbackGameTimeOffset);
    startProgressLoop();

    const pauseBtn = dom.playbackControls?.querySelector('.playback-pause-btn');
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

    const pauseBtn = dom.playbackControls?.querySelector('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u25B6';
  }
}

export function cycleSpeed() {
  if (!clientState.isPlayback) return;

  if (!clientState.playbackPaused) {
    clientState.playbackGameTimeOffset = getCurrentGameTime();
    clientState.playbackWallTimeRef = Date.now();
  }

  const speeds = [1, 2, 4];
  const currentIdx = speeds.indexOf(clientState.playbackSpeed);
  clientState.playbackSpeed = speeds[(currentIdx + 1) % speeds.length];

  const speedBtn = dom.playbackControls?.querySelector('.playback-speed-btn');
  if (speedBtn) speedBtn.textContent = clientState.playbackSpeed + 'x';

  if (!clientState.playbackPaused) {
    for (const t of clientState.playbackTimers) clearTimeout(t);
    for (const t of (clientState.playbackMouseTimers || [])) clearTimeout(t);
    rescheduleFrom(clientState.playbackGameTimeOffset);
  }
}
