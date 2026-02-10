import { SQUASH_WORDS } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel } from './coordinates.js';

export function createBugElement(bugId, lx, ly, variant) {
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

  // Variant styling
  if (variant) {
    if (variant.isHeisenbug) {
      el.classList.add('heisenbug');
    }
    if (variant.isFeature) {
      // Delayed checkmark reveal (600ms ambiguity)
      setTimeout(() => {
        if (el.parentNode) el.classList.add('feature-bug');
      }, 600);
    }
    if (variant.mergeConflict) {
      if (variant.mergeSide === 'left') {
        el.classList.add('merge-left');
      } else {
        el.classList.add('merge-right');
      }
    }
  }

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

  // Merge conflict tether line
  if (variant && variant.mergeConflict && variant.mergePartner) {
    const partnerEl = clientState.bugs[variant.mergePartner];
    if (partnerEl) {
      createMergeTether(bugId, variant.mergePartner, variant.mergeConflict);
    }
  }
}

export function createMergeTether(bugId1, bugId2, conflictId) {
  const existing = dom.arena.querySelector('.merge-tether[data-conflict="' + conflictId + '"]');
  if (existing) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('merge-tether');
  svg.setAttribute('data-conflict', conflictId);
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;';
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', '#ffe66d');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-dasharray', '6 4');
  line.setAttribute('opacity', '0.7');
  svg.appendChild(line);
  dom.arena.appendChild(svg);
  clientState.mergeTethers = clientState.mergeTethers || {};
  clientState.mergeTethers[conflictId] = { svg, line, bug1: bugId1, bug2: bugId2 };
  updateMergeTether(conflictId);
}

export function updateMergeTether(conflictId) {
  if (!clientState.mergeTethers || !clientState.mergeTethers[conflictId]) return;
  const t = clientState.mergeTethers[conflictId];
  const el1 = clientState.bugs[t.bug1];
  const el2 = clientState.bugs[t.bug2];
  if (!el1 || !el2) return;
  const x1 = parseFloat(el1.style.left) + 24;
  const y1 = parseFloat(el1.style.top) + 24;
  const x2 = parseFloat(el2.style.left) + 24;
  const y2 = parseFloat(el2.style.top) + 24;
  t.line.setAttribute('x1', x1);
  t.line.setAttribute('y1', y1);
  t.line.setAttribute('x2', x2);
  t.line.setAttribute('y2', y2);
}

export function removeMergeTether(conflictId) {
  if (!clientState.mergeTethers || !clientState.mergeTethers[conflictId]) return;
  clientState.mergeTethers[conflictId].svg.remove();
  delete clientState.mergeTethers[conflictId];
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
  // Clear merge tethers
  if (clientState.mergeTethers) {
    for (const cid of Object.keys(clientState.mergeTethers)) {
      clientState.mergeTethers[cid].svg.remove();
    }
    clientState.mergeTethers = {};
  }
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
