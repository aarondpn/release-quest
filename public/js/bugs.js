import { SQUASH_WORDS } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';

export function createBugElement(bugId, lx, ly) {
  const el = document.createElement('div');
  el.className = 'bug walking';
  el.dataset.bugId = bugId;
  el.innerHTML = `
    <div class="bug-body">
      <div class="bug-eyes">&middot;&middot;</div>
      <div class="bug-legs">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </div>
    </div>`;

  const pos = logicalToPixel(lx, ly);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (clientState.ws && clientState.ws.readyState === 1) {
      clientState.ws.send(JSON.stringify({ type: 'click-bug', bugId }));
    }
  });

  dom.arena.appendChild(el);
  clientState.bugs[bugId] = el;
}

export function removeBugElement(bugId, animate) {
  const el = clientState.bugs[bugId];
  if (!el) return;
  delete clientState.bugs[bugId];
  if (animate) {
    el.classList.add('popping');
    setTimeout(() => el.remove(), 200);
  } else {
    el.remove();
  }
}

export function clearAllBugs() {
  for (const id of Object.keys(clientState.bugs)) {
    clientState.bugs[id].remove();
  }
  clientState.bugs = {};
}

export function showSquashEffect(lx, ly, color) {
  const pos = logicalToPixel(lx, ly);
  const fx = document.createElement('div');
  fx.className = 'squash';
  fx.style.left = pos.x + 'px';
  fx.style.top = pos.y + 'px';
  const word = SQUASH_WORDS[Math.floor(Math.random() * SQUASH_WORDS.length)];
  fx.innerHTML = '<span class="squash-text" style="color:' + (color || 'var(--yellow)') + '">' + word + '</span>';
  dom.arena.appendChild(fx);
  setTimeout(() => fx.remove(), 600);
}
