import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';
import { shakeArena, showBossDamageNumber, showImpactRing } from './vfx.js';
import { showError, ERROR_LEVELS } from './error-handler.js';

export function createBossElement(x, y, hp, maxHp, enraged, timeRemaining) {
  removeBossElement();
  const el = document.createElement('div');
  el.className = 'boss walking' + (enraged ? ' enraged' : '');
  el.innerHTML =
    '<div class="boss-crown"><span></span><span></span><span></span></div>' +
    '<div class="boss-body">' +
      '<div class="boss-eyes">\u00d7\u00d7</div>' +
      '<div class="boss-legs">' +
        '<span></span><span></span><span></span>' +
        '<span></span><span></span><span></span>' +
      '</div>' +
    '</div>';

  const pos = logicalToPixel(x, y);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  el.addEventListener('click', (e) => {
    try {
      e.stopPropagation();
      if (clientState.ws && clientState.ws.readyState === 1) {
        clientState.ws.send(JSON.stringify({ type: 'click-boss' }));
      }
    } catch (err) {
      console.error('Error handling boss click:', err);
      showError('Error clicking boss', ERROR_LEVELS.ERROR);
    }
  });

  dom.arena.appendChild(el);
  clientState.bossElement = el;

  const hpContainer = document.createElement('div');
  hpContainer.className = 'boss-hp-bar-container';
  const timeStr = typeof timeRemaining === 'number' ? formatTime(timeRemaining) : '1:30';
  const urgentClass = timeRemaining <= 20 ? ' urgent' : '';
  hpContainer.innerHTML =
    '<div class="boss-timer' + urgentClass + '" id="boss-timer">' + timeStr + '</div>' +
    '<div class="boss-hp-bar-label">MEGA BUG &mdash; <span class="boss-hp-text">' + hp + '/' + maxHp + '</span></div>' +
    '<div class="boss-hp-bar-track"><div class="boss-hp-bar-fill' + (enraged ? ' enraged' : '') + '" style="width:' + ((hp / maxHp) * 100) + '%"></div></div>';
  dom.arena.appendChild(hpContainer);
  clientState.bossHpBarContainer = hpContainer;
  clientState.bossEnraged = enraged;
}

export function updateBossHp(hp, maxHp, enraged) {
  if (!clientState.bossHpBarContainer) return;
  const fill = clientState.bossHpBarContainer.querySelector('.boss-hp-bar-fill');
  const label = clientState.bossHpBarContainer.querySelector('.boss-hp-text');
  if (fill) {
    fill.style.width = ((hp / maxHp) * 100) + '%';
    if (enraged) fill.classList.add('enraged');
    else fill.classList.remove('enraged');
  }
  if (label) label.textContent = hp + '/' + maxHp;
}

export function removeBossElement() {
  if (clientState.bossElement) { clientState.bossElement.remove(); clientState.bossElement = null; }
  if (clientState.bossHpBarContainer) { clientState.bossHpBarContainer.remove(); clientState.bossHpBarContainer = null; }
  clientState.bossEnraged = false;
}

export function showBossHitEffect(color) {
  if (!clientState.bossElement) return;
  clientState.bossElement.style.animation = 'boss-hit-flash 0.15s ease-out';
  setTimeout(() => {
    if (clientState.bossElement) clientState.bossElement.style.animation = '';
  }, 150);
  const rect = clientState.bossElement.getBoundingClientRect();
  const arenaRect = dom.arena.getBoundingClientRect();
  const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W + (Math.random() - 0.5) * 40;
  const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H + (Math.random() - 0.5) * 30;
  showBossDamageNumber(lx, ly, 5, color);
  showImpactRing(lx, ly, color);
  shakeArena('micro');
}

export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
