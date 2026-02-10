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
    if (variant.isMemoryLeak) {
      el.classList.add('memory-leak');
      el.dataset.growthStage = variant.growthStage || 0;
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
    if (variant.isPipeline) {
      el.classList.add('pipeline-bug');
      el.dataset.chainId = variant.chainId;
      el.dataset.chainIndex = variant.chainIndex;
      el.dataset.chainLength = variant.chainLength;
    }
  }

  const pos = logicalToPixel(lx, ly);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  // Memory leak requires hold mechanic
  if (variant && variant.isMemoryLeak) {
    let holdTimer = null;
    let holdStartTime = null;

    const startHold = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (clientState.ws && clientState.ws.readyState === 1) {
        holdStartTime = Date.now();
        clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-start', bugId }));
      }
    };

    const endHold = (e) => {
      e.stopPropagation();
      if (clientState.ws && clientState.ws.readyState === 1 && holdStartTime) {
        clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-complete', bugId }));
        holdStartTime = null;
      }
    };

    const cancelHold = () => {
      if (holdStartTime) {
        if (clientState.ws && clientState.ws.readyState === 1) {
          clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-complete', bugId }));
        }
        holdStartTime = null;
      }
    };

    el.addEventListener('mousedown', startHold);
    el.addEventListener('mouseup', endHold);
    el.addEventListener('mouseleave', cancelHold);

    el.addEventListener('touchstart', startHold, { passive: false });
    el.addEventListener('touchend', endHold);
    el.addEventListener('touchcancel', cancelHold);
  } else {
    // Normal click for other bugs
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (clientState.ws && clientState.ws.readyState === 1) {
        clientState.ws.send(JSON.stringify({ type: 'click-bug', bugId }));
      }
    });
  }

  dom.arena.appendChild(el);
  clientState.bugs[bugId] = el;

  // Merge conflict tether line
  if (variant && variant.mergeConflict && variant.mergePartner) {
    const partnerEl = clientState.bugs[variant.mergePartner];
    if (partnerEl) {
      createMergeTether(bugId, variant.mergePartner, variant.mergeConflict);
    }
  }

  // Pipeline chain tether lines
  if (variant && variant.isPipeline) {
    tryCreatePipelineTether(variant.chainId);
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
  startTetherTracking();
}

export function updateMergeTether(conflictId) {
  if (!clientState.mergeTethers || !clientState.mergeTethers[conflictId]) return;
  const t = clientState.mergeTethers[conflictId];
  const el1 = clientState.bugs[t.bug1];
  const el2 = clientState.bugs[t.bug2];
  if (!el1 || !el2) return;
  const arenaRect = dom.arena.getBoundingClientRect();
  const r1 = el1.getBoundingClientRect();
  const r2 = el2.getBoundingClientRect();
  const x1 = r1.left - arenaRect.left + r1.width / 2;
  const y1 = r1.top - arenaRect.top + r1.height / 2;
  const x2 = r2.left - arenaRect.left + r2.width / 2;
  const y2 = r2.top - arenaRect.top + r2.height / 2;
  t.line.setAttribute('x1', x1);
  t.line.setAttribute('y1', y1);
  t.line.setAttribute('x2', x2);
  t.line.setAttribute('y2', y2);
}

let tetherRafId = null;

function tickTethers() {
  const hasMerge = clientState.mergeTethers && Object.keys(clientState.mergeTethers).length > 0;
  const hasDep = clientState.pipelineTethers && Object.keys(clientState.pipelineTethers).length > 0;
  if (!hasMerge && !hasDep) {
    tetherRafId = null;
    return;
  }
  if (hasMerge) {
    for (const cid of Object.keys(clientState.mergeTethers)) {
      updateMergeTether(cid);
    }
  }
  if (hasDep) {
    for (const cid of Object.keys(clientState.pipelineTethers)) {
      updatePipelineTether(cid);
    }
  }
  tetherRafId = requestAnimationFrame(tickTethers);
}

