import { dom } from './state.ts';
import type { SendMessageFn } from './client-types.ts';
import type { MiniBossEntity } from '../../shared/types.ts';

let _sendMessage: SendMessageFn | null = null;
let _sequenceAnimTimer: ReturnType<typeof setTimeout> | null = null;

export function initMiniBossSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

// ── SVG Icon Library ──────────────────────────────────────────────────────────
// Inline SVGs replace all emoji icons for a sharp, dangerous, vector-art look.

const SVG_ICONS = {
  // Stack Overflow boss: a menacing overheating CPU/processor
  overheatBoss: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="28" height="28" rx="3" fill="#1a1a2e" stroke="#ff6b6b" stroke-width="2"/>
    <rect x="14" y="14" width="20" height="20" rx="1" fill="#0f0e17" stroke="#a855f7" stroke-width="1.5"/>
    <path d="M20 20L28 28M28 20L20 28" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="16" x2="10" y2="16" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="24" x2="10" y2="24" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="32" x2="10" y2="32" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="16" x2="40" y2="16" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="24" x2="40" y2="24" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="32" x2="40" y2="32" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="8" x2="16" y2="10" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="8" x2="24" y2="10" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="8" x2="32" y2="10" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="38" x2="16" y2="40" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="38" x2="24" y2="40" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
    <line x1="32" y1="38" x2="32" y2="40" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // Coolant pickup: crystalline shard
  coolant: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 4L24 14L18 32L12 14Z" fill="#1b3a35" stroke="#4ecdc4" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M18 8L22 14L18 26L14 14Z" fill="rgba(78,205,196,0.2)"/>
    <line x1="18" y1="4" x2="18" y2="32" stroke="rgba(78,205,196,0.3)" stroke-width="0.5"/>
    <circle cx="18" cy="14" r="2" fill="#4ecdc4" opacity="0.6"/>
  </svg>`,

  // Thread entity: process/thread visualization
  threadA: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="16" fill="#0f0e17" stroke="#4ecdc4" stroke-width="2"/>
    <circle cx="24" cy="24" r="10" fill="none" stroke="#4ecdc4" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
    <path d="M18 20L24 14L30 20" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="24" y1="14" x2="24" y2="32" stroke="#4ecdc4" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="3" fill="#4ecdc4" opacity="0.4"/>
  </svg>`,

  threadB: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="16" fill="#0f0e17" stroke="#ff6b6b" stroke-width="2"/>
    <circle cx="24" cy="24" r="10" fill="none" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
    <path d="M18 28L24 34L30 28" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="24" y1="16" x2="24" y2="34" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="3" fill="#ff6b6b" opacity="0.4"/>
  </svg>`,

  // Lock: hexagonal lock node for deadlock
  lock: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 4L38 13V31L22 40L6 31V13Z" fill="#1a1a2e" stroke="#a855f7" stroke-width="1.5"/>
    <rect x="16" y="19" width="12" height="10" rx="2" fill="#0f0e17" stroke="#a855f7" stroke-width="1.5"/>
    <path d="M18 19V16C18 13.8 19.8 12 22 12C24.2 12 26 13.8 26 16V19" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="22" cy="25" r="1.5" fill="#a855f7"/>
  </svg>`,

  // Lock highlighted in sequence
  lockHighlight: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 4L38 13V31L22 40L6 31V13Z" fill="rgba(255,230,109,0.15)" stroke="#ffe66d" stroke-width="2"/>
    <rect x="16" y="19" width="12" height="10" rx="2" fill="rgba(255,230,109,0.1)" stroke="#ffe66d" stroke-width="1.5"/>
    <path d="M18 19V16C18 13.8 19.8 12 22 12C24.2 12 26 13.8 26 16V19" fill="none" stroke="#ffe66d" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="22" cy="25" r="1.5" fill="#ffe66d"/>
  </svg>`,

  // Header icons (larger, more detailed)
  headerOverheat: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="12" width="32" height="32" rx="4" fill="#1a1a2e" stroke="#ff6b6b" stroke-width="2"/>
    <rect x="17" y="17" width="22" height="22" rx="2" fill="#0f0e17" stroke="#a855f7" stroke-width="1"/>
    <path d="M24 24L32 32M32 24L24 32" stroke="#ff6b6b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M28 6V12" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M28 44V50" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M6 28H12" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M44 28H50" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M12 12L8 8M44 12L48 8M12 44L8 48M44 44L48 48" stroke="#ff6b6b" stroke-width="1" stroke-linecap="round" opacity="0.3"/>
    <line x1="18" y1="10" x2="18" y2="12" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="24" y1="10" x2="24" y2="12" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="32" y1="10" x2="32" y2="12" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="38" y1="10" x2="38" y2="12" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="18" y1="44" x2="18" y2="46" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="24" y1="44" x2="24" y2="46" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="32" y1="44" x2="32" y2="46" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="38" y1="44" x2="38" y2="46" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="10" y1="18" x2="12" y2="18" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="10" y1="24" x2="12" y2="24" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="10" y1="32" x2="12" y2="32" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="10" y1="38" x2="12" y2="38" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="44" y1="18" x2="46" y2="18" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="44" y1="24" x2="46" y2="24" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="44" y1="32" x2="46" y2="32" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="44" y1="38" x2="46" y2="38" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  headerRaceCondition: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="28" r="12" fill="none" stroke="#4ecdc4" stroke-width="1.5" stroke-dasharray="3 2"/>
    <circle cx="38" cy="28" r="12" fill="none" stroke="#ff6b6b" stroke-width="1.5" stroke-dasharray="3 2"/>
    <circle cx="18" cy="28" r="6" fill="rgba(78,205,196,0.15)" stroke="#4ecdc4" stroke-width="1.5"/>
    <circle cx="38" cy="28" r="6" fill="rgba(255,107,107,0.15)" stroke="#ff6b6b" stroke-width="1.5"/>
    <path d="M12 22L18 16L24 22" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 34L38 40L44 34" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 28H32" stroke="#a855f7" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
    <circle cx="28" cy="28" r="2" fill="#a855f7" opacity="0.3"/>
  </svg>`,

  headerDeadlock: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 6L48 17.5V40.5L28 52L8 40.5V17.5Z" fill="none" stroke="#a855f7" stroke-width="1" opacity="0.3"/>
    <path d="M28 14L40 21V35L28 42L16 35V21Z" fill="none" stroke="#a855f7" stroke-width="1.5"/>
    <rect x="21" y="24" width="14" height="11" rx="2" fill="#1a1a2e" stroke="#a855f7" stroke-width="1.5"/>
    <path d="M23 24V20C23 17.2 25.2 15 28 15C30.8 15 33 17.2 33 20V24" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="28" cy="30" r="2" fill="#a855f7"/>
    <line x1="28" y1="30" x2="28" y2="33" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // Result icons
  victory: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="16" fill="rgba(78,205,196,0.15)" stroke="#4ecdc4" stroke-width="2"/>
    <path d="M13 20L18 25L28 15" stroke="#4ecdc4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  defeat: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="16" fill="rgba(255,107,107,0.15)" stroke="#ff6b6b" stroke-width="2"/>
    <path d="M14 14L26 26M26 14L14 26" stroke="#ff6b6b" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  // Heat gauge thermometer icon
  heatIcon: `<svg viewBox="0 0 16 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 17.5V6C11 4.3 9.7 3 8 3C6.3 3 5 4.3 5 6V17.5C3.2 18.7 2 20.7 2 23C2 26.3 4.7 25 8 25C11.3 25 14 26.3 14 23C14 20.7 12.8 18.7 11 17.5Z" fill="none" stroke="#ff6b6b" stroke-width="1.5"/>
    <circle cx="8" cy="21" r="3" fill="#ff6b6b" opacity="0.6"/>
    <line x1="8" y1="8" x2="8" y2="18" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
} as const;

function getHeaderIcon(miniBossType: string): string {
  switch (miniBossType) {
    case 'stack-overflow': return SVG_ICONS.headerOverheat;
    case 'race-condition': return SVG_ICONS.headerRaceCondition;
    case 'deadlock': return SVG_ICONS.headerDeadlock;
    default: return '';
  }
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function showMiniBossScreen(msg: {
  miniBossType: string;
  title: string;
  icon: string;
  description: string;
  timeLimit: number;
  entities: MiniBossEntity[];
  extra?: Record<string, unknown>;
}): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  if (_sequenceAnimTimer) {
    clearTimeout(_sequenceAnimTimer);
    _sequenceAnimTimer = null;
  }

  screen.innerHTML = '';
  screen.classList.remove('hidden');

  // Danger scan-line background inside the arena
  const headerIcon = getHeaderIcon(msg.miniBossType);

  const header = document.createElement('div');
  header.className = 'mini-boss-header';
  header.innerHTML =
    '<div class="mini-boss-icon">' + headerIcon + '</div>' +
    '<div class="mini-boss-title-row">' +
      '<div class="mini-boss-title">' + msg.title + '</div>' +
      '<div class="mini-boss-timer">' +
        '<span class="mini-boss-timer-text">' + msg.timeLimit + 's</span>' +
      '</div>' +
    '</div>' +
    '<div class="mini-boss-desc">' + msg.description + '</div>';
  screen.appendChild(header);

  // Extra UI elements based on type
  if (msg.miniBossType === 'stack-overflow') {
    screen.appendChild(buildHeatGauge(msg.extra || {}));
  }
  if (msg.miniBossType === 'deadlock') {
    screen.appendChild(buildBossHpBar(msg.extra || {}));
  }

  const arena = document.createElement('div');
  arena.className = 'mini-boss-arena';
  arena.id = 'mini-boss-arena';
  arena.dataset.miniBossType = msg.miniBossType;

  // Type-specific arena modifiers
  arena.classList.add('arena-' + msg.miniBossType);

  screen.appendChild(arena);

  // Arena-level click handler for position-based mechanics (Race Condition)
  if (msg.miniBossType === 'race-condition') {
    arena.addEventListener('click', (e) => {
      if (!_sendMessage) return;
      const rect = arena.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 800;
      const y = ((e.clientY - rect.top) / rect.height) * 500;
      _sendMessage({ type: 'mini-boss-click', entityId: '', x, y });

      // Click ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'mb-click-ripple';
      ripple.style.left = ((e.clientX - rect.left) / rect.width * 100) + '%';
      ripple.style.top = ((e.clientY - rect.top) / rect.height * 100) + '%';
      arena.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  renderEntities(arena, msg.entities, msg.miniBossType);

  // Start sequence animation for deadlock
  if (msg.miniBossType === 'deadlock' && msg.extra) {
    animateSequence(arena, msg.extra);
  }
}

// ── Heat Gauge (Stack Overflow) ───────────────────────────────────────────────

function buildHeatGauge(extra: Record<string, unknown>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mini-boss-heat-gauge';
  container.id = 'mini-boss-heat-gauge';

  const heat = (extra.heat as number) || 0;
  const lockedOut = (extra.lockedOut as boolean) || false;

  container.innerHTML =
    '<div class="heat-icon">' + SVG_ICONS.heatIcon + '</div>' +
    '<div class="heat-track">' +
      '<div class="heat-segments">' +
        buildHeatSegments() +
      '</div>' +
      '<div class="heat-fill' + (lockedOut ? ' overheated' : '') + '" style="width:' + heat + '%"></div>' +
      '<div class="heat-threshold"></div>' +
    '</div>' +
    '<div class="heat-value">' + Math.round(heat) + '%</div>' +
    (lockedOut ? '<div class="heat-lockout-badge">LOCKED</div>' : '');

  return container;
}

function buildHeatSegments(): string {
  let html = '';
  for (let i = 0; i < 10; i++) {
    html += '<div class="heat-segment"></div>';
  }
  return html;
}

function updateHeatGauge(extra: Record<string, unknown>): void {
  const gauge = document.getElementById('mini-boss-heat-gauge');
  if (!gauge) return;

  const heat = (extra.heat as number) || 0;
  const lockedOut = (extra.lockedOut as boolean) || false;

  const fill = gauge.querySelector<HTMLElement>('.heat-fill');
  if (fill) {
    fill.style.width = heat + '%';
    fill.classList.toggle('overheated', lockedOut);
  }

  const value = gauge.querySelector<HTMLElement>('.heat-value');
  if (value) value.textContent = Math.round(heat) + '%';

  const existing = gauge.querySelector('.heat-lockout-badge');
  if (lockedOut && !existing) {
    const lockout = document.createElement('div');
    lockout.className = 'heat-lockout-badge';
    lockout.textContent = 'LOCKED';
    gauge.appendChild(lockout);
  } else if (!lockedOut && existing) {
    existing.remove();
  }
}

// ── Boss HP Bar (Deadlock) ────────────────────────────────────────────────────

function buildBossHpBar(extra: Record<string, unknown>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mini-boss-boss-hp';
  container.id = 'mini-boss-boss-hp';

  const hp = (extra.bossHp as number) || 0;
  const maxHp = (extra.bossMaxHp as number) || 30;
  const pct = Math.max(0, (hp / maxHp) * 100);
  const round = (extra.round as number) || 1;
  const phase = (extra.phase as string) || 'showing';

  container.innerHTML =
    '<div class="mb-hp-header">' +
      '<span class="mb-hp-label">INTEGRITY</span>' +
      '<span class="mb-hp-round">SEQ ' + round + '</span>' +
    '</div>' +
    '<div class="mb-hp-track">' +
      '<div class="mb-hp-fill" style="width:' + pct + '%"></div>' +
      '<div class="mb-hp-stripe"></div>' +
    '</div>' +
    '<div class="mb-hp-phase ' + (phase === 'showing' ? 'phase-showing' : 'phase-input') + '">' +
      (phase === 'showing' ? 'MEMORIZE' : 'INPUT') +
    '</div>';

  return container;
}

function updateBossHpBar(extra: Record<string, unknown>): void {
  const container = document.getElementById('mini-boss-boss-hp');
  if (!container) return;

  const hp = (extra.bossHp as number) || 0;
  const maxHp = (extra.bossMaxHp as number) || 30;
  const pct = Math.max(0, (hp / maxHp) * 100);
  const round = (extra.round as number) || 1;
  const phase = (extra.phase as string) || 'showing';

  const fill = container.querySelector<HTMLElement>('.mb-hp-fill');
  if (fill) fill.style.width = pct + '%';

  const roundEl = container.querySelector<HTMLElement>('.mb-hp-round');
  if (roundEl) roundEl.textContent = 'SEQ ' + round;

  const phaseEl = container.querySelector<HTMLElement>('.mb-hp-phase');
  if (phaseEl) {
    phaseEl.textContent = phase === 'showing' ? 'MEMORIZE' : 'INPUT';
    phaseEl.className = 'mb-hp-phase ' + (phase === 'showing' ? 'phase-showing' : 'phase-input');
  }
}

// ── Sequence Animation (Deadlock) ─────────────────────────────────────────────

function animateSequence(arena: HTMLElement, extra: Record<string, unknown>): void {
  const phase = extra.phase as string;
  if (phase !== 'showing') return;

  const sequence = extra.sequence as string[] | undefined;
  if (!sequence || sequence.length === 0) return;

  const durationPerLock = (extra.showDurationPerLock as number) || 800;
  const pause = (extra.showPause as number) || 500;

  arena.classList.add('showing-sequence');

  let i = 0;
  function highlightNext(): void {
    arena.querySelectorAll('.sequence-highlight').forEach(el => {
      el.classList.remove('sequence-highlight');
      // Restore default lock SVG
      const iconEl = el.querySelector('.mini-boss-entity-icon');
      if (iconEl) iconEl.innerHTML = SVG_ICONS.lock;
    });

    if (i >= sequence!.length) {
      arena.classList.remove('showing-sequence');
      _sequenceAnimTimer = null;
      return;
    }

    const entityId = sequence![i];
    const el = arena.querySelector<HTMLElement>(`[data-entity-id="${entityId}"]`);
    if (el) {
      el.classList.add('sequence-highlight');
      // Swap in highlight SVG
      const iconEl = el.querySelector('.mini-boss-entity-icon');
      if (iconEl) iconEl.innerHTML = SVG_ICONS.lockHighlight;
    }

    i++;
    _sequenceAnimTimer = setTimeout(highlightNext, durationPerLock);
  }

  _sequenceAnimTimer = setTimeout(highlightNext, pause);
}

// ── Entity Rendering ──────────────────────────────────────────────────────────

function renderEntities(arena: HTMLElement, entities: MiniBossEntity[], miniBossType: string): void {
  // Keep any non-entity children (ripples, results)
  arena.querySelectorAll('[data-entity-id]').forEach(el => el.remove());

  for (const entity of entities) {
    arena.appendChild(createEntityElement(entity, miniBossType));
  }
}

function createEntityElement(entity: MiniBossEntity, miniBossType: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mini-boss-entity';
  el.dataset.entityId = entity.id;

  if (entity.variant) el.classList.add('variant-' + entity.variant);
  if (entity.hp <= 0) el.classList.add('defeated');
  if (entity.frozen) el.classList.add('frozen');

  const xPct = (entity.x / 800) * 100;
  const yPct = (entity.y / 500) * 100;
  el.style.left = xPct + '%';
  el.style.top = yPct + '%';

  const showHp = miniBossType !== 'deadlock';
  const hpPct = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp * 100) : 0;
  const entityIcon = getEntityIcon(miniBossType, entity);

  el.innerHTML =
    '<div class="mini-boss-entity-icon">' + entityIcon + '</div>' +
    (entity.label
      ? '<div class="mini-boss-entity-label label-' + (entity.variant || '') + '">' + entity.label + '</div>'
      : '') +
    (showHp
      ? '<div class="mini-boss-entity-hp">' +
          '<div class="mini-boss-entity-hp-fill" style="width:' + hpPct + '%"></div>' +
        '</div>'
      : '');

  // Click handler (not for race-condition — uses arena-level clicks)
  if (miniBossType !== 'race-condition') {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_sendMessage && entity.hp > 0) {
        _sendMessage({ type: 'mini-boss-click', entityId: entity.id });
      }
    });
  }

  return el;
}

function getEntityIcon(miniBossType: string, entity: MiniBossEntity): string {
  switch (miniBossType) {
    case 'stack-overflow':
      return entity.variant === 'coolant' ? SVG_ICONS.coolant : SVG_ICONS.overheatBoss;
    case 'race-condition':
      return entity.variant === 'thread-b' ? SVG_ICONS.threadB : SVG_ICONS.threadA;
    case 'deadlock':
      return SVG_ICONS.lock;
    default:
      return SVG_ICONS.overheatBoss;
  }
}

// ── Entity Updates ────────────────────────────────────────────────────────────

export function updateMiniBossEntities(msg: {
  entities: MiniBossEntity[];
  warning?: string;
  extra?: Record<string, unknown>;
}): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const arena = screen.querySelector<HTMLElement>('#mini-boss-arena');
  if (!arena) return;

  const type = arena.dataset.miniBossType || '';

  // Update extra UI
  if (msg.extra) {
    if (type === 'stack-overflow') updateHeatGauge(msg.extra);
    if (type === 'deadlock') updateBossHpBar(msg.extra);

    // Collision flash for race-condition
    if (type === 'race-condition' && msg.extra.collisionFlash) {
      arena.classList.add('collision-flash');
      setTimeout(() => arena.classList.remove('collision-flash'), 400);
    }

    // New sequence started for deadlock
    if (type === 'deadlock' && msg.extra.phase === 'showing') {
      if (_sequenceAnimTimer) {
        clearTimeout(_sequenceAnimTimer);
        _sequenceAnimTimer = null;
      }
      arena.querySelectorAll('.sequence-highlight').forEach(el => {
        el.classList.remove('sequence-highlight');
        const iconEl = el.querySelector('.mini-boss-entity-icon');
        if (iconEl) iconEl.innerHTML = SVG_ICONS.lock;
      });
      animateSequence(arena, msg.extra);
    }
  }

  // Update existing entities
  for (const entity of msg.entities) {
    const el = arena.querySelector<HTMLElement>(`[data-entity-id="${entity.id}"]`);
    if (!el) continue;

    const xPct = (entity.x / 800) * 100;
    const yPct = (entity.y / 500) * 100;
    el.style.left = xPct + '%';
    el.style.top = yPct + '%';

    const hpFill = el.querySelector<HTMLElement>('.mini-boss-entity-hp-fill');
    if (hpFill) {
      const hpPct = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp * 100) : 0;
      hpFill.style.width = hpPct + '%';
    }

    if (entity.hp <= 0) {
      el.classList.add('defeated');
    } else {
      el.classList.remove('defeated');
    }

    if (entity.frozen) {
      el.classList.add('frozen');
    } else {
      el.classList.remove('frozen');
    }

    if (entity.variant) {
      el.classList.add('variant-' + entity.variant);
    }
  }

  // Handle new entities (coolant spawns, etc.)
  const existingIds = new Set(
    Array.from(arena.querySelectorAll<HTMLElement>('[data-entity-id]'))
      .map(el => el.dataset.entityId)
  );
  const newEntities = msg.entities.filter(e => !existingIds.has(e.id));
  for (const entity of newEntities) {
    arena.appendChild(createEntityElement(entity, type));
  }

  // Remove entities no longer in the list (coolants expired)
  const currentIds = new Set(msg.entities.map(e => e.id));
  arena.querySelectorAll<HTMLElement>('[data-entity-id]').forEach(el => {
    if (!currentIds.has(el.dataset.entityId || '')) {
      el.classList.add('entity-despawn');
      setTimeout(() => el.remove(), 300);
    }
  });

  if (msg.warning) {
    showMiniBossWarning(msg.warning);
  }
}

// ── Tick Updates ──────────────────────────────────────────────────────────────

export function updateMiniBossTick(msg: { timeRemaining: number; entities: MiniBossEntity[]; extra?: Record<string, unknown> }): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const timerText = screen.querySelector<HTMLElement>('.mini-boss-timer-text');
  if (timerText) {
    timerText.textContent = msg.timeRemaining + 's';
    if (msg.timeRemaining <= 5) {
      timerText.classList.add('urgent');
    } else {
      timerText.classList.remove('urgent');
    }
  }

  updateMiniBossEntities({ entities: msg.entities, extra: msg.extra });
}

// ── Result Screen ─────────────────────────────────────────────────────────────

export function resolveMiniBoss(msg: { victory: boolean; hpChange?: number; newHp?: number }): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  if (_sequenceAnimTimer) {
    clearTimeout(_sequenceAnimTimer);
    _sequenceAnimTimer = null;
  }

  const arena = screen.querySelector<HTMLElement>('#mini-boss-arena');

  const result = document.createElement('div');
  result.className = 'mini-boss-result ' + (msg.victory ? 'victory' : 'defeat');

  const icon = msg.victory ? SVG_ICONS.victory : SVG_ICONS.defeat;
  const text = msg.victory ? 'SYSTEM CLEARED' : 'PROCESS KILLED';

  result.innerHTML =
    '<div class="mini-boss-result-icon">' + icon + '</div>' +
    '<div class="mini-boss-result-text">' + text + '</div>' +
    (!msg.victory && msg.hpChange
      ? '<div class="mini-boss-result-hp">' + msg.hpChange + ' HP</div>'
      : '');

  if (arena) {
    arena.appendChild(result);
  } else {
    screen.appendChild(result);
  }
}

// ── Warning Banner ────────────────────────────────────────────────────────────

function showMiniBossWarning(text: string): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const existing = screen.querySelector('.mini-boss-warning');
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.className = 'mini-boss-warning';
  warning.innerHTML =
    '<svg class="warning-icon" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 13H2L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="0.8" fill="currentColor"/></svg>' +
    '<span>' + text + '</span>';
  screen.appendChild(warning);

  setTimeout(() => warning.remove(), 2500);
}
