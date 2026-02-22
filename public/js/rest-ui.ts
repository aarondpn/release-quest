import { dom, clientState } from './state.ts';
import { VOTE_TIMER_MS } from '../../shared/constants.ts';
import type { SendMessageFn, ClientPlayer } from './client-types.ts';
import type { RestStartMsg, RestResolvedMsg } from '../../shared/messages.ts';

let _sendMessage: SendMessageFn | null = null;

export function initRestSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

export function showRestScreen(msg: RestStartMsg): void {
  const screen = dom.restScreen;
  if (!screen) return;

  screen.innerHTML = '';
  screen.classList.remove('hidden');

  const card = document.createElement('div');
  card.className = 'rest-card';

  const hpPreview = Math.min(msg.currentHp + msg.restHpGain, msg.maxHp);
  const actualGain = hpPreview - msg.currentHp;
  const newMultiplier = +(msg.currentScoreMultiplier + msg.trainScoreBonus).toFixed(1);

  card.innerHTML =
    '<div class="rest-icon">\u{1F3D5}\uFE0F</div>' +
    '<div class="rest-title">Rastst\u00E4tte</div>' +
    '<div class="rest-description">Zeit f\u00FCr eine Pause. Was soll das Team tun?</div>' +
    '<div class="rest-options">' +
      '<button class="rest-option-btn" data-option="rest">' +
        '<span class="rest-option-icon">\u{1F49A}</span>' +
        '<div class="rest-option-text">' +
          '<span class="rest-option-label">Rasten</span>' +
          '<span class="rest-option-desc">+' + actualGain + ' HP heilen (' + msg.currentHp + ' \u2192 ' + hpPreview + ')</span>' +
        '</div>' +
        '<div class="rest-option-votes"></div>' +
      '</button>' +
      '<button class="rest-option-btn" data-option="train">' +
        '<span class="rest-option-icon">\u2B50</span>' +
        '<div class="rest-option-text">' +
          '<span class="rest-option-label">Trainieren</span>' +
          '<span class="rest-option-desc">+' + Math.round(msg.trainScoreBonus * 100) + '% Score-Bonus permanent (\u00D7' + newMultiplier + ')</span>' +
        '</div>' +
        '<div class="rest-option-votes"></div>' +
      '</button>' +
    '</div>' +
    (msg.soloMode ? '' : '<div class="rest-timer"><div class="rest-timer-bar"><div class="rest-timer-fill"></div></div><div class="rest-timer-text">15s</div></div>') +
    '<div class="rest-vote-status"></div>';

  screen.appendChild(card);

  // Bind click handlers
  const buttons = card.querySelectorAll<HTMLButtonElement>('.rest-option-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('my-vote')) return;
      card.querySelectorAll('.rest-option-btn').forEach(b => b.classList.remove('my-vote'));
      btn.classList.add('my-vote');
      const option = btn.dataset.option as 'rest' | 'train';
      if (_sendMessage) _sendMessage({ type: 'rest-vote', option });
    });
  });
}

export function updateRestVotes(votes: Record<string, string>, players: Record<string, ClientPlayer>): void {
  const screen = dom.restScreen;
  if (!screen) return;

  // Clear existing vote dots
  screen.querySelectorAll<HTMLElement>('.rest-option-votes').forEach(el => { el.innerHTML = ''; });

  // Group votes by option
  const votesByOption: Record<string, string[]> = {};
  for (const [pid, opt] of Object.entries(votes)) {
    if (!votesByOption[opt]) votesByOption[opt] = [];
    votesByOption[opt].push(pid);
  }

  for (const [opt, pids] of Object.entries(votesByOption)) {
    const btn = screen.querySelector<HTMLElement>(`[data-option="${opt}"]`);
    if (!btn) continue;
    const container = btn.querySelector('.rest-option-votes');
    if (!container) continue;

    for (const pid of pids) {
      const dot = document.createElement('span');
      dot.className = 'rest-vote-dot';
      const player = players[pid];
      if (player) {
        dot.style.background = player.color;
        dot.title = player.name;
      }
      container.appendChild(dot);
    }
  }
}

export function updateRestTimer(timeRemaining: number): void {
  const screen = dom.restScreen;
  if (!screen) return;

  const fill = screen.querySelector<HTMLElement>('.rest-timer-fill');
  const text = screen.querySelector<HTMLElement>('.rest-timer-text');
  if (!fill || !text) return;

  const secs = Math.ceil(timeRemaining / 1000);
  text.textContent = secs + 's';
  fill.style.width = Math.max(0, (timeRemaining / VOTE_TIMER_MS) * 100) + '%';
}

export function resolveRest(msg: RestResolvedMsg): void {
  const screen = dom.restScreen;
  if (!screen) return;

  const buttons = screen.querySelectorAll<HTMLElement>('.rest-option-btn');
  buttons.forEach(btn => {
    if (btn.dataset.option === msg.chosenOption) {
      btn.classList.add('chosen');
    } else {
      btn.classList.add('dimmed');
    }
    btn.style.pointerEvents = 'none';
  });

  const card = screen.querySelector('.rest-card');
  if (!card) return;

  const banner = document.createElement('div');
  banner.className = 'rest-result-banner';

  if (msg.chosenOption === 'rest') {
    banner.textContent = 'HP auf ' + msg.hpAfter + ' geheilt!';
  } else {
    banner.textContent = 'Score-Bonus jetzt \u00D7' + msg.newScoreMultiplier.toFixed(1) + '!';
  }

  card.appendChild(banner);
}
