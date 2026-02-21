import { dom, clientState } from './state.ts';
import { logicalToPixel } from './coordinates.ts';
import { renderIcon } from './avatars.ts';
import { escapeHtml } from './utils.ts';

export function addRemoteCursor(playerId: string, name: string, color: string, icon: string): void {
  if (playerId === clientState.myId) return;
  if (clientState.remoteCursors[playerId]) {
    const el = clientState.remoteCursors[playerId];
    (el.querySelector('.remote-cursor-icon') as HTMLElement).innerHTML = renderIcon(icon || '\u{1F431}', 22);
    (el.querySelector('.remote-cursor-name') as HTMLElement).textContent = name;
    el.style.color = color;
    return;
  }

  const el = document.createElement('div');
  el.className = 'remote-cursor';
  el.style.color = color;
  el.innerHTML =
    '<span class="remote-cursor-icon">' + renderIcon(icon || '\u{1F431}', 22) + '</span>' +
    '<span class="remote-cursor-name">' + escapeHtml(name) + '</span>';
  dom.arena!.appendChild(el);
  clientState.remoteCursors[playerId] = el;
}

export function removeRemoteCursor(playerId: string): void {
  const el = clientState.remoteCursors[playerId];
  if (el) {
    el.remove();
    delete clientState.remoteCursors[playerId];
  }
}

export function updateRemoteCursor(playerId: string, lx: number, ly: number): void {
  const el = clientState.remoteCursors[playerId];
  if (!el) return;
  const pos = logicalToPixel(lx, ly);
  el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
}

export function clearRemoteCursors(): void {
  for (const id of Object.keys(clientState.remoteCursors)) {
    clientState.remoteCursors[id].remove();
  }
  clientState.remoteCursors = {};
}

// ── Cursor trail dots for replay playback ──

export function addCursorTrailDot(playerId: string, lx: number, ly: number, color: string): void {
  const pos = logicalToPixel(lx, ly);
  const dot = document.createElement('div');
  dot.className = 'replay-cursor-trail-dot';
  dot.style.left = pos.x + 'px';
  dot.style.top = pos.y + 'px';
  // Use the player's avatar icon
  const player = clientState.players[playerId];
  dot.innerHTML = renderIcon((player && player.icon) || '\u{1F431}', 22);
  dom.arena!.appendChild(dot);
  // Remove after a short delay
  setTimeout(() => dot.remove(), 100);
}

export function clearCursorTrails(): void {
  const dots = dom.arena!.querySelectorAll('.replay-cursor-trail-dot');
  dots.forEach(d => d.remove());
}
