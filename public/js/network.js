import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';
import { updateHUD, updatePlayerCount, hideAllScreens, showStartScreen, showGameOverScreen, showWinScreen, showLevelScreen, updateLobbyRoster, updateLiveDashboard, showLiveDashboard, hideLiveDashboard } from './hud.js';
import { createBugElement, removeBugElement, clearAllBugs, showSquashEffect, removeMergeTether, removePipelineTether, rebuildPipelineTether } from './bugs.js';
import { createBossElement, updateBossHp, removeBossElement, showBossHitEffect, formatTime } from './boss.js';
import { addRemoteCursor, removeRemoteCursor, updateRemoteCursor, clearRemoteCursors } from './players.js';
import { shakeArena, showParticleBurst, showImpactRing, showDamageVignette, showEnrageFlash, showLevelFlash, showEscalationWarning, showBossRegenNumber, showHeisenbugFleeEffect, showFeaturePenaltyEffect, showDuckBuffOverlay, removeDuckBuffOverlay, showMergeResolvedEffect, showPipelineChainResolvedEffect, showPipelineChainResetEffect } from './vfx.js';
import { showLobbyBrowser, hideLobbyBrowser, renderLobbyList, showLobbyError } from './lobby-ui.js';
import { updateAuthUI, hideAuthOverlay, showAuthError } from './auth-ui.js';
import { isPremium, STANDARD_ICONS } from './avatars.js';
import { renderLeaderboard } from './leaderboard-ui.js';
import { renderRecordingsList, handleRecordingShared, handleRecordingUnshared } from './replays-ui.js';
import { startPlayback } from './playback.js';
import { showError, ERROR_LEVELS } from './error-handler.js';

// Cursor batching: buffer incoming positions and flush once per frame
const pendingCursors = {};
let cursorRafId = null;

function flushCursors() {
  for (const playerId in pendingCursors) {
    const pos = pendingCursors[playerId];
    updateRemoteCursor(playerId, pos.x, pos.y);
    delete pendingCursors[playerId];
  }
  cursorRafId = null;
}

function queueCursorUpdate(playerId, x, y) {
  pendingCursors[playerId] = { x, y };
  if (!cursorRafId) {
    cursorRafId = requestAnimationFrame(flushCursors);
  }
}

export function sendMessage(msg) {
  try {
    // During playback, only allow replay-related messages
    if (clientState.isPlayback) {
      if (msg.type !== 'get-recordings') return;
    }
    if (clientState.ws && clientState.ws.readyState === 1) {
      clientState.ws.send(JSON.stringify(msg));
    }
  } catch (err) {
    console.error('Error sending message:', err);
    showError('Failed to send message to server', ERROR_LEVELS.ERROR);
  }
}

export function connect() {
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    clientState.ws = new WebSocket(proto + '://' + location.host + location.pathname);

    clientState.ws.onopen = () => {
      try {
        dom.connStatus.textContent = 'CONNECTED';
        dom.connStatus.className = 'conn-status connected';
      } catch (err) {
        console.error('Error handling WebSocket open:', err);
      }
    };

    clientState.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      showError('Connection error occurred', ERROR_LEVELS.ERROR);
    };

    clientState.ws.onclose = () => {
      try {
        dom.connStatus.textContent = 'DISCONNECTED';
        dom.connStatus.className = 'conn-status disconnected';
        clientState.currentLobbyId = null;
        showError('Disconnected from server. Reconnecting...', ERROR_LEVELS.WARNING);
        setTimeout(connect, 2000);
      } catch (err) {
        console.error('Error handling WebSocket close:', err);
      }
    };

    clientState.ws.onmessage = (event) => {
      try {
        let msg;
        try { 
          msg = JSON.parse(event.data); 
        } catch (parseErr) {
          console.error('Failed to parse message:', parseErr);
          return;
        }
        handleMessage(msg);
      } catch (err) {
        console.error('Error handling message:', err);
        showError('Error processing server message', ERROR_LEVELS.ERROR);
      }
    };
  } catch (err) {
    console.error('Error connecting to WebSocket:', err);
    showError('Failed to connect to server', ERROR_LEVELS.ERROR);
    setTimeout(connect, 2000);
  }
}

