import { dom } from './state.ts';
import type { SendMessageFn } from './client-types.ts';
import type { MiniBossEntity } from '../../shared/types.ts';

let _sendMessage: SendMessageFn | null = null;

export function initMiniBossSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

export function showMiniBossScreen(msg: {
  miniBossType: string;
  title: string;
  icon: string;
  description: string;
  timeLimit: number;
  entities: MiniBossEntity[];
}): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  screen.innerHTML = '';
  screen.classList.remove('hidden');

  const header = document.createElement('div');
  header.className = 'mini-boss-header';
  header.innerHTML =
    '<div class="mini-boss-icon">' + msg.icon + '</div>' +
    '<div class="mini-boss-title">' + msg.title + '</div>' +
    '<div class="mini-boss-desc">' + msg.description + '</div>' +
    '<div class="mini-boss-timer">' +
      '<span class="mini-boss-timer-text">' + msg.timeLimit + 's</span>' +
    '</div>';
  screen.appendChild(header);

  const arena = document.createElement('div');
  arena.className = 'mini-boss-arena';
  arena.id = 'mini-boss-arena';
  screen.appendChild(arena);

  renderEntities(arena, msg.entities, msg.miniBossType);
}

function renderEntities(arena: HTMLElement, entities: MiniBossEntity[], miniBossType: string): void {
  arena.innerHTML = '';

  for (const entity of entities) {
    const el = document.createElement('div');
    el.className = 'mini-boss-entity';
    el.dataset.entityId = entity.id;

    if (entity.hp <= 0) {
      el.classList.add('defeated');
    }

    if (entity.isOriginal) {
      el.classList.add('original');
    }

    if (entity.frozen) {
      el.classList.add('frozen');
    }

    // Position within the arena (entities use logical 800x500)
    const xPct = (entity.x / 800) * 100;
    const yPct = (entity.y / 500) * 100;
    el.style.left = xPct + '%';
    el.style.top = yPct + '%';

    // HP bar
    const hpPct = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp * 100) : 0;
    const entityIcon = getEntityIcon(miniBossType, entity);

    el.innerHTML =
      '<div class="mini-boss-entity-icon">' + entityIcon + '</div>' +
      '<div class="mini-boss-entity-hp">' +
        '<div class="mini-boss-entity-hp-fill" style="width:' + hpPct + '%"></div>' +
      '</div>';

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_sendMessage && entity.hp > 0) {
        _sendMessage({ type: 'mini-boss-click', entityId: entity.id });
      }
    });

    arena.appendChild(el);
  }
}

function getEntityIcon(miniBossType: string, entity: MiniBossEntity): string {
  switch (miniBossType) {
    case 'stack-overflow':
      return entity.isOriginal ? '\u{1F4DA}' : '\u{1F4C4}';
    case 'race-condition':
      return '\u{1F9F5}';
    case 'deadlock':
      return entity.hp > 0 ? '\u{1F512}' : '\u{1F513}';
    default:
      return '\u{1F47E}';
  }
}

export function updateMiniBossEntities(msg: {
  entities: MiniBossEntity[];
  warning?: string;
}): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const arena = screen.querySelector<HTMLElement>('#mini-boss-arena');
  if (!arena) return;

  for (const entity of msg.entities) {
    const el = arena.querySelector<HTMLElement>(`[data-entity-id="${entity.id}"]`);
    if (!el) continue;

    // Update position
    const xPct = (entity.x / 800) * 100;
    const yPct = (entity.y / 500) * 100;
    el.style.left = xPct + '%';
    el.style.top = yPct + '%';

    // Update HP
    const hpFill = el.querySelector<HTMLElement>('.mini-boss-entity-hp-fill');
    if (hpFill) {
      const hpPct = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp * 100) : 0;
      hpFill.style.width = hpPct + '%';
    }

    // Update defeated state
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
  }

  // If new entities were added (stack-overflow clones), re-render
  const existingIds = new Set(
    Array.from(arena.querySelectorAll<HTMLElement>('[data-entity-id]'))
      .map(el => el.dataset.entityId)
  );
  const newEntities = msg.entities.filter(e => !existingIds.has(e.id));
  if (newEntities.length > 0) {
    // Determine type from first entity for icon
    const firstExisting = arena.querySelector<HTMLElement>('[data-entity-id]');
    const type = firstExisting?.classList.contains('original') ? 'stack-overflow' : 'stack-overflow';
    for (const entity of newEntities) {
      const el = document.createElement('div');
      el.className = 'mini-boss-entity';
      el.dataset.entityId = entity.id;
      if (entity.hp <= 0) el.classList.add('defeated');
      if (entity.isOriginal) el.classList.add('original');
      const xPct = (entity.x / 800) * 100;
      const yPct = (entity.y / 500) * 100;
      el.style.left = xPct + '%';
      el.style.top = yPct + '%';
      const hpPct = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp * 100) : 0;
      el.innerHTML =
        '<div class="mini-boss-entity-icon">' + getEntityIcon(type, entity) + '</div>' +
        '<div class="mini-boss-entity-hp">' +
          '<div class="mini-boss-entity-hp-fill" style="width:' + hpPct + '%"></div>' +
        '</div>';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_sendMessage && entity.hp > 0) {
          _sendMessage({ type: 'mini-boss-click', entityId: entity.id });
        }
      });
      arena.appendChild(el);
    }
  }

  // Show warning if present
  if (msg.warning) {
    showMiniBossWarning(msg.warning);
  }
}

export function updateMiniBossTick(msg: { timeRemaining: number; entities: MiniBossEntity[] }): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const timerText = screen.querySelector<HTMLElement>('.mini-boss-timer-text');
  if (timerText) {
    timerText.textContent = msg.timeRemaining + 's';
    if (msg.timeRemaining <= 5) timerText.classList.add('urgent');
  }

  // Also update entities from tick
  updateMiniBossEntities({ entities: msg.entities });
}

export function resolveMiniBoss(msg: { victory: boolean; hpChange?: number; newHp?: number }): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  const arena = screen.querySelector<HTMLElement>('#mini-boss-arena');

  const result = document.createElement('div');
  result.className = 'mini-boss-result ' + (msg.victory ? 'victory' : 'defeat');
  result.innerHTML = msg.victory
    ? '<div class="mini-boss-result-icon">\u2705</div><div class="mini-boss-result-text">Victory!</div>'
    : '<div class="mini-boss-result-icon">\u274C</div><div class="mini-boss-result-text">Defeated!</div>' +
      (msg.hpChange ? '<div class="mini-boss-result-hp">' + msg.hpChange + ' HP</div>' : '');

  if (arena) {
    arena.appendChild(result);
  } else {
    screen.appendChild(result);
  }
}

function showMiniBossWarning(text: string): void {
  const screen = dom.miniBossScreen;
  if (!screen) return;

  // Remove existing warning
  const existing = screen.querySelector('.mini-boss-warning');
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.className = 'mini-boss-warning';
  warning.textContent = text;
  screen.appendChild(warning);

  setTimeout(() => warning.remove(), 2000);
}
