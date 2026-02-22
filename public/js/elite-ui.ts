import { dom } from './state.ts';
import { hideAllScreens } from './hud.ts';
import type { SendMessageFn } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;

export function initEliteSend(fn: SendMessageFn): void {
  _sendMessage = fn;
}

export function showEliteBanner(msg: {
  eliteType: string;
  title: string;
  icon: string;
  description: string;
  scoreMultiplier: number;
  waveIndex: number;
  wavesTotal: number;
}): void {
  // Remove any existing banner
  removeEliteBanner();

  const banner = document.createElement('div');
  banner.id = 'elite-banner';
  banner.className = 'elite-banner';

  banner.innerHTML =
    '<div class="elite-banner-icon">' + msg.icon + '</div>' +
    '<div class="elite-banner-title">ELITE: ' + msg.title + '</div>' +
    '<div class="elite-banner-desc">' + msg.description + '</div>' +
    '<div class="elite-banner-mult">' + msg.scoreMultiplier + 'x Score</div>';

  dom.arena!.appendChild(banner);

  // Auto-hide after 2s
  setTimeout(() => {
    if (banner.parentNode) {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 500);
    }
  }, 2000);
}

export function removeEliteBanner(): void {
  const existing = document.getElementById('elite-banner');
  if (existing) existing.remove();
}
