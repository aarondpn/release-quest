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

export function showPhaseTransitionFlash(phaseName) {
  const flash = document.createElement('div');
  flash.className = 'phase-transition-flash';
  dom.arena.appendChild(flash);

  const text = document.createElement('div');
  text.className = 'phase-transition-text';
  text.textContent = phaseName;
  dom.arena.appendChild(text);

  // Burst of sparks from boss position toward edges
  if (clientState.bossElement) {
    const rect = clientState.bossElement.getBoundingClientRect();
    const arenaRect = dom.arena.getBoundingClientRect();
    const cx = ((rect.left - arenaRect.left + rect.width / 2) / arenaRect.width) * LOGICAL_W;
    const cy = ((rect.top - arenaRect.top + rect.height / 2) / arenaRect.height) * LOGICAL_H;
    // Ring of particles radiating outward
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.4;
      const dist = 60 + Math.random() * 60;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const pos = logicalToPixel(cx, cy);
      const p = document.createElement('div');
      p.className = 'phase-spark';
      p.style.left = pos.x + 'px';
      p.style.top = pos.y + 'px';
      p.style.setProperty('--px', px + 'px');
      p.style.setProperty('--py', py + 'px');
      dom.arena.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  setTimeout(() => flash.remove(), 1600);
  setTimeout(() => text.remove(), 1600);
  shakeArena('heavy');
}

export function showBlockedText(lx, ly) {
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'boss-blocked-text';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = 'BLOCKED!';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

export function showScreenWipeFlash() {
  const el = document.createElement('div');
  el.className = 'screen-wipe-flash';
  dom.arena.appendChild(el);
  setTimeout(() => el.remove(), 700);
  shakeArena('light');
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
let _duckBuffInterval = null;
let _duckBuffTimeout = null;

export function showDuckBuffOverlay(duration) {
  removeDuckBuffOverlay();
  const el = document.createElement('div');
  el.className = 'duck-buff-overlay';
  el.id = 'duck-buff-overlay';

  const label = document.createElement('div');
  label.className = 'duck-buff-label';
  label.textContent = '×2 PTS';
  el.appendChild(label);

  const timer = document.createElement('div');
  timer.className = 'duck-buff-timer';
  el.appendChild(timer);

  const endTime = Date.now() + duration;
  function tick() {
    const remaining = Math.max(0, endTime - Date.now());
    timer.textContent = (remaining / 1000).toFixed(1) + 's';
  }
  tick();
  _duckBuffInterval = setInterval(tick, 100);

  dom.arena.appendChild(el);
  _duckBuffTimeout = setTimeout(() => removeDuckBuffOverlay(), duration);
}

export function removeDuckBuffOverlay() {
  if (_duckBuffInterval !== null) { clearInterval(_duckBuffInterval); _duckBuffInterval = null; }
  if (_duckBuffTimeout !== null) { clearTimeout(_duckBuffTimeout); _duckBuffTimeout = null; }
  const existing = document.getElementById('duck-buff-overlay');
  if (existing) existing.remove();
}

// ── Hammer stun overlay ──
let _hammerStunInterval = null;
let _hammerStunTimeout = null;

export function showHammerStunOverlay(duration) {
  removeHammerStunOverlay();
  const el = document.createElement('div');
  el.className = 'hammer-stun-overlay';
  el.id = 'hammer-stun-overlay';

  const label = document.createElement('div');
  label.className = 'hammer-stun-label';
  label.textContent = 'STUNNED';
  el.appendChild(label);

  const timer = document.createElement('div');
  timer.className = 'hammer-stun-timer';
  el.appendChild(timer);

  const endTime = Date.now() + duration;
  function tick() {
    const remaining = Math.max(0, endTime - Date.now());
    timer.textContent = (remaining / 1000).toFixed(1) + 's';
  }
  tick();
  _hammerStunInterval = setInterval(tick, 100);

  dom.arena.appendChild(el);
  _hammerStunTimeout = setTimeout(() => removeHammerStunOverlay(), duration);
}

export function removeHammerStunOverlay() {
  if (_hammerStunInterval !== null) { clearInterval(_hammerStunInterval); _hammerStunInterval = null; }
  if (_hammerStunTimeout !== null) { clearTimeout(_hammerStunTimeout); _hammerStunTimeout = null; }
  const existing = document.getElementById('hammer-stun-overlay');
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

// ── Infinite loop breakpoint hit effect ──
export function showBreakpointHitEffect(lx, ly) {
  const pos = logicalToPixel(lx, ly);

  // "BREAK;" rising text
  const text = document.createElement('div');
  text.className = 'infinite-loop-break-text';
  text.style.left = pos.x + 'px';
  text.style.top = pos.y + 'px';
  text.textContent = 'BREAK;';
  dom.arena.appendChild(text);
  setTimeout(() => text.remove(), 1100);

  // Breakpoint shatter: red diamond shards flying outward
  const shardCount = 8;
  for (let i = 0; i < shardCount; i++) {
    const angle = (Math.PI * 2 * i / shardCount) + (Math.random() - 0.5) * 0.5;
    const dist = 25 + Math.random() * 35;
    const shard = document.createElement('div');
    shard.className = 'bp-shatter-shard';
    shard.style.left = pos.x + 'px';
    shard.style.top = pos.y + 'px';
    shard.style.setProperty('--sx', (Math.cos(angle) * dist) + 'px');
    shard.style.setProperty('--sy', (Math.sin(angle) * dist) + 'px');
    shard.style.setProperty('--sr', (Math.random() * 360) + 'deg');
    dom.arena.appendChild(shard);
    setTimeout(() => shard.remove(), 500);
  }
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
