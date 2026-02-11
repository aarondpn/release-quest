import { LOGICAL_W, LOGICAL_H } from '../config';
import { gameState, emitVfx } from './useGameState';
import type { BugData, BossData, PowerUpData } from './useGameState';
import { logicalToPixel } from './useCoordinates';
import {
  shakeArena, showParticleBurst, showImpactRing, showDamageVignette,
  showEnrageFlash, showLevelFlash, showEscalationWarning,
  showBossRegenNumber, showHeisenbugFleeEffect, showFeaturePenaltyEffect,
  showDuckBuffOverlay, removeDuckBuffOverlay, showMergeResolvedEffect,
  showPipelineChainResolvedEffect, showPipelineChainResetEffect,
  showSquashEffect, showBossHitEffect, showHammerShockwave, showArenaBorderFlash,
} from './useVfx';

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// Cursor batching
const pendingCursors: Record<string, { x: number; y: number }> = {};
let cursorRafId: number | null = null;

function flushCursors() {
  for (const playerId in pendingCursors) {
    const pos = pendingCursors[playerId];
    gameState.remoteCursors[playerId] = { x: pos.x, y: pos.y };
    delete pendingCursors[playerId];
  }
  cursorRafId = null;
}

function queueCursorUpdate(playerId: string, x: number, y: number) {
  pendingCursors[playerId] = { x, y };
  if (!cursorRafId) {
    cursorRafId = requestAnimationFrame(flushCursors);
  }
}

export function sendMessage(msg: Record<string, any>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host + location.pathname);

  ws.onopen = () => {
    gameState.connected = true;
  };

  ws.onclose = () => {
    gameState.connected = false;
    gameState.currentLobbyId = null;
    ws = null;
    reconnectTimeout = setTimeout(connect, 2000);
  };

  ws.onmessage = (event) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleMessage(msg);
  };
}

export function disconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (ws) ws.close();
  ws = null;
}

function clearAllBugs() {
  gameState.bugs = {};
  gameState.mergeTethers = {};
  gameState.pipelineTethers = {};
}

function removeBoss() {
  gameState.boss = null;
}

function removeDuck() {
  gameState.duck = null;
}

function removeHammer() {
  gameState.hammer = null;
}

function updateHUD(score?: number, level?: number, hp?: number) {
  if (score !== undefined) gameState.score = score;
  if (level !== undefined) gameState.level = level;
  if (hp !== undefined) gameState.hp = hp;
}

function hideAllScreens() {
  gameState.activeScreen = null;
}

function showStartScreen() {
  gameState.activeScreen = 'start';
}

function showGameOverScreen(score: number, level: number, players: any[]) {
  gameState.activeScreen = 'gameover';
  gameState.screenData = { score, level, players };
}

function showWinScreen(score: number, players: any[]) {
  gameState.activeScreen = 'win';
  gameState.screenData = { score, players };
}

function showLevelScreen(levelNum: number) {
  gameState.activeScreen = 'level';
  gameState.screenData = { levelNum };
}

function showBossScreen() {
  gameState.activeScreen = 'boss';
}

function clearRemoteCursors() {
  for (const key of Object.keys(gameState.remoteCursors)) {
    delete gameState.remoteCursors[key];
  }
}

function removeBugFromState(bugId: string, animate?: boolean) {
  if (!gameState.bugs[bugId]) return;
  if (animate) {
    gameState.bugs[bugId].popping = true;
    setTimeout(() => { delete gameState.bugs[bugId]; }, 200);
  } else {
    delete gameState.bugs[bugId];
  }
  // Clean up tethers referencing this bug
  cleanupTethersForBug(bugId);
}

function cleanupTethersForBug(bugId: string) {
  // Clean merge tethers
  for (const cid of Object.keys(gameState.mergeTethers)) {
    const t = gameState.mergeTethers[cid];
    if (t.bug1 === bugId || t.bug2 === bugId) {
      delete gameState.mergeTethers[cid];
    }
  }
}

