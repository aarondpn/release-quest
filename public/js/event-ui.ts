import { dom, clientState } from './state.ts';
import { escapeHtml } from './utils.ts';
import type { SendMessageFn, ClientPlayer, EventDefinition } from './client-types.ts';
import type { EventResolvedMsg } from '../../shared/messages.ts';

let _sendMessage: SendMessageFn | null = null;

export function initEventSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

export function showEventScreen(event: EventDefinition, soloMode: boolean): void {
  const screen = dom.eventScreen;
  if (!screen) return;

  screen.innerHTML = '';
  screen.classList.remove('hidden');

  const card = document.createElement('div');
  card.className = 'event-card';

  card.innerHTML =
    '<div class="event-icon">' + event.icon + '</div>' +
    '<div class="event-title">' + escapeHtml(event.title) + '</div>' +
    '<div class="event-description">' + escapeHtml(event.description) + '</div>' +
    '<div class="event-options"></div>' +
    (soloMode ? '' : '<div class="event-timer"><div class="event-timer-bar"><div class="event-timer-fill"></div></div><div class="event-timer-text">15s</div></div>') +
    '<div class="event-vote-status"></div>';

  const optionsContainer = card.querySelector('.event-options')!;

  for (const opt of event.options) {
    const btn = document.createElement('button');
    btn.className = 'event-option-btn';
    btn.dataset.optionId = opt.id;
    btn.innerHTML =
      '<span class="event-option-icon">' + opt.icon + '</span>' +
      '<div class="event-option-text">' +
        '<span class="event-option-label">' + escapeHtml(opt.label) + '</span>' +
        '<span class="event-option-desc">' + escapeHtml(opt.description) + '</span>' +
      '</div>' +
      '<div class="event-option-votes"></div>';

    btn.addEventListener('click', () => {
      if (btn.classList.contains('my-vote')) return;
      // Remove previous vote styling
      optionsContainer.querySelectorAll('.event-option-btn').forEach(b => b.classList.remove('my-vote'));
      btn.classList.add('my-vote');
      if (_sendMessage) _sendMessage({ type: 'event-vote', optionId: opt.id });
    });

    optionsContainer.appendChild(btn);
  }

  screen.appendChild(card);
}

export function updateEventVotes(votes: Record<string, string>, players: Record<string, ClientPlayer>): void {
  const screen = dom.eventScreen;
  if (!screen) return;

  // Clear existing vote dots
  screen.querySelectorAll('.event-option-votes').forEach(el => { el.innerHTML = ''; });

  // Group votes by option
  const votesByOption: Record<string, string[]> = {};
  for (const [pid, optId] of Object.entries(votes)) {
    if (!votesByOption[optId]) votesByOption[optId] = [];
    votesByOption[optId].push(pid);
  }

  for (const [optId, pids] of Object.entries(votesByOption)) {
    const btn = screen.querySelector<HTMLElement>(`[data-option-id="${optId}"]`);
    if (!btn) continue;
    const container = btn.querySelector('.event-option-votes');
    if (!container) continue;

    for (const pid of pids) {
      const dot = document.createElement('span');
      dot.className = 'event-vote-dot';
      const player = players[pid];
      if (player) {
        dot.style.background = player.color;
        dot.title = player.name;
      }
      container.appendChild(dot);
    }
  }
}

export function updateEventTimer(timeRemaining: number): void {
  const screen = dom.eventScreen;
  if (!screen) return;

  const fill = screen.querySelector<HTMLElement>('.event-timer-fill');
  const text = screen.querySelector<HTMLElement>('.event-timer-text');
  if (!fill || !text) return;

  const secs = Math.ceil(timeRemaining / 1000);
  text.textContent = secs + 's';
  fill.style.width = Math.max(0, (timeRemaining / 15000) * 100) + '%';
}

export function resolveEvent(msg: EventResolvedMsg): void {
  const screen = dom.eventScreen;
  if (!screen) return;

  // Highlight chosen option, dim others
  const buttons = screen.querySelectorAll<HTMLElement>('.event-option-btn');
  buttons.forEach(btn => {
    if (btn.dataset.optionId === msg.chosenOptionId) {
      btn.classList.add('chosen');
    } else {
      btn.classList.add('dimmed');
    }
    // Disable further clicks
    btn.style.pointerEvents = 'none';
  });

  // Show result banner
  const card = screen.querySelector('.event-card');
  if (!card) return;

  const banner = document.createElement('div');
  banner.className = 'event-result-banner';

  let resultText = '';
  if (msg.hpChange) {
    resultText += (msg.hpChange > 0 ? '+' : '') + msg.hpChange + ' HP  ';
  }
  if (msg.scoreChange) {
    resultText += (msg.scoreChange > 0 ? '+' : '') + msg.scoreChange + ' Score  ';
  }
  if (msg.modifierSummary) {
    if (resultText) resultText += '\n';
    resultText += msg.modifierSummary;
  }

  banner.textContent = resultText || 'Resolved!';
  card.appendChild(banner);
}
