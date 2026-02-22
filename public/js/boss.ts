import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import { dom, clientState } from './state.ts';
import { logicalToPixel } from './coordinates.ts';
import { shakeArena, showBossDamageNumber, showImpactRing } from './vfx.ts';
import { showError, ERROR_LEVELS } from './error-handler.ts';

const PHASE_CLASSES: Record<number, string> = { 1: 'phase-sprint', 2: 'phase-shield', 3: 'phase-swarm' };
const HP_FILL_CLASSES: Record<number, string> = { 1: '', 2: 'phase-shield', 3: 'phase-swarm' };

export function createBossElement(
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  timeRemaining: number | undefined,
  extra: Record<string, any> | null | undefined
): void {
  removeBossElement();
  const phase = (extra && extra.phase) || 1;
  const shieldActive = (extra && extra.shieldActive) || false;
  const phaseName = (extra && extra.phaseName) || 'The Sprint';

  const el = document.createElement('div');
  el.className = 'boss walking ' + (PHASE_CLASSES[phase] || 'phase-sprint');
  if (shieldActive) el.classList.add('shielded');
  el.innerHTML =
    '<div class="boss-crown"><span></span><span></span><span></span></div>' +
    '<div class="boss-body">' +
      '<div class="boss-eyes">\u00d7\u00d7</div>' +
      '<div class="boss-legs">' +
        '<span></span><span></span><span></span>' +
        '<span></span><span></span><span></span>' +
      '</div>' +
    '</div>' +
    '<div class="boss-shield-overlay"></div>';

  const pos = logicalToPixel(x, y);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  el.addEventListener('click', (e: MouseEvent) => {
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

  dom.arena!.appendChild(el);
  clientState.bossElement = el;
  clientState.bossPhase = phase;
  clientState.bossPhaseName = phaseName;
  clientState.bossShieldActive = shieldActive;

  const hpContainer = document.createElement('div');
  hpContainer.className = 'boss-hp-bar-container';
  const timeStr = typeof timeRemaining === 'number' ? formatTime(timeRemaining) : '1:30';
  const urgentClass = (timeRemaining !== undefined && timeRemaining <= 20) ? ' urgent' : '';
  const fillClass = HP_FILL_CLASSES[phase] || '';
  hpContainer.innerHTML =
    '<div class="boss-timer' + urgentClass + '" id="boss-timer">' + timeStr + '</div>' +
    '<div class="boss-hp-bar-label">MEGA BUG &mdash; <span class="boss-phase-name">' + phaseName + '</span> &mdash; <span class="boss-hp-text">' + hp + '/' + maxHp + '</span></div>' +
    '<div class="boss-hp-bar-track"><div class="boss-hp-bar-fill' + (fillClass ? ' ' + fillClass : '') + '" style="width:' + ((hp / maxHp) * 100) + '%"></div></div>';
  dom.arena!.appendChild(hpContainer);
  clientState.bossHpBarContainer = hpContainer;
}

export function updateBossHp(hp: number, maxHp: number, phase?: number, damageReduction?: number): void {
  if (!clientState.bossHpBarContainer) return;
  const fill = clientState.bossHpBarContainer.querySelector('.boss-hp-bar-fill') as HTMLElement | null;
  const label = clientState.bossHpBarContainer.querySelector('.boss-hp-text') as HTMLElement | null;
  if (fill) {
    fill.style.width = ((hp / maxHp) * 100) + '%';
    // Update phase-based HP bar color
    fill.classList.remove('phase-shield', 'phase-swarm');
    const cls = HP_FILL_CLASSES[phase || clientState.bossPhase];
    if (cls) fill.classList.add(cls);
  }
  if (label) label.textContent = hp + '/' + maxHp;

  // Damage reduction indicator (phase 3)
  let drEl = clientState.bossHpBarContainer.querySelector('.boss-dr-indicator') as HTMLElement | null;
  if (typeof damageReduction === 'number' && damageReduction > 0) {
    if (!drEl) {
      drEl = document.createElement('div');
      drEl.className = 'boss-dr-indicator';
      clientState.bossHpBarContainer.appendChild(drEl);
    }
    drEl.textContent = 'SWARM ARMOR: -' + damageReduction + '% DMG';
    drEl.classList.toggle('high', damageReduction >= 50);
  } else if (drEl) {
    drEl.remove();
  }
}

export function setBossPhase(phase: number, phaseName: string): void {
  if (!clientState.bossElement) return;
  // Remove old phase class, add new
  clientState.bossElement.classList.remove('phase-sprint', 'phase-shield', 'phase-swarm');
  clientState.bossElement.classList.add(PHASE_CLASSES[phase] || 'phase-sprint');
  clientState.bossPhase = phase;
  clientState.bossPhaseName = phaseName;

  // Update HP bar label
  if (clientState.bossHpBarContainer) {
    const phaseLabel = clientState.bossHpBarContainer.querySelector('.boss-phase-name') as HTMLElement | null;
    if (phaseLabel) phaseLabel.textContent = phaseName;
    // Update fill color
    const fill = clientState.bossHpBarContainer.querySelector('.boss-hp-bar-fill') as HTMLElement | null;
    if (fill) {
      fill.classList.remove('phase-shield', 'phase-swarm');
      const cls = HP_FILL_CLASSES[phase];
      if (cls) fill.classList.add(cls);
    }
  }
}

export function setBossShield(active: boolean): void {
  if (!clientState.bossElement) return;
  if (active) {
    clientState.bossElement.classList.add('shielded');
  } else {
    clientState.bossElement.classList.remove('shielded');
  }
  clientState.bossShieldActive = active;
}

export function shrinkBoss(): void {
  if (!clientState.bossElement) return;
  clientState.bossElement.classList.add('boss-shrink');
}

export function anchorBoss(lx: number, ly: number): void {
  if (!clientState.bossElement) return;
  const pos = logicalToPixel(lx, ly);
  // boss-shrink makes the element 80x80; offset by half to center it
  clientState.bossElement.style.transition = 'left 0.5s ease, top 0.5s ease';
  clientState.bossElement.style.left = (pos.x - 40) + 'px';
  clientState.bossElement.style.top = (pos.y - 40) + 'px';
}

export function removeBossElement(): void {
  if (clientState.bossElement) { clientState.bossElement.remove(); clientState.bossElement = null; }
  if (clientState.bossHpBarContainer) { clientState.bossHpBarContainer.remove(); clientState.bossHpBarContainer = null; }
  clientState.bossPhase = 1;
  clientState.bossPhaseName = 'The Sprint';
  clientState.bossShieldActive = false;
  clientState.bossType = null;
}

export function showBossHitEffect(color: string | null | undefined, damage: number | undefined): void {
  if (!clientState.bossElement) return;
  clientState.bossElement.style.animation = 'boss-hit-flash 0.15s ease-out';
  setTimeout(() => {
    if (clientState.bossElement) clientState.bossElement.style.animation = '';
  }, 150);
  const rect = clientState.bossElement.getBoundingClientRect();
  const arenaRect = dom.arena!.getBoundingClientRect();
  const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W + (Math.random() - 0.5) * 40;
  const ly = ((rect.top - arenaRect.top) / arenaRect.height) * LOGICAL_H + (Math.random() - 0.5) * 30;
  showBossDamageNumber(lx, ly, damage || 5, color);
  showImpactRing(lx, ly, color);
  shakeArena('micro');
}

export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
