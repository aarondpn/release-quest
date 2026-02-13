import { dom, clientState } from './state.js';
import { updateHUD, updatePlayerCount, hideAllScreens, hideLiveDashboard } from './hud.js';
import { clearAllBugs } from './bugs.js';
import { removeBossElement } from './boss.js';
import { addRemoteCursor, clearRemoteCursors } from './players.js';
import { removeDuckBuffOverlay } from './vfx.js';
import { showLobbyBrowser } from './lobby-ui.js';
import { handleMessageInternal } from './network.js';

export function startPlayback(recording) {
  clientState.isPlayback = true;
  clientState.playbackRecording = recording;
  clientState.playbackSpeed = 1;
  clientState.playbackPaused = false;
  clientState.playbackTimers = [];

  // Discover real player IDs from the game-start event in the recording
  clientState.players = {};
  const gameStartEvent = recording.events.find(e => e.msg.type === 'game-start');
  if (gameStartEvent && gameStartEvent.msg.players) {
    gameStartEvent.msg.players.forEach(p => {
      clientState.players[p.id] = { id: p.id, name: p.name || 'Player', icon: p.icon || '', color: p.color || '#4ecdc4', score: 0 };
      addRemoteCursor(p.id, p.name, p.color, p.icon);
    });
  } else if (recording.players) {
    recording.players.forEach((p, i) => {
      const id = 'replay_player_' + i;
      clientState.players[id] = { id, name: p.name, icon: p.icon, color: p.color, score: 0 };
    });
  }

  // Reset UI
  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  hideLiveDashboard();
  updateHUD(0, 1, 100);
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

  // Schedule all events
  scheduleEvents(recording.events);
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

export function stopPlayback() {
  for (const t of clientState.playbackTimers) clearTimeout(t);
  clientState.playbackTimers = [];

  clientState.isPlayback = false;
  clientState.playbackRecording = null;
  clientState.playbackPaused = false;
  clientState.playbackSpeed = 1;

  // Reset UI
  clearAllBugs();
  removeBossElement();
  clearRemoteCursors();
  removeDuckBuffOverlay();
  hideAllScreens();
  hideLiveDashboard();
  updateHUD(0, 1, 100);
  clientState.players = {};

  if (dom.playbackControls) dom.playbackControls.classList.add('hidden');
  document.getElementById('hud-leave-btn').classList.add('hidden');

  showLobbyBrowser();
}

function getCurrentGameTime() {
  return clientState.playbackGameTimeOffset +
    (Date.now() - clientState.playbackWallTimeRef) * clientState.playbackSpeed;
}

function rescheduleFrom(gameTime) {
  clientState.playbackTimers = [];
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
}

export function togglePause() {
  if (!clientState.isPlayback) return;

  if (clientState.playbackPaused) {
    clientState.playbackPaused = false;
    clientState.playbackWallTimeRef = Date.now();
    rescheduleFrom(clientState.playbackGameTimeOffset);

    const pauseBtn = dom.playbackControls?.querySelector('.playback-pause-btn');
    if (pauseBtn) pauseBtn.textContent = '\u275A\u275A';
  } else {
    clientState.playbackGameTimeOffset = getCurrentGameTime();
    for (const t of clientState.playbackTimers) clearTimeout(t);
    clientState.playbackTimers = [];
    clientState.playbackPaused = true;

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
    rescheduleFrom(clientState.playbackGameTimeOffset);
  }
}
