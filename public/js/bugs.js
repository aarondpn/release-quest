import { SQUASH_WORDS } from './config.js';
import { dom, clientState } from './state.js';
import { logicalToPixel, getArenaRect } from './coordinates.js';
import { showError, ERROR_LEVELS } from './error-handler.js';

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
    if (variant.isInfiniteLoop) {
      el.classList.add('infinite-loop');
    }
  }

  const pos = logicalToPixel(lx, ly);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  clientState.bugPositions[bugId] = { x: lx, y: ly };

  // Infinite loop: no click handler on bug, create breakpoint + loop path
  if (variant && variant.isInfiniteLoop) {
    createInfiniteLoopOverlay(bugId, variant);
  }
  // Memory leak requires hold mechanic
  else if (variant && variant.isMemoryLeak) {
    let holdTimer = null;
    let holdStartTime = null;

    const handleMouseDown = (e) => {
      try {
        e.stopPropagation();
        e.preventDefault();
        if (clientState.ws && clientState.ws.readyState === 1) {
          holdStartTime = Date.now();
          clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-start', bugId }));
        }
      } catch (err) {
        console.error('Error handling memory leak mousedown:', err);
        showError('Error interacting with memory leak', ERROR_LEVELS.ERROR);
      }
    };

    const handleMouseUp = (e) => {
      try {
        e.stopPropagation();
        if (clientState.ws && clientState.ws.readyState === 1 && holdStartTime) {
          clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-complete', bugId }));
          holdStartTime = null;
        }
      } catch (err) {
        console.error('Error handling memory leak mouseup:', err);
        showError('Error interacting with memory leak', ERROR_LEVELS.ERROR);
      }
    };

    const handleMouseLeave = (e) => {
      try {
        // Cancel hold if mouse leaves
        if (holdStartTime) {
          if (clientState.ws && clientState.ws.readyState === 1) {
            clientState.ws.send(JSON.stringify({ type: 'click-memory-leak-complete', bugId }));
          }
          holdStartTime = null;
        }
      } catch (err) {
        console.error('Error handling memory leak mouseleave:', err);
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseLeave);
    
    // Store handlers for cleanup
    el._memoryLeakHandlers = {
      mousedown: handleMouseDown,
      mouseup: handleMouseUp,
      mouseleave: handleMouseLeave
    };
  } else {
    // Normal click for other bugs
    const handleClick = (e) => {
      try {
        e.stopPropagation();
        if (clientState.ws && clientState.ws.readyState === 1) {
          clientState.ws.send(JSON.stringify({ type: 'click-bug', bugId }));
        }
      } catch (err) {
        console.error('Error handling bug click:', err);
        showError('Error clicking bug', ERROR_LEVELS.ERROR);
      }
    };
    
    el.addEventListener('click', handleClick);
    el._clickHandler = handleClick;
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
  const arenaRect = getArenaRect();
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
  const arenaRect = getArenaRect();
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

// ── Infinite Loop overlay (breakpoint marker + orbit path) ──

function createInfiniteLoopOverlay(bugId, variant) {
  const { loopCenterX, loopCenterY, loopRadiusX, loopRadiusY, breakpointAngle } = variant;

  // Draw SVG ellipse orbit path
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('infinite-loop-path');
  svg.setAttribute('data-bug-id', bugId);
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:8;';
  const center = logicalToPixel(loopCenterX, loopCenterY);
  const arenaRect = getArenaRect();
  const scaleX = arenaRect.width / 800;
  const scaleY = arenaRect.height / 500;
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', center.x);
  ellipse.setAttribute('cy', center.y);
  ellipse.setAttribute('rx', loopRadiusX * scaleX);
  ellipse.setAttribute('ry', loopRadiusY * scaleY);
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('stroke', '#06b6d4');
  ellipse.setAttribute('stroke-width', '1.5');
  ellipse.setAttribute('stroke-dasharray', '6 4');
  ellipse.setAttribute('opacity', '0.3');
  svg.appendChild(ellipse);
  dom.arena.appendChild(svg);

  // Create breakpoint marker at the breakpoint angle on the ellipse
  const bpX = loopCenterX + Math.cos(breakpointAngle) * loopRadiusX;
  const bpY = loopCenterY + Math.sin(breakpointAngle) * loopRadiusY;
  const bpPos = logicalToPixel(bpX, bpY);
  const bp = document.createElement('div');
  bp.className = 'infinite-loop-breakpoint';
  bp.setAttribute('data-bug-id', bugId);
  bp.style.left = bpPos.x + 'px';
  bp.style.top = bpPos.y + 'px';

  bp.addEventListener('click', (e) => {
    try {
      e.stopPropagation();
      if (clientState.ws && clientState.ws.readyState === 1) {
        clientState.ws.send(JSON.stringify({ type: 'click-breakpoint', bugId }));
      }
    } catch (err) {
      console.error('Error handling breakpoint click:', err);
      showError('Error clicking breakpoint', ERROR_LEVELS.ERROR);
    }
  });

  dom.arena.appendChild(bp);

  // Store references for cleanup
  clientState.infiniteLoopOverlays = clientState.infiniteLoopOverlays || {};
  clientState.infiniteLoopOverlays[bugId] = { svg, breakpoint: bp, variant };

  // Start proximity glow check
  startInfiniteLoopProximityCheck(bugId);
}

function startInfiniteLoopProximityCheck(bugId) {
  const overlay = clientState.infiniteLoopOverlays && clientState.infiniteLoopOverlays[bugId];
  if (!overlay) return;
  const { variant, breakpoint } = overlay;
  const hitWindow = 0.5; // same as server hitWindowRadians

  function checkProximity() {
    if (!clientState.infiniteLoopOverlays || !clientState.infiniteLoopOverlays[bugId]) return;
    const bugEl = clientState.bugs[bugId];
    if (!bugEl) return;

    // Estimate current angle from bug position
    const pos = clientState.bugPositions[bugId];
    if (!pos) { overlay.rafId = requestAnimationFrame(checkProximity); return; }
    const dx = pos.x - variant.loopCenterX;
    const dy = pos.y - variant.loopCenterY;
    const currentAngle = Math.atan2(dy, dx);
    let diff = Math.abs(currentAngle - variant.breakpointAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;

    if (diff <= hitWindow * 1.5) {
      breakpoint.classList.add('hot');
    } else {
      breakpoint.classList.remove('hot');
    }

    overlay.rafId = requestAnimationFrame(checkProximity);
  }

  overlay.rafId = requestAnimationFrame(checkProximity);
}

function removeInfiniteLoopOverlay(bugId) {
  if (!clientState.infiniteLoopOverlays || !clientState.infiniteLoopOverlays[bugId]) return;
  const overlay = clientState.infiniteLoopOverlays[bugId];
  if (overlay.rafId) cancelAnimationFrame(overlay.rafId);
  overlay.svg.remove();
  overlay.breakpoint.remove();
  delete clientState.infiniteLoopOverlays[bugId];
}

export function removeBugElement(bugId, animate) {
  const el = clientState.bugs[bugId];
  if (!el) return;
  
  // Clean up event listeners to prevent memory leaks
  if (el._memoryLeakHandlers) {
    el.removeEventListener('mousedown', el._memoryLeakHandlers.mousedown);
    el.removeEventListener('mouseup', el._memoryLeakHandlers.mouseup);
    el.removeEventListener('mouseleave', el._memoryLeakHandlers.mouseleave);
    delete el._memoryLeakHandlers;
  }
  if (el._clickHandler) {
    el.removeEventListener('click', el._clickHandler);
    delete el._clickHandler;
  }
  
  delete clientState.bugs[bugId];
  delete clientState.bugPositions[bugId];
  removeInfiniteLoopOverlay(bugId);
  if (animate) {
    el.classList.add('popping');
    setTimeout(() => el.remove(), 200);
  } else {
    el.remove();
  }
}

export function clearAllBugs() {
  for (const id of Object.keys(clientState.bugs)) {
    const el = clientState.bugs[id];
    // Clean up event listeners
    if (el._memoryLeakHandlers) {
      el.removeEventListener('mousedown', el._memoryLeakHandlers.mousedown);
      el.removeEventListener('mouseup', el._memoryLeakHandlers.mouseup);
      el.removeEventListener('mouseleave', el._memoryLeakHandlers.mouseleave);
      delete el._memoryLeakHandlers;
    }
    if (el._clickHandler) {
      el.removeEventListener('click', el._clickHandler);
      delete el._clickHandler;
    }
    el.remove();
  }
  clientState.bugs = {};
  clientState.bugPositions = {};
  // Clear infinite loop overlays
  if (clientState.infiniteLoopOverlays) {
    for (const bid of Object.keys(clientState.infiniteLoopOverlays)) {
      const overlay = clientState.infiniteLoopOverlays[bid];
      if (overlay.rafId) cancelAnimationFrame(overlay.rafId);
      overlay.svg.remove();
      overlay.breakpoint.remove();
    }
    clientState.infiniteLoopOverlays = {};
  }
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
