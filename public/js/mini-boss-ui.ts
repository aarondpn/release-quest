import { dom } from './state.ts';
import type { SendMessageFn } from './client-types.ts';
import type { MiniBossEntity } from '../../shared/types.ts';

let _sendMessage: SendMessageFn | null = null;

export function initMiniBossSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

// ── SVG Icon Library ──────────────────────────────────────────────────────────
// Inline SVGs replace all emoji icons for a sharp, dangerous, vector-art look.

const SVG_ICONS = {
  // Stack Overflow boss: a menacing overheating CPU/processor (decorative center piece)
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

  // Stack frame entity: code bracket/document icon
  frame: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="24" height="28" rx="2" fill="#1a1a2e" stroke="#a855f7" stroke-width="1.5"/>
    <path d="M11 12L8 15L11 18" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M25 12L28 15L25 18" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="14" y1="15" x2="22" y2="15" stroke="#a855f7" stroke-width="1" stroke-linecap="round"/>
    <line x1="10" y1="22" x2="26" y2="22" stroke="rgba(168,85,247,0.4)" stroke-width="1" stroke-linecap="round"/>
    <line x1="10" y1="26" x2="22" y2="26" stroke="rgba(168,85,247,0.3)" stroke-width="1" stroke-linecap="round"/>
  </svg>`,

  // Recursive stack frame: red-glowing, dangerous variant
  recursiveFrame: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="24" height="28" rx="2" fill="#1a1a2e" stroke="#ff6b6b" stroke-width="2"/>
    <path d="M11 12L8 15L11 18" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M25 12L28 15L25 18" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="14" y1="15" x2="22" y2="15" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="10" y1="22" x2="26" y2="22" stroke="rgba(255,107,107,0.6)" stroke-width="1" stroke-linecap="round"/>
    <line x1="10" y1="26" x2="22" y2="26" stroke="rgba(255,107,107,0.4)" stroke-width="1" stroke-linecap="round"/>
    <path d="M14 9L18 6L22 9" stroke="#ff6b6b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
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

  // Sync zone: pulsing circular target with crosshair
  syncZone: `<svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="35" cy="35" r="30" stroke="rgba(78,205,196,0.3)" stroke-width="1.5" stroke-dasharray="5 3"/>
    <circle cx="35" cy="35" r="20" stroke="rgba(78,205,196,0.5)" stroke-width="1.5"/>
    <circle cx="35" cy="35" r="8" stroke="#4ecdc4" stroke-width="1.5" fill="rgba(78,205,196,0.08)"/>
    <line x1="35" y1="5" x2="35" y2="26" stroke="#4ecdc4" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="35" y1="44" x2="35" y2="65" stroke="#4ecdc4" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="5" y1="35" x2="26" y2="35" stroke="#4ecdc4" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="44" y1="35" x2="65" y2="35" stroke="#4ecdc4" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
  </svg>`,

  // Lock: hexagonal lock node for deadlock
  lock: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 4L38 13V31L22 40L6 31V13Z" fill="#1a1a2e" stroke="#a855f7" stroke-width="1.5"/>
    <rect x="16" y="19" width="12" height="10" rx="2" fill="#0f0e17" stroke="#a855f7" stroke-width="1.5"/>
    <path d="M18 19V16C18 13.8 19.8 12 22 12C24.2 12 26 13.8 26 16V19" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="22" cy="25" r="1.5" fill="#a855f7"/>
  </svg>`,

  // Lock illuminated (lit state in Lock Cascade)
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

  screen.innerHTML = '';
  screen.classList.remove('hidden');

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

  // Boss HP bar for stack-overflow and deadlock
  if (msg.miniBossType === 'stack-overflow') {
    screen.appendChild(buildBossHpBar(msg.extra || {}, false));
  }
  if (msg.miniBossType === 'deadlock') {
    screen.appendChild(buildBossHpBar(msg.extra || {}, true));
  }

  const arena = document.createElement('div');
  arena.className = 'mini-boss-arena';
  arena.id = 'mini-boss-arena';
  arena.dataset.miniBossType = msg.miniBossType;
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

  // Apply initial lock lit state for deadlock
  if (msg.miniBossType === 'deadlock' && msg.extra?.litLockIds) {
    applyLitLocks(arena, msg.extra.litLockIds as string[]);
  }
}

// ── Boss HP Bar (Stack Overflow + Deadlock) ───────────────────────────────────