function handleMessage(msg) {
  try {
    handleMessageInternal(msg);
  } catch (err) {
    console.error(`Error handling message type '${msg.type}':`, err);
    showError(`Error processing ${msg.type} message`, ERROR_LEVELS.ERROR);
  }
}

export function handleMessageInternal(msg) {
  switch (msg.type) {

    case 'auth-result': {
      if (msg.success) {
        if (msg.action === 'logout') {
          clientState.authToken = null;
          clientState.authUser = null;
          clientState.isLoggedIn = false;
          localStorage.removeItem('rq_session_token');
          // Reset premium icon to standard on logout
          if (isPremium(clientState.selectedIcon)) {
            clientState.selectedIcon = STANDARD_ICONS[0];
            clientState.myIcon = STANDARD_ICONS[0];
          }
          updateAuthUI();
          if (typeof window._buildIconPicker === 'function') window._buildIconPicker();
        } else {
          // login, register, or resume
          if (msg.token) {
            clientState.authToken = msg.token;
            localStorage.setItem('rq_session_token', msg.token);
          }
          clientState.authUser = msg.user;
          clientState.isLoggedIn = true;
          updateAuthUI();
          hideAuthOverlay();

          // Update client name/icon from account
          if (msg.user.displayName) {
            clientState.myName = msg.user.displayName;
            dom.nameInput.value = msg.user.displayName;
          }
          if (msg.user.icon) {
            clientState.myIcon = msg.user.icon;
            clientState.selectedIcon = msg.user.icon;
          }
          // Rebuild icon picker to unlock premium section
          if (typeof window._buildIconPicker === 'function') window._buildIconPicker();
        }
      } else {
        if (msg.action === 'resume') {
          // Stale token — clear it silently
          localStorage.removeItem('rq_session_token');
          clientState.authToken = null;
          clientState.authUser = null;
          clientState.isLoggedIn = false;
          updateAuthUI();
          // Rebuild icon picker to lock premium section
          if (typeof window._buildIconPicker === 'function') window._buildIconPicker();
        } else {
          showAuthError(msg.error || 'Authentication failed');
        }
      }
      break;
    }

    case 'welcome': {
      clientState.myId = msg.playerId;
      clientState.myColor = msg.color;
      clientState.myIcon = msg.icon;
      clientState.myName = msg.name;
      clientState.currentLobbyId = null;

      if (msg.icon) {
        clientState.selectedIcon = msg.icon;
        dom.iconPicker.querySelectorAll('.icon-option').forEach(o => {
          o.classList.toggle('selected', o.dataset.icon === msg.icon);
        });
      }

      clientState.players = {};
      updatePlayerCount();

      if (!clientState.hasJoined) {
        dom.nameEntry.classList.remove('hidden');
        hideLobbyBrowser();
        dom.nameInput.focus();
      } else {
        dom.nameEntry.classList.add('hidden');
        // Re-send name and show lobby browser
        sendMessage({ type: 'set-name', name: clientState.myName, icon: clientState.myIcon });
        showLobbyBrowser();
      }

      // Attempt session resume from localStorage
      const savedToken = localStorage.getItem('rq_session_token');
      if (savedToken) {
        sendMessage({ type: 'resume-session', token: savedToken });
      } else {
        updateAuthUI();
      }

      // Check for shared replay URL, then invite URL
      checkReplayUrl();
      checkJoinUrl();

      // If reconnecting and we have a pending invite code, join immediately
      if (clientState.hasJoined && clientState.pendingJoinCode) {
        sendMessage({ type: 'join-lobby-by-code', code: clientState.pendingJoinCode });
        clientState.pendingJoinCode = null;
      }
      break;
    }

    // ── Lobby messages ──

    case 'lobby-list': {
      renderLobbyList(msg.lobbies);
      break;
    }

    case 'lobby-created': {
      // Auto-join the lobby we just created
      sendMessage({ type: 'join-lobby', lobbyId: msg.lobby.id });
      break;
    }

    case 'lobby-joined': {
      clientState.currentLobbyId = msg.lobbyId;
      clientState.currentLobbyCode = msg.lobbyCode || null;
      hideLobbyBrowser();
      document.getElementById('hud-leave-btn').classList.remove('hidden');

      // Load game state from lobby
      clientState.players = {};
      if (msg.players) {
        msg.players.forEach(p => {
          clientState.players[p.id] = p;
          if (p.id !== clientState.myId) addRemoteCursor(p.id, p.name, p.color, p.icon);
        });
      }
      updatePlayerCount();

      clearAllBugs();
      if (msg.bugs) {
        msg.bugs.forEach(b => createBugElement(b.id, b.x, b.y, b));
      }

      removeDuckElement();
      if (msg.rubberDuck) {
        createDuckElement(msg.rubberDuck);
      }

      removeHammerElement();
      if (msg.hotfixHammer) {
        createHammerElement(msg.hotfixHammer);
      }

      removeBossElement();
      if (msg.boss) {
        createBossElement(msg.boss.x, msg.boss.y, msg.boss.hp, msg.boss.maxHp, msg.boss.enraged, msg.boss.timeRemaining);
        clientState.bossEnraged = msg.boss.enraged;
      }

      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.phase === 'boss') dom.levelEl.textContent = 'BOSS';
      clientState.currentPhase = msg.phase;

      if (msg.phase === 'lobby') { showStartScreen(); hideLiveDashboard(); }
      else if (msg.phase === 'gameover') { showGameOverScreen(msg.score, msg.level, msg.players || []); hideLiveDashboard(); }
      else if (msg.phase === 'win') { showWinScreen(msg.score, msg.players || []); hideLiveDashboard(); }
      else { hideAllScreens(); showLiveDashboard(); }
      break;
    }

    case 'lobby-left': {
      clientState.currentLobbyId = null;
      clientState.currentLobbyCode = null;
      clientState.players = {};
      clearAllBugs();
      removeBossElement();
      removeDuckElement();
      removeHammerElement();
      removeDuckBuffOverlay();
      clearRemoteCursors();
      hideAllScreens();
      hideLiveDashboard();
      updateHUD(0, 1, 100);
      updatePlayerCount();
      document.getElementById('hud-leave-btn').classList.add('hidden');
      showLobbyBrowser();
      break;
    }

    case 'lobby-error': {
      // If not in a lobby, show the lobby browser so the error is visible
      // (e.g. invite link to a full/missing lobby)
      if (!clientState.currentLobbyId) {
        showLobbyBrowser();
      }
      showLobbyError(msg.message);
      break;
    }

    // ── Player messages ──

    case 'player-joined': {
      const p = msg.player;
      clientState.players[p.id] = p;
      if (p.id !== clientState.myId) addRemoteCursor(p.id, p.name, p.color, p.icon);
      updatePlayerCount();
      updateLobbyRoster();
      updateLiveDashboard();
      break;
    }

    case 'player-left': {
      delete clientState.players[msg.playerId];
      removeRemoteCursor(msg.playerId);
      updatePlayerCount();
      updateLobbyRoster();
      updateLiveDashboard();
      break;
    }

    case 'player-cursor': {
      queueCursorUpdate(msg.playerId, msg.x, msg.y);
      break;
    }

    // ── Game messages ──

    case 'game-start': {
      hideAllScreens();
      clearAllBugs();
      removeBossElement();
      removeDuckElement();
      removeHammerElement();
      removeDuckBuffOverlay();
      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.players) {
        msg.players.forEach(p => { if (clientState.players[p.id]) clientState.players[p.id].score = p.score; });
      }
      showLiveDashboard();
      break;
    }

    case 'level-start': {
      hideAllScreens();
      updateHUD(msg.score, msg.level, msg.hp);
      showLiveDashboard();
      break;
    }

    case 'level-complete': {
      showLevelFlash();
      if (msg.level >= 3) {
        hideAllScreens();
        dom.bossScreen.classList.remove('hidden');
      } else {
        showLevelScreen(msg.level + 1);
      }
      break;
    }

    case 'bug-spawned': {
      createBugElement(msg.bug.id, msg.bug.x, msg.bug.y, msg.bug);
      break;
    }

    case 'bug-wander': {
      const el = clientState.bugs[msg.bugId];
      if (el) {
        const pos = logicalToPixel(msg.x, msg.y);
        let dur;
        if (el.classList.contains('pipeline-bug')) {
          dur = 330; // fast tick for snake slither
        } else if (dom.levelEl.textContent === 'BOSS') {
          dur = 3500 * 0.4;
        } else {
          const cfg = { 1: 5000, 2: 3800, 3: 2800 };
          dur = (cfg[parseInt(dom.levelEl.textContent)] || 5000) * 0.4;
        }
        el.style.transition = 'left ' + dur + 'ms linear, top ' + dur + 'ms linear';
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        clientState.bugPositions[msg.bugId] = { x: msg.x, y: msg.y };
      }

      break;
    }

    case 'bug-squashed': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        const rect = bugEl.getBoundingClientRect();
        const arenaRect = dom.arena.getBoundingClientRect();
        const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
        const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H;
        showSquashEffect(lx, ly, msg.playerColor);
        showParticleBurst(lx, ly, msg.playerColor);
        showImpactRing(lx, ly, msg.playerColor);
      }
      removeBugElement(msg.bugId, true);
      updateHUD(msg.score);

      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      updateLiveDashboard();
      break;
    }

    case 'bug-escaped': {
      removeBugElement(msg.bugId);
      updateHUD(undefined, undefined, msg.hp);
      dom.arena.style.borderColor = 'var(--red)';
      setTimeout(() => dom.arena.style.borderColor = '#2a2a4a', 300);
      showDamageVignette();
      shakeArena('light');
      break;
    }

    // ── Memory Leak Growth ──
    case 'memory-leak-grow': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        bugEl.dataset.growthStage = msg.growthStage;
      }
      break;
    }

    // ── Memory Leak Escaped ──
    case 'memory-leak-escaped': {
      removeBugElement(msg.bugId);
      updateHUD(undefined, undefined, msg.hp);
      dom.arena.style.borderColor = 'var(--red)';
      setTimeout(() => dom.arena.style.borderColor = '#2a2a4a', 300);
      showDamageVignette();
      shakeArena(msg.growthStage >= 2 ? 'medium' : 'light');
      break;
    }

    // ── Memory Leak Hold Update ──
    case 'memory-leak-hold-update': {
      const bugEl = clientState.bugs[msg.bugId];
      if (!bugEl) break;
      
      let progressBar = bugEl.querySelector('.memory-leak-progress');
      let countEl = bugEl.querySelector('.memory-leak-holder-count');
      
      // Create progress bar if it doesn't exist
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'memory-leak-progress';
        progressBar.innerHTML = '<div class="memory-leak-progress-fill"></div>';
        bugEl.appendChild(progressBar);
        bugEl.classList.add('being-held');
        
        // Create holder count as a sibling (not inside progress bar to avoid overflow clipping)
        countEl = document.createElement('div');
        countEl.className = 'memory-leak-holder-count';
        bugEl.appendChild(countEl);
        
        // Store start time for this progress session
        bugEl.dataset.holdStartTime = Date.now() - msg.elapsedTime;
        bugEl.dataset.requiredTime = msg.requiredHoldTime;
      }
      
      // Update holder count display
      if (countEl) {
        if (msg.holderCount > 1) {
          countEl.textContent = 'x' + msg.holderCount;
          countEl.style.display = 'block';
        } else {
          countEl.style.display = 'none';
        }
      }
      
      // Handle dropout
      if (msg.dropOut && msg.holderCount === 0) {
        if (progressBar) progressBar.remove();
        if (countEl) countEl.remove();
        bugEl.classList.remove('being-held');
        delete bugEl.dataset.holdStartTime;
        delete bugEl.dataset.requiredTime;
        break;
      }
      
      // Calculate and update progress with current holder count
      const holdStartTime = parseInt(bugEl.dataset.holdStartTime);
      const requiredTime = parseInt(bugEl.dataset.requiredTime);
      const effectiveRequiredTime = requiredTime / msg.holderCount;
      const elapsed = Date.now() - holdStartTime;
      
      // Update progress bar with smooth transition
      const fill = progressBar.querySelector('.memory-leak-progress-fill');
      const currentProgress = Math.min(100, (elapsed / effectiveRequiredTime) * 100);
      const remainingTime = Math.max(0, effectiveRequiredTime - elapsed);
      
      fill.style.transition = `width ${remainingTime}ms linear`;
      fill.style.width = currentProgress + '%';
      
      // Animate to 100% from current position
      requestAnimationFrame(() => {
        fill.style.width = '100%';
      });
      
      break;
    }

    // ── Memory Leak Cleared ──
    case 'memory-leak-cleared': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        const rect = bugEl.getBoundingClientRect();
        const arenaRect = dom.arena.getBoundingClientRect();
        const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
        const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H;
        
        // Show effects for all holders
        if (msg.holders && msg.holders.length > 0) {
          for (const holderId of msg.holders) {
            const holderPlayer = clientState.players[holderId];
            if (holderPlayer) {
              showSquashEffect(lx, ly, holderPlayer.color);
              showParticleBurst(lx, ly, holderPlayer.color);
            }
          }
          showImpactRing(lx, ly, '#a855f7');
        }
      }
      removeBugElement(msg.bugId, true);
      updateHUD(msg.score);

      // Update scores for all holders
      if (msg.players) {
        for (const [playerId, score] of Object.entries(msg.players)) {
          if (clientState.players[playerId]) {
            clientState.players[playerId].score = score;
          }
        }
      }
      break;
    }

    // ── Heisenbug flee ──
    case 'bug-flee': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        showHeisenbugFleeEffect(bugEl);
        // Instant teleport (no CSS transition)
        bugEl.style.transition = 'none';
        const pos = logicalToPixel(msg.x, msg.y);
        bugEl.style.left = pos.x + 'px';
        bugEl.style.top = pos.y + 'px';
        clientState.bugPositions[msg.bugId] = { x: msg.x, y: msg.y };
        // Re-enable transition after a frame
        requestAnimationFrame(() => { bugEl.style.transition = ''; });
        // Stabilized
        if (msg.fleesRemaining <= 0) {
          bugEl.classList.remove('heisenbug');
          bugEl.classList.add('heisenbug-stabilized');
        }
      }
      break;
    }

    // ── Feature-not-a-bug squashed ──
    case 'feature-squashed': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        const rect = bugEl.getBoundingClientRect();
        const arenaRect = dom.arena.getBoundingClientRect();
        const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
        const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H;
        showFeaturePenaltyEffect(lx, ly);
      }
      removeBugElement(msg.bugId, true);
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('light');
      break;
    }

    // ── Feature escaped peacefully ──
    case 'feature-escaped': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        bugEl.classList.add('feature-leaving');
        setTimeout(() => {
          removeBugElement(msg.bugId);
        }, 500);
      } else {
        removeBugElement(msg.bugId);
      }
      break;
    }

    // ── Rubber duck ──
    case 'duck-spawn': {
      createDuckElement(msg.duck);
      break;
    }

    case 'duck-wander': {
      if (clientState.duckElement) {
        const pos = logicalToPixel(msg.x, msg.y);
        clientState.duckElement.style.transition = 'left 1s ease, top 1s ease';
        clientState.duckElement.style.left = pos.x + 'px';
        clientState.duckElement.style.top = pos.y + 'px';
      }
      break;
    }

    case 'duck-despawn': {
      removeDuckElement();
      break;
    }

    case 'duck-collected': {
      removeDuckElement();
      updateHUD(msg.score);
      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      updateLiveDashboard();
      showDuckBuffOverlay(msg.buffDuration);
      break;
    }

    case 'duck-buff-expired': {
      removeDuckBuffOverlay();
      break;
    }

    // ── Hotfix Hammer ──
    case 'hammer-spawn': {
      createHammerElement(msg.hammer);
      break;
    }

    case 'hammer-despawn': {
      removeHammerElement();
      break;
    }

    case 'hammer-collected': {
      removeHammerElement();
      updateHUD(msg.score);
      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      updateLiveDashboard();
      showHammerShockwave(msg.playerColor);
      break;
    }

    case 'hammer-stun-expired': {
      // Resume bug animations
      for (const bugId in clientState.bugs) {
        const bugEl = clientState.bugs[bugId];
        if (bugEl) {
          bugEl.classList.remove('stunned');
        }
      }
      // Resume boss animation
      if (clientState.bossElement) {
        clientState.bossElement.classList.remove('stunned');
      }
      break;
    }

    // ── Merge conflict ──
    case 'merge-conflict-resolved': {
      const bugEl1 = clientState.bugs[msg.bugId];
      const bugEl2 = clientState.bugs[msg.partnerId];
      // Show merge effect at midpoint
      if (bugEl1 || bugEl2) {
        const ref = bugEl1 || bugEl2;
        const rect = ref.getBoundingClientRect();
        const arenaRect = dom.arena.getBoundingClientRect();
        const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
        const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H;
        showMergeResolvedEffect(lx, ly);
        showParticleBurst(lx, ly, '#ffe66d');
      }
      removeBugElement(msg.bugId, true);
      removeBugElement(msg.partnerId, true);
      // Clean up tether
      if (clientState.mergeTethers) {
        for (const cid of Object.keys(clientState.mergeTethers)) {
          const t = clientState.mergeTethers[cid];
          if (t.bug1 === msg.bugId || t.bug2 === msg.bugId || t.bug1 === msg.partnerId || t.bug2 === msg.partnerId) {
            removeMergeTether(cid);
          }
        }
      }
      updateHUD(msg.score);
      if (msg.players) {
        for (const [pid, score] of Object.entries(msg.players)) {
          if (clientState.players[pid]) clientState.players[pid].score = score;
        }
      }
      updateLiveDashboard();
      break;
    }

    case 'merge-conflict-halfclick': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        bugEl.classList.add('merge-halfclick');
        setTimeout(() => bugEl.classList.remove('merge-halfclick'), 500);
      }
      break;
    }

    case 'merge-conflict-escaped': {
      removeBugElement(msg.bugId);
      removeBugElement(msg.partnerId);
      // Clean up tether
      if (clientState.mergeTethers) {
        for (const cid of Object.keys(clientState.mergeTethers)) {
          const t = clientState.mergeTethers[cid];
          if (t.bug1 === msg.bugId || t.bug2 === msg.bugId || t.bug1 === msg.partnerId || t.bug2 === msg.partnerId) {
            removeMergeTether(cid);
          }
        }
      }
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('medium');
      break;
    }

    // ── Pipeline chain ──
    case 'pipeline-bug-squashed': {
      const bugEl = clientState.bugs[msg.bugId];
      if (bugEl) {
        const rect = bugEl.getBoundingClientRect();
        const arenaRect = dom.arena.getBoundingClientRect();
        const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
        const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H;
        showSquashEffect(lx, ly, msg.playerColor);
        showParticleBurst(lx, ly, '#a855f7');
        showImpactRing(lx, ly, '#a855f7');
      }
      removeBugElement(msg.bugId, true);
      // Rebuild tether with one less node
      rebuildPipelineTether(msg.chainId);
      updateHUD(msg.score);
      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      updateLiveDashboard();
      break;
    }

    case 'pipeline-chain-resolved': {
      // All bugs in chain squashed in order — show bonus effect
      removePipelineTether(msg.chainId);
      // Find any remaining bug position for the effect, or use center
      showPipelineChainResolvedEffect();
      updateHUD(msg.score);
      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      updateLiveDashboard();
      break;
    }

    case 'pipeline-chain-reset': {
      // Wrong order clicked — all bugs teleport to new positions
      for (const [bid, pos] of Object.entries(msg.positions)) {
        const bugEl = clientState.bugs[bid];
        if (bugEl) {
          bugEl.style.transition = 'none';
          const pxPos = logicalToPixel(pos.x, pos.y);
          bugEl.style.left = pxPos.x + 'px';
          bugEl.style.top = pxPos.y + 'px';
          clientState.bugPositions[bid] = { x: pos.x, y: pos.y };
          requestAnimationFrame(() => { bugEl.style.transition = ''; });
          // Flash red to indicate error
          bugEl.classList.add('pipeline-reset');
          setTimeout(() => bugEl.classList.remove('pipeline-reset'), 500);
        }
      }
      rebuildPipelineTether(msg.chainId);
      showPipelineChainResetEffect();
      shakeArena('light');
      break;
    }

    case 'pipeline-chain-escaped': {
      for (const bid of msg.bugIds) {
        removeBugElement(bid);
      }
      removePipelineTether(msg.chainId);
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('medium');
      break;
    }

    case 'game-over': {
      clearAllBugs();
      removeBossElement();
      removeDuckElement();
      removeDuckBuffOverlay();
      hideLiveDashboard();
      shakeArena('heavy');
      showGameOverScreen(msg.score, msg.level, msg.players || []);
      break;
    }

    case 'game-win': {
      clearAllBugs();
      hideLiveDashboard();
      showWinScreen(msg.score, msg.players || []);
      break;
    }

    case 'boss-spawn': {
      hideAllScreens();
      dom.levelEl.textContent = 'BOSS';
      createBossElement(msg.boss.x, msg.boss.y, msg.boss.hp, msg.boss.maxHp, msg.boss.enraged, msg.timeRemaining);
      updateHUD(msg.score, undefined, msg.hp);
      showLiveDashboard();
      break;
    }

    case 'boss-wander': {
      if (clientState.bossElement) {
        const pos = logicalToPixel(msg.x, msg.y);
        clientState.bossElement.style.transition = 'left 1.5s ease, top 1.5s ease';
        clientState.bossElement.style.left = pos.x + 'px';
        clientState.bossElement.style.top = pos.y + 'px';
      }
      break;
    }

    case 'boss-hit': {
      updateBossHp(msg.bossHp, msg.bossMaxHp, msg.enraged);
      showBossHitEffect(msg.playerColor);
      if (msg.enraged && clientState.bossElement) {
        clientState.bossElement.classList.add('enraged');
      }
      if (msg.justEnraged) {
        showEnrageFlash();
      }
      updateHUD(msg.score);
      if (clientState.players[msg.playerId]) {
        clientState.players[msg.playerId].score = msg.playerScore;
      }
      clientState.bossEnraged = msg.enraged;
      updateLiveDashboard();
      break;
    }

    case 'boss-tick': {
      const timerEl = document.getElementById('boss-timer');
      if (timerEl) {
        timerEl.textContent = formatTime(msg.timeRemaining);
        if (msg.timeRemaining <= 20) timerEl.classList.add('urgent');
        else timerEl.classList.remove('urgent');
      }
      if (msg.regenAmount > 0) {
        updateBossHp(msg.bossHp, msg.bossMaxHp, msg.enraged);
        showBossRegenNumber(msg.regenAmount);
      }
      if (msg.escalated) {
        showEscalationWarning();
      }
      break;
    }

    case 'boss-defeated': {
      if (clientState.bossElement) {
        clientState.bossElement.style.animation = 'boss-explode 0.8s ease-in forwards';
        setTimeout(() => {
          removeBossElement();
          showWinScreen(msg.score, msg.players || []);
        }, 800);
      } else {
        showWinScreen(msg.score, msg.players || []);
      }
      if (msg.players) {
        msg.players.forEach(p => { if (clientState.players[p.id]) clientState.players[p.id].score = p.score; });
      }
      updateHUD(msg.score);
      updateLiveDashboard();
      break;
    }

    case 'game-reset': {
      clearAllBugs();
      removeBossElement();
      removeDuckElement();
      removeDuckBuffOverlay();
      hideLiveDashboard();
      showStartScreen();
      updateHUD(0, 1, 100);
      break;
    }

    case 'leaderboard': {
      renderLeaderboard(msg.entries);
      break;
    }

    case 'recordings-list': {
      renderRecordingsList(msg.recordings);
      break;
    }

    case 'recording-error': {
      showLobbyError(msg.message);
      break;
    }

    case 'recording-shared': {
      handleRecordingShared(msg);
      break;
    }

    case 'recording-unshared': {
      handleRecordingUnshared(msg);
      break;
    }
  }
}