function rebuildPipelineTether(chainId: string) {
  // Collect bugs belonging to this chain
  const chainBugs: { id: string; index: number }[] = [];
  for (const [bid, bug] of Object.entries(gameState.bugs)) {
    if (bug.isPipeline && bug.chainId === chainId) {
      chainBugs.push({ id: bid, index: bug.chainIndex || 0 });
    }
  }
  if (chainBugs.length < 2) {
    delete gameState.pipelineTethers[chainId];
    return;
  }
  chainBugs.sort((a, b) => a.index - b.index);
  gameState.pipelineTethers[chainId] = chainBugs.map(b => b.id);
}

function getBugLogicalPos(bugId: string): { lx: number; ly: number } | null {
  const bug = gameState.bugs[bugId];
  if (!bug) return null;
  return { lx: bug.x, ly: bug.y };
}

function handleMessage(msg: any) {
  switch (msg.type) {

    case 'auth-result': {
      if (msg.success) {
        if (msg.action === 'logout') {
          gameState.authToken = null;
          gameState.authUser = null;
          gameState.isLoggedIn = false;
          localStorage.removeItem('rq_session_token');
        } else {
          if (msg.token) {
            gameState.authToken = msg.token;
            localStorage.setItem('rq_session_token', msg.token);
          }
          gameState.authUser = msg.user;
          gameState.isLoggedIn = true;
          gameState.showAuthOverlay = false;

          if (msg.user.displayName) {
            gameState.myName = msg.user.displayName;
          }
          if (msg.user.icon) {
            gameState.myIcon = msg.user.icon;
            gameState.selectedIcon = msg.user.icon;
          }
        }
      } else {
        if (msg.action === 'resume') {
          localStorage.removeItem('rq_session_token');
          gameState.authToken = null;
          gameState.authUser = null;
          gameState.isLoggedIn = false;
        } else {
          emitVfx({ type: 'auth-error', error: msg.error || 'Authentication failed' });
        }
      }
      break;
    }

    case 'welcome': {
      gameState.myId = msg.playerId;
      gameState.myColor = msg.color;
      gameState.myIcon = msg.icon;
      gameState.myName = msg.name;
      gameState.currentLobbyId = null;

      if (msg.icon) {
        gameState.selectedIcon = msg.icon;
      }

      gameState.players = {};

      if (!gameState.hasJoined) {
        gameState.showNameEntry = true;
        gameState.showLobbyBrowser = false;
      } else {
        gameState.showNameEntry = false;
        sendMessage({ type: 'set-name', name: gameState.myName, icon: gameState.myIcon });
        gameState.showLobbyBrowser = true;
      }

      // Attempt session resume
      const savedToken = localStorage.getItem('rq_session_token');
      if (savedToken) {
        sendMessage({ type: 'resume-session', token: savedToken });
      }
      break;
    }

    // ── Lobby messages ──

    case 'lobby-list': {
      gameState.lobbies = msg.lobbies;
      break;
    }

    case 'lobby-created': {
      sendMessage({ type: 'join-lobby', lobbyId: msg.lobby.id });
      break;
    }

    case 'lobby-joined': {
      gameState.currentLobbyId = msg.lobbyId;
      gameState.showLobbyBrowser = false;

      // Load players
      gameState.players = {};
      if (msg.players) {
        msg.players.forEach((p: any) => {
          gameState.players[p.id] = p;
        });
      }

      // Load bugs
      clearAllBugs();
      if (msg.bugs) {
        msg.bugs.forEach((b: any) => {
          gameState.bugs[b.id] = { ...b };
          // Set up tethers
          if (b.mergeConflict && b.mergePartner && gameState.bugs[b.mergePartner]) {
            gameState.mergeTethers[b.mergeConflict] = { bug1: b.id, bug2: b.mergePartner };
          }
          if (b.isPipeline) {
            rebuildPipelineTether(b.chainId);
          }
        });
      }

      // Load powerups
      gameState.duck = msg.rubberDuck ? { x: msg.rubberDuck.x, y: msg.rubberDuck.y } : null;
      gameState.hammer = msg.hotfixHammer ? { x: msg.hotfixHammer.x, y: msg.hotfixHammer.y } : null;

      // Load boss
      if (msg.boss) {
        gameState.boss = {
          x: msg.boss.x, y: msg.boss.y,
          hp: msg.boss.hp, maxHp: msg.boss.maxHp,
          enraged: msg.boss.enraged,
          timeRemaining: msg.boss.timeRemaining,
        };
      } else {
        gameState.boss = null;
      }

      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.phase === 'boss') gameState.level = -1; // Signal boss level
      gameState.currentPhase = msg.phase;

      if (msg.phase === 'lobby') { showStartScreen(); }
      else if (msg.phase === 'gameover') { showGameOverScreen(msg.score, msg.level, msg.players || []); }
      else if (msg.phase === 'win') { showWinScreen(msg.score, msg.players || []); }
      else { hideAllScreens(); }
      break;
    }

    case 'lobby-left': {
      gameState.currentLobbyId = null;
      gameState.players = {};
      clearAllBugs();
      removeBoss();
      removeDuck();
      removeHammer();
      removeDuckBuffOverlay();
      clearRemoteCursors();
      hideAllScreens();
      updateHUD(0, 1, 100);
      gameState.showLobbyBrowser = true;
      break;
    }

    case 'lobby-error': {
      emitVfx({ type: 'lobby-error', message: msg.message });
      break;
    }

    // ── Player messages ──

    case 'player-joined': {
      const p = msg.player;
      gameState.players[p.id] = p;
      break;
    }

    case 'player-left': {
      delete gameState.players[msg.playerId];
      delete gameState.remoteCursors[msg.playerId];
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
      removeBoss();
      removeDuck();
      removeHammer();
      removeDuckBuffOverlay();
      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.players) {
        msg.players.forEach((p: any) => {
          if (gameState.players[p.id]) gameState.players[p.id].score = p.score;
        });
      }
      gameState.currentPhase = 'playing';
      break;
    }

    case 'level-start': {
      hideAllScreens();
      updateHUD(msg.score, msg.level, msg.hp);
      gameState.currentPhase = 'playing';
      break;
    }

    case 'level-complete': {
      showLevelFlash();
      if (msg.level >= 3) {
        hideAllScreens();
        showBossScreen();
      } else {
        showLevelScreen(msg.level + 1);
      }
      break;
    }

    case 'bug-spawned': {
      const b = msg.bug;
      gameState.bugs[b.id] = { ...b };

      // Set up merge tether
      if (b.mergeConflict && b.mergePartner && gameState.bugs[b.mergePartner]) {
        gameState.mergeTethers[b.mergeConflict] = { bug1: b.id, bug2: b.mergePartner };
      }

      // Set up pipeline tether
      if (b.isPipeline) {
        rebuildPipelineTether(b.chainId);
      }

      // Delayed feature reveal
      if (b.isFeature) {
        setTimeout(() => {
          if (gameState.bugs[b.id]) {
            gameState.bugs[b.id].featureRevealed = true;
          }
        }, 600);
      }
      break;
    }

    case 'bug-wander': {
      const bug = gameState.bugs[msg.bugId];
      if (!bug) break;
      bug.x = msg.x;
      bug.y = msg.y;

      // Compute transition duration
      let dur: number;
      if (bug.isPipeline) {
        dur = 330;
      } else if (gameState.level === -1 || gameState.currentPhase === 'boss') {
        dur = 3500 * 0.4;
      } else {
        const cfg: Record<number, number> = { 1: 5000, 2: 3800, 3: 2800 };
        dur = (cfg[gameState.level] || 5000) * 0.4;
      }
      bug.transition = `left ${dur}ms linear, top ${dur}ms linear`;
      break;
    }

    case 'bug-squashed': {
      const bugPos = getBugLogicalPos(msg.bugId);
      if (bugPos) {
        showSquashEffect(bugPos.lx, bugPos.ly, msg.playerColor);
        showParticleBurst(bugPos.lx, bugPos.ly, msg.playerColor);
        showImpactRing(bugPos.lx, bugPos.ly, msg.playerColor);
      }
      removeBugFromState(msg.bugId, true);
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      break;
    }

    case 'bug-escaped': {
      removeBugFromState(msg.bugId);
      updateHUD(undefined, undefined, msg.hp);
      showArenaBorderFlash();
      showDamageVignette();
      shakeArena('light');
      break;
    }

    case 'memory-leak-grow': {
      const bug = gameState.bugs[msg.bugId];
      if (bug) bug.growthStage = msg.growthStage;
      break;
    }

    case 'memory-leak-escaped': {
      removeBugFromState(msg.bugId);
      updateHUD(undefined, undefined, msg.hp);
      showArenaBorderFlash();
      showDamageVignette();
      shakeArena(msg.growthStage >= 2 ? 'medium' : 'light');
      break;
    }

    case 'memory-leak-hold-update': {
      const bug = gameState.bugs[msg.bugId];
      if (!bug) break;

      if (msg.dropOut && msg.holderCount === 0) {
        bug.beingHeld = false;
        bug.holdProgress = 0;
        bug.holderCount = 0;
        bug.holdStartTime = undefined;
        bug.requiredHoldTime = undefined;
        break;
      }

      if (!bug.beingHeld) {
        bug.beingHeld = true;
        bug.holdStartTime = Date.now() - msg.elapsedTime;
        bug.requiredHoldTime = msg.requiredHoldTime;
      }

      bug.holderCount = msg.holderCount;
      break;
    }

    case 'memory-leak-cleared': {
      const bugPos = getBugLogicalPos(msg.bugId);
      if (bugPos && msg.holders && msg.holders.length > 0) {
        for (const holderId of msg.holders) {
          const holderPlayer = gameState.players[holderId];
          if (holderPlayer) {
            showSquashEffect(bugPos.lx, bugPos.ly, holderPlayer.color);
            showParticleBurst(bugPos.lx, bugPos.ly, holderPlayer.color);
          }
        }
        showImpactRing(bugPos.lx, bugPos.ly, '#a855f7');
      }
      removeBugFromState(msg.bugId, true);
      updateHUD(msg.score);
      if (msg.players) {
        for (const [playerId, score] of Object.entries(msg.players)) {
          if (gameState.players[playerId]) {
            gameState.players[playerId].score = score as number;
          }
        }
      }
      break;
    }

    case 'bug-flee': {
      const bug = gameState.bugs[msg.bugId];
      if (!bug) break;
      // Show ghost at old position before teleporting
      showHeisenbugFleeEffect(bug.x, bug.y);
      // Instant teleport
      bug.transition = 'none';
      bug.x = msg.x;
      bug.y = msg.y;
      // Re-enable transition after a frame
      requestAnimationFrame(() => {
        if (gameState.bugs[msg.bugId]) {
          gameState.bugs[msg.bugId].transition = undefined;
        }
      });
      if (msg.fleesRemaining <= 0) {
        bug.stabilized = true;
        bug.isHeisenbug = false;
      }
      break;
    }

    case 'feature-squashed': {
      const bugPos = getBugLogicalPos(msg.bugId);
      if (bugPos) {
        showFeaturePenaltyEffect(bugPos.lx, bugPos.ly);
      }
      removeBugFromState(msg.bugId, true);
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('light');
      break;
    }

    case 'feature-escaped': {
      const bug = gameState.bugs[msg.bugId];
      if (bug) {
        bug.featureLeaving = true;
        setTimeout(() => { removeBugFromState(msg.bugId); }, 500);
      } else {
        removeBugFromState(msg.bugId);
      }
      break;
    }

    // ── Rubber duck ──
    case 'duck-spawn': {
      gameState.duck = { x: msg.duck.x, y: msg.duck.y };
      break;
    }

    case 'duck-wander': {
      if (gameState.duck) {
        gameState.duck.x = msg.x;
        gameState.duck.y = msg.y;
        gameState.duck.transition = 'left 1s ease, top 1s ease';
      }
      break;
    }

    case 'duck-despawn': {
      removeDuck();
      break;
    }

    case 'duck-collected': {
      removeDuck();
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      showDuckBuffOverlay(msg.buffDuration);
      gameState.duckBuffActive = true;
      break;
    }

    case 'duck-buff-expired': {
      removeDuckBuffOverlay();
      gameState.duckBuffActive = false;
      break;
    }

    // ── Hotfix Hammer ──
    case 'hammer-spawn': {
      gameState.hammer = { x: msg.hammer.x, y: msg.hammer.y };
      break;
    }

    case 'hammer-despawn': {
      removeHammer();
      break;
    }

    case 'hammer-collected': {
      removeHammer();
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      showHammerShockwave(msg.playerColor);
      break;
    }

    case 'hammer-stun-expired': {
      for (const bugId in gameState.bugs) {
        gameState.bugs[bugId].stunned = false;
      }
      if (gameState.boss) {
        gameState.boss.stunned = false;
      }
      break;
    }

    // ── Merge conflict ──
    case 'merge-conflict-resolved': {
      const bugPos = getBugLogicalPos(msg.bugId) || getBugLogicalPos(msg.partnerId);
      if (bugPos) {
        showMergeResolvedEffect(bugPos.lx, bugPos.ly);
        showParticleBurst(bugPos.lx, bugPos.ly, '#ffe66d');
      }
      removeBugFromState(msg.bugId, true);
      removeBugFromState(msg.partnerId, true);
      // Clean up merge tethers
      for (const cid of Object.keys(gameState.mergeTethers)) {
        const t = gameState.mergeTethers[cid];
        if (t.bug1 === msg.bugId || t.bug2 === msg.bugId || t.bug1 === msg.partnerId || t.bug2 === msg.partnerId) {
          delete gameState.mergeTethers[cid];
        }
      }
      updateHUD(msg.score);
      if (msg.players) {
        for (const [pid, score] of Object.entries(msg.players)) {
          if (gameState.players[pid]) gameState.players[pid].score = score as number;
        }
      }
      break;
    }

    case 'merge-conflict-halfclick': {
      const bug = gameState.bugs[msg.bugId];
      if (bug) {
        bug.mergeHalfclick = true;
        setTimeout(() => {
          if (gameState.bugs[msg.bugId]) gameState.bugs[msg.bugId].mergeHalfclick = false;
        }, 500);
      }
      break;
    }

    case 'merge-conflict-escaped': {
      removeBugFromState(msg.bugId);
      removeBugFromState(msg.partnerId);
      for (const cid of Object.keys(gameState.mergeTethers)) {
        const t = gameState.mergeTethers[cid];
        if (t.bug1 === msg.bugId || t.bug2 === msg.bugId || t.bug1 === msg.partnerId || t.bug2 === msg.partnerId) {
          delete gameState.mergeTethers[cid];
        }
      }
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('medium');
      break;
    }

    // ── Pipeline chain ──
    case 'pipeline-bug-squashed': {
      const bugPos = getBugLogicalPos(msg.bugId);
      if (bugPos) {
        showSquashEffect(bugPos.lx, bugPos.ly, msg.playerColor);
        showParticleBurst(bugPos.lx, bugPos.ly, '#a855f7');
        showImpactRing(bugPos.lx, bugPos.ly, '#a855f7');
      }
      removeBugFromState(msg.bugId, true);
      rebuildPipelineTether(msg.chainId);
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      break;
    }

    case 'pipeline-chain-resolved': {
      delete gameState.pipelineTethers[msg.chainId];
      showPipelineChainResolvedEffect();
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      break;
    }

    case 'pipeline-chain-reset': {
      for (const [bid, pos] of Object.entries(msg.positions) as [string, { x: number; y: number }][]) {
        const bug = gameState.bugs[bid];
        if (bug) {
          bug.transition = 'none';
          bug.x = pos.x;
          bug.y = pos.y;
          bug.pipelineReset = true;
          requestAnimationFrame(() => {
            if (gameState.bugs[bid]) {
              gameState.bugs[bid].transition = undefined;
              setTimeout(() => {
                if (gameState.bugs[bid]) gameState.bugs[bid].pipelineReset = false;
              }, 500);
            }
          });
        }
      }
      rebuildPipelineTether(msg.chainId);
      showPipelineChainResetEffect();
      shakeArena('light');
      break;
    }

    case 'pipeline-chain-escaped': {
      for (const bid of msg.bugIds) {
        removeBugFromState(bid);
      }
      delete gameState.pipelineTethers[msg.chainId];
      updateHUD(undefined, undefined, msg.hp);
      showDamageVignette();
      shakeArena('medium');
      break;
    }

    case 'game-over': {
      clearAllBugs();
      removeBoss();
      removeDuck();
      removeDuckBuffOverlay();
      gameState.duckBuffActive = false;
      shakeArena('heavy');
      showGameOverScreen(msg.score, msg.level, msg.players || []);
      gameState.currentPhase = 'gameover';
      break;
    }

    case 'game-win': {
      clearAllBugs();
      showWinScreen(msg.score, msg.players || []);
      gameState.currentPhase = 'win';
      break;
    }

    case 'boss-spawn': {
      hideAllScreens();
      gameState.level = -1; // Signal boss level
      gameState.currentPhase = 'boss';
      gameState.boss = {
        x: msg.boss.x, y: msg.boss.y,
        hp: msg.boss.hp, maxHp: msg.boss.maxHp,
        enraged: msg.boss.enraged,
        timeRemaining: msg.timeRemaining,
      };
      updateHUD(msg.score, undefined, msg.hp);
      break;
    }

    case 'boss-wander': {
      if (gameState.boss) {
        gameState.boss.x = msg.x;
        gameState.boss.y = msg.y;
        gameState.boss.transition = 'left 1.5s ease, top 1.5s ease';
      }
      break;
    }

    case 'boss-hit': {
      if (gameState.boss) {
        gameState.boss.hp = msg.bossHp;
        gameState.boss.maxHp = msg.bossMaxHp;
        gameState.boss.enraged = msg.enraged;
      }
      showBossHitEffect(msg.playerColor);
      if (msg.justEnraged) showEnrageFlash();
      updateHUD(msg.score);
      if (gameState.players[msg.playerId]) {
        gameState.players[msg.playerId].score = msg.playerScore;
      }
      break;
    }

    case 'boss-tick': {
      if (gameState.boss) {
        gameState.boss.timeRemaining = msg.timeRemaining;
      }
      if (msg.regenAmount > 0 && gameState.boss) {
        gameState.boss.hp = msg.bossHp;
        gameState.boss.maxHp = msg.bossMaxHp;
        showBossRegenNumber(msg.regenAmount);
      }
      if (msg.escalated) showEscalationWarning();
      break;
    }

    case 'boss-defeated': {
      if (gameState.boss) {
        // Trigger explode animation then remove
        emitVfx({ type: 'boss-explode' });
        setTimeout(() => {
          removeBoss();
          showWinScreen(msg.score, msg.players || []);
          gameState.currentPhase = 'win';
        }, 800);
      } else {
        showWinScreen(msg.score, msg.players || []);
        gameState.currentPhase = 'win';
      }
      if (msg.players) {
        msg.players.forEach((p: any) => {
          if (gameState.players[p.id]) gameState.players[p.id].score = p.score;
        });
      }
      updateHUD(msg.score);
      break;
    }

    case 'game-reset': {
      clearAllBugs();
      removeBoss();
      removeDuck();
      removeDuckBuffOverlay();
      gameState.duckBuffActive = false;
      showStartScreen();
      updateHUD(0, 1, 100);
      gameState.currentPhase = 'lobby';
      break;
    }

    case 'leaderboard': {
      gameState.leaderboardEntries = msg.entries || [];
      break;
    }
  }
}