export function startTetherTracking() {
  if (!tetherRafId) tetherRafId = requestAnimationFrame(tickTethers);
}

export function stopTetherTracking() {
  if (tetherRafId) { cancelAnimationFrame(tetherRafId); tetherRafId = null; }
}

export function removeMergeTether(conflictId) {
  if (!clientState.mergeTethers || !clientState.mergeTethers[conflictId]) return;
  clientState.mergeTethers[conflictId].svg.remove();
  delete clientState.mergeTethers[conflictId];
  if (Object.keys(clientState.mergeTethers).length === 0 &&
      (!clientState.pipelineTethers || Object.keys(clientState.pipelineTethers).length === 0)) {
    stopTetherTracking();
  }
}

// ── Pipeline chain tethers ──

function tryCreatePipelineTether(chainId) {
  // Collect all bugs belonging to this chain
  const chainBugs = [];
  for (const [bid, el] of Object.entries(clientState.bugs)) {
    if (el.dataset.chainId === chainId) {
      chainBugs.push({ id: bid, index: parseInt(el.dataset.chainIndex, 10) });
    }
  }
  if (chainBugs.length < 2) return;

  // Sort by chain index
  chainBugs.sort((a, b) => a.index - b.index);

  // Remove old tether if exists
  removePipelineTether(chainId);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('pipeline-tether');
  svg.setAttribute('data-chain', chainId);
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;';

  const lines = [];
  for (let i = 0; i < chainBugs.length - 1; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#a855f7');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4 6');
    line.setAttribute('opacity', '0.6');
    svg.appendChild(line);
    lines.push({ line, from: chainBugs[i].id, to: chainBugs[i + 1].id });
  }

  dom.arena.appendChild(svg);
  clientState.pipelineTethers = clientState.pipelineTethers || {};
  clientState.pipelineTethers[chainId] = { svg, lines, bugIds: chainBugs.map(b => b.id) };
  updatePipelineTether(chainId);
  startTetherTracking();
}

export function updatePipelineTether(chainId) {
  if (!clientState.pipelineTethers || !clientState.pipelineTethers[chainId]) return;
  const t = clientState.pipelineTethers[chainId];
  const arenaRect = dom.arena.getBoundingClientRect();
  for (const seg of t.lines) {
    const el1 = clientState.bugs[seg.from];
    const el2 = clientState.bugs[seg.to];
    if (!el1 || !el2) continue;
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();
    seg.line.setAttribute('x1', r1.left - arenaRect.left + r1.width / 2);
    seg.line.setAttribute('y1', r1.top - arenaRect.top + r1.height / 2);
    seg.line.setAttribute('x2', r2.left - arenaRect.left + r2.width / 2);
    seg.line.setAttribute('y2', r2.top - arenaRect.top + r2.height / 2);
  }
}

export function removePipelineTether(chainId) {
  if (!clientState.pipelineTethers || !clientState.pipelineTethers[chainId]) return;
  clientState.pipelineTethers[chainId].svg.remove();
  delete clientState.pipelineTethers[chainId];
  if (Object.keys(clientState.pipelineTethers).length === 0 &&
      (!clientState.mergeTethers || Object.keys(clientState.mergeTethers).length === 0)) {
    stopTetherTracking();
  }
}

export function rebuildPipelineTether(chainId) {
  removePipelineTether(chainId);
  tryCreatePipelineTether(chainId);
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
  stopTetherTracking();
  if (clientState.mergeTethers) {
    for (const cid of Object.keys(clientState.mergeTethers)) {
      clientState.mergeTethers[cid].svg.remove();
    }
    clientState.mergeTethers = {};
  }
  // Clear pipeline tethers
  if (clientState.pipelineTethers) {
    for (const cid of Object.keys(clientState.pipelineTethers)) {
      clientState.pipelineTethers[cid].svg.remove();
    }
    clientState.pipelineTethers = {};
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