// ── Duck element helpers ──

function createDuckElement(duck) {
  removeDuckElement();
  const el = document.createElement('div');
  el.className = 'rubber-duck';
  el.id = 'rubber-duck';
  const pos = logicalToPixel(duck.x, duck.y);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.addEventListener('click', (e) => {
    try {
      e.stopPropagation();
      sendMessage({ type: 'click-duck' });
    } catch (err) {
      console.error('Error handling duck click:', err);
      showError('Error clicking duck', ERROR_LEVELS.ERROR);
    }
  });
  dom.arena.appendChild(el);
  clientState.duckElement = el;
}

function removeDuckElement() {
  if (clientState.duckElement) {
    clientState.duckElement.remove();
    clientState.duckElement = null;
  }
  const existing = document.getElementById('rubber-duck');
  if (existing) existing.remove();
}

// ── Hammer element helpers ──

function createHammerElement(hammer) {
  removeHammerElement();
  const el = document.createElement('div');
  el.className = 'hotfix-hammer';
  el.id = 'hotfix-hammer';
  const pos = logicalToPixel(hammer.x, hammer.y);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.addEventListener('click', (e) => {
    try {
      e.stopPropagation();
      sendMessage({ type: 'click-hammer' });
    } catch (err) {
      console.error('Error handling hammer click:', err);
      showError('Error clicking hammer', ERROR_LEVELS.ERROR);
    }
  });
  dom.arena.appendChild(el);
  clientState.hammerElement = el;
}

