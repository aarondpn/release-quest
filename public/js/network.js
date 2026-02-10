import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';
import { updateHUD, updatePlayerCount, hideAllScreens, showStartScreen, showGameOverScreen, showWinScreen, showLevelScreen } from './hud.js';
import { createBugElement, removeBugElement, clearAllBugs, showSquashEffect } from './bugs.js';
import { createBossElement, updateBossHp, removeBossElement, showBossHitEffect, formatTime } from './boss.js';
import { addRemoteCursor, removeRemoteCursor, updateRemoteCursor } from './players.js';
import { shakeArena, showParticleBurst, showImpactRing, showDamageVignette, showEnrageFlash, showLevelFlash, showEscalationWarning, showBossRegenNumber } from './vfx.js';

export function sendMessage(msg) {
  if (clientState.ws && clientState.ws.readyState === 1) {
    clientState.ws.send(JSON.stringify(msg));
  }
}

export function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  clientState.ws = new WebSocket(proto + '://' + location.host + location.pathname);

  clientState.ws.onopen = () => {
    dom.connStatus.textContent = 'CONNECTED';
    dom.connStatus.className = 'conn-status connected';
  };

  clientState.ws.onclose = () => {
    dom.connStatus.textContent = 'DISCONNECTED';
    dom.connStatus.className = 'conn-status disconnected';
    setTimeout(connect, 2000);
  };

  clientState.ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleMessage(msg);
  };
}

function handleMessage(msg) {
  switch (msg.type) {

    case 'welcome': {
      clientState.myId = msg.playerId;
      clientState.myColor = msg.color;
      clientState.myIcon = msg.icon;
      clientState.myName = msg.name;

      if (msg.icon) {
        clientState.selectedIcon = msg.icon;
        dom.iconPicker.querySelectorAll('.icon-option').forEach(o => {
          o.classList.toggle('selected', o.textContent === msg.icon);
        });
      }

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
        msg.bugs.forEach(b => createBugElement(b.id, b.x, b.y));
      }

      removeBossElement();
      if (msg.boss) {
        createBossElement(msg.boss.x, msg.boss.y, msg.boss.hp, msg.boss.maxHp, msg.boss.enraged, msg.boss.timeRemaining);
        clientState.bossEnraged = msg.boss.enraged;
      }

      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.phase === 'boss') dom.levelEl.textContent = 'BOSS';
      clientState.currentPhase = msg.phase;

      if (!clientState.hasJoined) {
        dom.nameEntry.classList.remove('hidden');
        dom.nameInput.focus();
      } else {
        dom.nameEntry.classList.add('hidden');
        if (msg.phase === 'lobby') showStartScreen();
        else if (msg.phase === 'gameover') showGameOverScreen(msg.score, msg.level, msg.players || []);
        else if (msg.phase === 'win') showWinScreen(msg.score, msg.players || []);
        else if (msg.phase === 'boss') hideAllScreens();
        else hideAllScreens();
      }
      break;
    }

    case 'player-joined': {
      const p = msg.player;
      clientState.players[p.id] = p;
      if (p.id !== clientState.myId) addRemoteCursor(p.id, p.name, p.color, p.icon);
      updatePlayerCount();
      break;
    }

    case 'player-left': {
      delete clientState.players[msg.playerId];
      removeRemoteCursor(msg.playerId);
      updatePlayerCount();
      break;
    }

    case 'player-cursor': {
      updateRemoteCursor(msg.playerId, msg.x, msg.y);
      break;
    }

    case 'game-start': {
      hideAllScreens();
      clearAllBugs();
      removeBossElement();
      updateHUD(msg.score, msg.level, msg.hp);
      if (msg.players) {
        msg.players.forEach(p => { if (clientState.players[p.id]) clientState.players[p.id].score = p.score; });
      }
      break;
    }

    case 'level-start': {
      hideAllScreens();
      updateHUD(msg.score, msg.level, msg.hp);
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
      createBugElement(msg.bug.id, msg.bug.x, msg.bug.y);
      break;
    }

    case 'bug-wander': {
      const el = clientState.bugs[msg.bugId];
      if (el) {
        const pos = logicalToPixel(msg.x, msg.y);
        const lvlText = dom.levelEl.textContent;
        let dur;
        if (lvlText === 'BOSS') {
          dur = 3500 * 0.4;
        } else {
          const cfg = { 1: 5000, 2: 3800, 3: 2800 };
          dur = (cfg[parseInt(lvlText)] || 5000) * 0.4;
        }
        el.style.transition = 'left ' + dur + 'ms linear, top ' + dur + 'ms linear';
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
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

    case 'game-over': {
      clearAllBugs();
      removeBossElement();
      shakeArena('heavy');
      showGameOverScreen(msg.score, msg.level, msg.players || []);
      break;
    }

    case 'game-win': {
      clearAllBugs();
      showWinScreen(msg.score, msg.players || []);
      break;
    }

    case 'boss-spawn': {
      hideAllScreens();
      dom.levelEl.textContent = 'BOSS';
      createBossElement(msg.boss.x, msg.boss.y, msg.boss.hp, msg.boss.maxHp, msg.boss.enraged, msg.timeRemaining);
      updateHUD(msg.score, undefined, msg.hp);
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
      break;
    }

    case 'game-reset': {
      clearAllBugs();
      removeBossElement();
      showStartScreen();
      updateHUD(0, 1, 100);
      break;
    }
  }
}
