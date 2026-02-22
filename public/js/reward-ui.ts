import { dom } from './state.ts';
import type { SendMessageFn } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;

export function initRewardSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

export function showRewardScreen(msg: {
  encounterType: 'elite' | 'mini_boss';
  title: string;
  scoreGained: number;
  freeItem?: { id: string; name: string; icon: string; description: string } | null;
  totalScore: number;
  soloMode: boolean;
}): void {
  const screen = dom.rewardScreen;
  if (!screen) return;

  screen.innerHTML = '';
  screen.classList.remove('hidden');

  const card = document.createElement('div');
  card.className = 'reward-card';

  const typeLabel = msg.encounterType === 'elite' ? 'Elite' : 'Mini-Boss';
  const typeIcon = msg.encounterType === 'elite' ? '\u2694\uFE0F' : '\u{1F608}';

  let content =
    '<div class="reward-icon">' + typeIcon + '</div>' +
    '<div class="reward-title">' + typeLabel + ' Cleared!</div>' +
    '<div class="reward-subtitle">' + msg.title + '</div>' +
    '<div class="reward-score">Score: ' + msg.totalScore + '</div>';

  if (msg.freeItem) {
    content += '<div class="reward-item">' + msg.freeItem.icon + ' ' + msg.freeItem.name + '</div>';
  }

  if (msg.soloMode) {
    content += '<button class="reward-continue-btn">Continue</button>';
  } else {
    content += '<div class="reward-auto">Continuing in 5s...</div>';
  }

  card.innerHTML = content;
  screen.appendChild(card);

  if (msg.soloMode) {
    const btn = card.querySelector<HTMLButtonElement>('.reward-continue-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        screen.classList.add('hidden');
        if (_sendMessage) _sendMessage({ type: 'encounter-reward-continue' });
      });
    }
  }
}

export function hideRewardScreen(): void {
  const screen = dom.rewardScreen;
  if (screen) screen.classList.add('hidden');
}
