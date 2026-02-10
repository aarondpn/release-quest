import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';

const SHAKE_DURATIONS = { light: 200, micro: 100, medium: 300, heavy: 500 };

export function shakeArena(intensity) {
  const cls = 'shake-' + intensity;
  dom.arena.classList.remove(cls);
  void dom.arena.offsetWidth;
  dom.arena.classList.add(cls);
  setTimeout(() => dom.arena.classList.remove(cls), SHAKE_DURATIONS[intensity] || 300);
}

export function showParticleBurst(lx, ly, color) {
  const pos = logicalToPixel(lx, ly);
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
    const dist = 30 + Math.random() * 30;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = pos.x + 'px';
    p.style.top = pos.y + 'px';
    p.style.background = color || 'var(--yellow)';
    p.style.setProperty('--px', px + 'px');
    p.style.setProperty('--py', py + 'px');
    dom.arena.appendChild(p);
    setTimeout(() => p.remove(), 450);
  }
}

export function showImpactRing(lx, ly, color) {
  const pos = logicalToPixel(lx, ly);
  const ring = document.createElement('div');
  ring.className = 'impact-ring';
  ring.style.left = pos.x + 'px';
  ring.style.top = pos.y + 'px';
  ring.style.color = color || 'var(--yellow)';
  dom.arena.appendChild(ring);
  setTimeout(() => ring.remove(), 450);
}

export function showDamageVignette() {
  const v = document.createElement('div');
  v.className = 'damage-vignette';
  dom.arena.appendChild(v);
  setTimeout(() => v.remove(), 450);
}

export function showEnrageFlash() {
  const el = document.createElement('div');
  el.className = 'enrage-flash';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 450);
  shakeArena('medium');
}

export function showLevelFlash() {
  const el = document.createElement('div');
  el.className = 'level-flash';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 550);
}

export function showEscalationWarning() {
  const el = document.createElement('div');
  el.className = 'escalation-flash';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 450);
  shakeArena('light');
}

export function showBossDamageNumber(lx, ly, damage, color) {
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'boss-damage-num';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.style.color = color || 'var(--yellow)';
  el.textContent = '-' + damage;
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

export function showBossRegenNumber(amount) {
  if (!clientState.bossElement) return;
  const rect = clientState.bossElement.getBoundingClientRect();
  const arenaRect = dom.arena.getBoundingClientRect();
  const lx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W + (Math.random() - 0.5) * 30;
  const ly = ((rect.top - arenaRect.top + rect.height * 0.3) / arenaRect.height) * LOGICAL_H;
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'boss-regen-num';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = '+' + amount;
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

// ── Heisenbug flee effect ──
export function showHeisenbugFleeEffect(bugEl) {
  if (!bugEl) return;
  const ghost = document.createElement('div');
  ghost.className = 'heisenbug-ghost';
  ghost.style.left = bugEl.style.left;
  ghost.style.top = bugEl.style.top;
  ghost.textContent = '?';
  dom.arena.appendChild(ghost);
  setTimeout(() => ghost.remove(), 400);
}

// ── Feature penalty effect ──
export function showFeaturePenaltyEffect(lx, ly) {
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'feature-penalty-text';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = 'THAT WAS A FEATURE!';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ── Duck buff overlay ──
export function showDuckBuffOverlay(duration) {
  removeDuckBuffOverlay();
  const el = document.createElement('div');
  el.className = 'duck-buff-overlay';
  el.id = 'duck-buff-overlay';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function removeDuckBuffOverlay() {
  const existing = document.getElementById('duck-buff-overlay');
  if (existing) existing.remove();
}

// ── Pipeline chain resolved effect ──
export function showPipelineChainResolvedEffect() {
  const el = document.createElement('div');
  el.className = 'pipeline-resolved-text';
  el.style.left = '50%';
  el.style.top = '40%';
  el.textContent = 'DEPLOYED!';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ── Pipeline chain reset effect ──
export function showPipelineChainResetEffect() {
  const el = document.createElement('div');
  el.className = 'pipeline-reset-text';
  el.style.left = '50%';
  el.style.top = '40%';
  el.textContent = 'STAGE FAILED!';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ── Merge conflict resolved effect ──
export function showMergeResolvedEffect(lx, ly) {
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'merge-resolved-text';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = 'MERGED!';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
