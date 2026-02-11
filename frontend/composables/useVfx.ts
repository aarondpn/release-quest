import { LOGICAL_W, LOGICAL_H, SQUASH_WORDS } from '../config';
import { logicalToPixel, getArenaRect } from './useCoordinates';
import { gameState } from './useGameState';

let arenaEl: HTMLElement | null = null;

export function setVfxArena(el: HTMLElement | null) {
  arenaEl = el;
}

function getArena(): HTMLElement | null {
  return arenaEl;
}

const SHAKE_DURATIONS: Record<string, number> = { light: 200, micro: 100, medium: 300, heavy: 500 };

export function shakeArena(intensity: string) {
  const arena = getArena();
  if (!arena) return;
  const cls = 'shake-' + intensity;
  arena.classList.remove(cls);
  void arena.offsetWidth;
  arena.classList.add(cls);
  setTimeout(() => arena.classList.remove(cls), SHAKE_DURATIONS[intensity] || 300);
}

export function showParticleBurst(lx: number, ly: number, color?: string) {
  const arena = getArena();
  if (!arena) return;
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
    arena.appendChild(p);
    setTimeout(() => p.remove(), 450);
  }
}

export function showImpactRing(lx: number, ly: number, color?: string) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const ring = document.createElement('div');
  ring.className = 'impact-ring';
  ring.style.left = pos.x + 'px';
  ring.style.top = pos.y + 'px';
  ring.style.color = color || 'var(--yellow)';
  arena.appendChild(ring);
  setTimeout(() => ring.remove(), 450);
}

export function showDamageVignette() {
  const arena = getArena();
  if (!arena) return;
  const v = document.createElement('div');
  v.className = 'damage-vignette';
  arena.appendChild(v);
  setTimeout(() => v.remove(), 450);
}

export function showEnrageFlash() {
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'enrage-flash';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 450);
  shakeArena('medium');
}

export function showLevelFlash() {
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'level-flash';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 550);
}

export function showEscalationWarning() {
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'escalation-flash';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 450);
  shakeArena('light');
}

export function showBossDamageNumber(lx: number, ly: number, damage: number, color?: string) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'boss-damage-num';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.style.color = color || 'var(--yellow)';
  el.textContent = '-' + damage;
  arena.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

export function showBossRegenNumber(amount: number) {
  const arena = getArena();
  if (!arena || !gameState.boss) return;
  // Estimate boss position from state
  const bossPos = logicalToPixel(gameState.boss.x, gameState.boss.y);
  const lx = gameState.boss.x + (Math.random() - 0.5) * 30;
  const ly = gameState.boss.y * 0.7;
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'boss-regen-num';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = '+' + amount;
  arena.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

export function showHeisenbugFleeEffect(lx: number, ly: number) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const ghost = document.createElement('div');
  ghost.className = 'heisenbug-ghost';
  ghost.style.left = pos.x + 'px';
  ghost.style.top = pos.y + 'px';
  ghost.textContent = '?';
  arena.appendChild(ghost);
  setTimeout(() => ghost.remove(), 400);
}

export function showFeaturePenaltyEffect(lx: number, ly: number) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'feature-penalty-text';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = 'THAT WAS A FEATURE!';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function showDuckBuffOverlay(duration: number) {
  removeDuckBuffOverlay();
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'duck-buff-overlay';
  el.id = 'duck-buff-overlay';
  arena.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function removeDuckBuffOverlay() {
  const existing = document.getElementById('duck-buff-overlay');
  if (existing) existing.remove();
}

export function showPipelineChainResolvedEffect() {
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'pipeline-resolved-text';
  el.style.left = '50%';
  el.style.top = '40%';
  el.textContent = 'DEPLOYED!';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function showPipelineChainResetEffect() {
  const arena = getArena();
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'pipeline-reset-text';
  el.style.left = '50%';
  el.style.top = '40%';
  el.textContent = 'STAGE FAILED!';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function showMergeResolvedEffect(lx: number, ly: number) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const el = document.createElement('div');
  el.className = 'merge-resolved-text';
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.textContent = 'MERGED!';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function showSquashEffect(lx: number, ly: number, color?: string) {
  const arena = getArena();
  if (!arena) return;
  const pos = logicalToPixel(lx, ly);
  const fx = document.createElement('div');
  fx.className = 'squash';
  fx.style.left = pos.x + 'px';
  fx.style.top = pos.y + 'px';
  const word = SQUASH_WORDS[Math.floor(Math.random() * SQUASH_WORDS.length)];
  fx.innerHTML = '<span class="squash-text" style="color:' + (color || 'var(--yellow)') + '">' + word + '</span>';
  arena.appendChild(fx);
  setTimeout(() => fx.remove(), 600);
}

export function showBossHitEffect(color: string) {
  if (!gameState.boss) return;
  const lx = gameState.boss.x + (Math.random() - 0.5) * 40;
  const ly = gameState.boss.y + (Math.random() - 0.5) * 30;
  showBossDamageNumber(lx, ly, 5, color);
  showImpactRing(lx, ly, color);
  shakeArena('micro');
}

export function showHammerShockwave(playerColor: string) {
  const arena = getArena();
  if (!arena) return;
  const shockwave = document.createElement('div');
  shockwave.className = 'hammer-shockwave';
  shockwave.style.borderColor = playerColor;
  arena.appendChild(shockwave);
  setTimeout(() => shockwave.remove(), 800);

  // Stun all bugs visually
  for (const bugId in gameState.bugs) {
    gameState.bugs[bugId].stunned = true;
  }
  // Stun boss visually
  if (gameState.boss) {
    gameState.boss.stunned = true;
  }
  shakeArena('medium');
}

export function showArenaBorderFlash() {
  const arena = getArena();
  if (!arena) return;
  arena.style.borderColor = 'var(--red)';
  setTimeout(() => { arena.style.borderColor = '#2a2a4a'; }, 300);
}