function buildBossHpBar(extra: Record<string, unknown>, showStreak: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mini-boss-boss-hp';
  container.id = 'mini-boss-boss-hp';

  const hp = (extra.bossHp as number) ?? 0;
  const maxHp = (extra.bossMaxHp as number) ?? 15;
  const pct = Math.max(0, (hp / maxHp) * 100);
  const streak = (extra.streak as number) ?? 0;

  container.innerHTML =
    '<div class="mb-hp-header">' +
      '<span class="mb-hp-label">INTEGRITY</span>' +
      (showStreak
        ? '<span class="mb-hp-streak" id="mb-hp-streak">STREAK: ' + streak + '</span>'
        : '') +
    '</div>' +
    '<div class="mb-hp-track">' +
      '<div class="mb-hp-fill" style="width:' + pct + '%"></div>' +
      '<div class="mb-hp-stripe"></div>' +
    '</div>';

  return container;
}

function updateBossHpBar(extra: Record<string, unknown>): void {
  const container = document.getElementById('mini-boss-boss-hp');
  if (!container) return;

  const hp = (extra.bossHp as number) ?? 0;
  const maxHp = (extra.bossMaxHp as number) ?? 15;
  const pct = Math.max(0, (hp / maxHp) * 100);

  const fill = container.querySelector<HTMLElement>('.mb-hp-fill');
  if (fill) fill.style.width = pct + '%';

  const streakEl = document.getElementById('mb-hp-streak');
  if (streakEl && extra.streak !== undefined) {
    streakEl.textContent = 'STREAK: ' + (extra.streak as number);
  }
}

// ── Lock Lit State (Deadlock) ─────────────────────────────────────────────────

function applyLitLocks(arena: HTMLElement, litLockIds: string[]): void {
  const litSet = new Set(litLockIds);
  arena.querySelectorAll<HTMLElement>('[data-entity-id]').forEach(el => {
    const entityId = el.dataset.entityId || '';
    if (!entityId.startsWith('mb_lock_')) return;
    const isLit = litSet.has(entityId);
    const iconEl = el.querySelector('.mini-boss-entity-icon');
    if (iconEl) iconEl.innerHTML = isLit ? SVG_ICONS.lockHighlight : SVG_ICONS.lock;
    el.classList.toggle('lock-lit', isLit);
  });
}

// ── Entity Rendering ──────────────────────────────────────────────────────────

function renderEntities(arena: HTMLElement, entities: MiniBossEntity[], miniBossType: string): void {
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

  // HP bar only shown for race-condition threads (not boss, frames, locks, or sync-zone)
  const showHp = miniBossType === 'race-condition' && entity.variant !== 'sync-zone';
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

  // Click handler — not for race-condition (arena-level), and not for decorative entities
  const isDecorative = entity.variant === 'boss' || entity.variant === 'sync-zone';
  if (miniBossType !== 'race-condition' && !isDecorative) {
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
      if (entity.variant === 'recursive-frame') return SVG_ICONS.recursiveFrame;
      if (entity.variant === 'frame') return SVG_ICONS.frame;
      return SVG_ICONS.overheatBoss; // boss entity at center
    case 'race-condition':
      if (entity.variant === 'sync-zone') return SVG_ICONS.syncZone;
      return entity.variant === 'thread-b' ? SVG_ICONS.threadB : SVG_ICONS.threadA;
    case 'deadlock':
      return SVG_ICONS.lock; // lit state applied dynamically via applyLitLocks
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
    if (type === 'stack-overflow' || type === 'deadlock') {
      updateBossHpBar(msg.extra);
    }

    // Overflow flash for stack-overflow
    if (type === 'stack-overflow' && msg.extra.overflow) {
      arena.classList.add('overflow-flash');
      setTimeout(() => arena.classList.remove('overflow-flash'), 500);
    }

    // Lock lit state update for deadlock
    if (type === 'deadlock' && msg.extra.litLockIds) {
      applyLitLocks(arena, msg.extra.litLockIds as string[]);
    }

    // Wrong click shake for deadlock
    if (type === 'deadlock' && msg.extra.wrongClickLockId) {
      const lockId = msg.extra.wrongClickLockId as string;
      const lockEl = arena.querySelector<HTMLElement>(`[data-entity-id="${lockId}"]`);
      if (lockEl) {
        lockEl.classList.add('shake-error');
        setTimeout(() => lockEl.classList.remove('shake-error'), 500);
      }
    }

    // Capture flash for race-condition (replaces collision flash)
    if (type === 'race-condition' && msg.extra.captureFlash) {
      arena.classList.add('capture-flash');
      setTimeout(() => arena.classList.remove('capture-flash'), 400);
    }
  }

  // Update existing entity positions and state
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

  // Add new entities (frame spawns, sync zone repositions, etc.)
  const existingIds = new Set(
    Array.from(arena.querySelectorAll<HTMLElement>('[data-entity-id]'))
      .map(el => el.dataset.entityId)
  );
  const newEntities = msg.entities.filter(e => !existingIds.has(e.id));
  for (const entity of newEntities) {
    arena.appendChild(createEntityElement(entity, type));
  }

  // Remove entities no longer in the list (frames expired/clicked, etc.)
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
