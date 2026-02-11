import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function addRemoteCursor(playerId, name, color, icon) {
  if (playerId === clientState.myId) return;
  if (clientState.remoteCursors[playerId]) {
    const el = clientState.remoteCursors[playerId];
    el.querySelector('.remote-cursor-icon').textContent = icon || '\u{1F431}';
    el.querySelector('.remote-cursor-name').textContent = name;
    el.style.color = color;
    return;
  }

  const el = document.createElement('div');
  el.className = 'remote-cursor';
  el.style.color = color;
  el.innerHTML =
    '<span class="remote-cursor-icon">' + (icon || '\u{1F431}') + '</span>' +
    '<span class="remote-cursor-name">' + escapeHtml(name) + '</span>';
  dom.arena.appendChild(el);
  clientState.remoteCursors[playerId] = el;
}

export function removeRemoteCursor(playerId) {
  const el = clientState.remoteCursors[playerId];
  if (el) {
    el.remove();
    delete clientState.remoteCursors[playerId];
  }
}

export function updateRemoteCursor(playerId, lx, ly) {
  const el = clientState.remoteCursors[playerId];
  if (!el) return;
  const pos = logicalToPixel(lx, ly);
  el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
}

export function clearRemoteCursors() {
  for (const id of Object.keys(clientState.remoteCursors)) {
    clientState.remoteCursors[id].remove();
  }
  clientState.remoteCursors = {};
}