function removeHammerElement() {
  if (clientState.hammerElement) {
    clientState.hammerElement.remove();
    clientState.hammerElement = null;
  }
  const existing = document.getElementById('hotfix-hammer');
  if (existing) existing.remove();
}

function showHammerShockwave(playerColor) {
  // Create expanding ring shockwave
  const shockwave = document.createElement('div');
  shockwave.className = 'hammer-shockwave';
  shockwave.style.borderColor = playerColor;
  dom.arena.appendChild(shockwave);
  setTimeout(() => shockwave.remove(), 800);
  
  // Stun all bugs visually
  for (const bugId in clientState.bugs) {
    const bugEl = clientState.bugs[bugId];
    if (bugEl) {
      bugEl.classList.add('stunned');
    }
  }
  
  // Stun boss visually
  if (clientState.bossElement) {
    clientState.bossElement.classList.add('stunned');
  }
  
  // Screen shake
  shakeArena('medium');
}

function checkReplayUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get('replay');
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return;

  // Hide the name entry screen immediately so it doesn't cover the arena
  if (dom.nameEntry) dom.nameEntry.classList.add('hidden');

  fetch('/api/replay/' + token)
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then(recording => {
      if (recording) {
        startPlayback(recording);
      } else {
        // Token was invalid — restore normal UI
        if (!clientState.hasJoined && dom.nameEntry) dom.nameEntry.classList.remove('hidden');
      }
    })
    .catch(() => {
      showError('Failed to load shared replay', ERROR_LEVELS.ERROR);
      if (!clientState.hasJoined && dom.nameEntry) dom.nameEntry.classList.remove('hidden');
    });
}

function checkJoinUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('join');
  if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) return;

  clientState.pendingJoinCode = code.toUpperCase();

  // Clean the URL to prevent re-triggering on refresh
  const url = new URL(location.href);
  url.searchParams.delete('join');
  history.replaceState(null, '', url.pathname + url.search);
}
