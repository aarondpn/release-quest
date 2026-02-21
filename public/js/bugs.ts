import { SQUASH_WORDS } from './config.ts';
import { dom, clientState } from './state.ts';
import { logicalToPixel, getArenaRect } from './coordinates.ts';
import { showError, ERROR_LEVELS } from './error-handler.ts';
import type { BugVariant, BugElement } from './client-types.ts';

// Pixel-art intern SVG (32x32) — amber hoodie, headphones, laptop
const AZUBI_INTERN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Headphones -->
  <rect x="8" y="4" width="2" height="6" fill="#555"/>
  <rect x="22" y="4" width="2" height="6" fill="#555"/>
  <rect x="8" y="3" width="16" height="2" rx="1" fill="#555"/>
  <rect x="6" y="6" width="4" height="4" rx="1" fill="#e74c3c"/>
  <rect x="22" y="6" width="4" height="4" rx="1" fill="#e74c3c"/>
  <!-- Head -->
  <rect x="10" y="4" width="12" height="10" rx="2" fill="#fcd5a0"/>
  <!-- Eyes -->
  <rect x="13" y="8" width="2" height="2" fill="#333"/>
  <rect x="18" y="8" width="2" height="2" fill="#333"/>
  <!-- Mouth -->
  <rect x="14" y="11" width="4" height="1" rx="0.5" fill="#c0896a"/>
  <!-- Hoodie body -->
  <rect x="8" y="14" width="16" height="10" rx="2" fill="#f59e0b"/>
  <rect x="8" y="14" width="16" height="3" fill="#d97706"/>
  <!-- Arms -->
  <rect x="5" y="16" width="4" height="6" rx="1" fill="#f59e0b"/>
  <rect x="23" y="16" width="4" height="6" rx="1" fill="#f59e0b"/>
  <!-- Hands -->
  <rect x="6" y="21" width="3" height="2" rx="1" fill="#fcd5a0"/>
  <rect x="23" y="21" width="3" height="2" rx="1" fill="#fcd5a0"/>
  <!-- Laptop -->
  <rect x="10" y="22" width="12" height="2" rx="0.5" fill="#64748b"/>
  <rect x="11" y="20" width="10" height="3" rx="0.5" fill="#94a3b8"/>
  <rect x="12" y="20.5" width="8" height="2" fill="#38bdf8"/>
  <!-- Legs -->
  <rect x="11" y="24" width="4" height="4" rx="1" fill="#1e3a5f"/>
  <rect x="17" y="24" width="4" height="4" rx="1" fill="#1e3a5f"/>
  <!-- Shoes -->
  <rect x="10" y="28" width="5" height="2" rx="1" fill="#333"/>
  <rect x="17" y="28" width="5" height="2" rx="1" fill="#333"/>
</svg>`;

export function createBugElement(bugId: string, lx: number, ly: number, variant: BugVariant | null | undefined): void {
  const el = document.createElement('div') as BugElement;
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
      el.dataset.growthStage = String(variant.growthStage || 0);
    }
    if (variant.isFeature) {
      // Delayed checkmark reveal (600ms ambiguity)
      setTimeout(() => {
        if (el.parentNode) el.classList.add('feature-bug');
      }, 600);
      // Eagle Eye buff: immediately reveal feature bugs with red glow
      if (variant.eagleEye) {
        el.classList.add('eagle-eye-glow');
      }
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
      el.dataset.chainIndex = String(variant.chainIndex);
      el.dataset.chainLength = String(variant.chainLength);
    }
    if (variant.isInfiniteLoop) {
      el.classList.add('infinite-loop');
    }
    if (variant.isAzubi) {
      el.classList.remove('walking');
      el.classList.add('azubi');
      // Replace bug innards with intern character
      el.innerHTML = `
        <div class="azubi-character">${AZUBI_INTERN_SVG}</div>
        <div class="azubi-label">Azubi</div>`;
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
    let holdStartTime: number | null = null;

    const handleMouseDown = (e: MouseEvent) => {
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

    const handleMouseUp = (e: MouseEvent) => {
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

    const handleMouseLeave = (_e: MouseEvent) => {
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
    const handleClick = (e: MouseEvent) => {
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

  dom.arena!.appendChild(el);
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
    tryCreatePipelineTether(variant.chainId!);
  }
}

export function createMergeTether(bugId1: string, bugId2: string, conflictId: string): void {
  const existing = dom.arena!.querySelector('.merge-tether[data-conflict="' + conflictId + '"]');
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
  dom.arena!.appendChild(svg);
  clientState.mergeTethers = clientState.mergeTethers || {};
  clientState.mergeTethers[conflictId] = { svg, line, bug1: bugId1, bug2: bugId2 };
  updateMergeTether(conflictId);
  startTetherTracking();
}

export function updateMergeTether(conflictId: string): void {
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
  t.line.setAttribute('x1', String(x1));
  t.line.setAttribute('y1', String(y1));
  t.line.setAttribute('x2', String(x2));
  t.line.setAttribute('y2', String(y2));
}

let tetherRafId: number | null = null;

function tickTethers(): void {
  const hasMerge = clientState.mergeTethers && Object.keys(clientState.mergeTethers).length > 0;
  const hasDep = clientState.pipelineTethers && Object.keys(clientState.pipelineTethers).length > 0;
  if (!hasMerge && !hasDep) {
    tetherRafId = null;
    return;
  }
  if (hasMerge) {
    for (const cid of Object.keys(clientState.mergeTethers!)) {
      updateMergeTether(cid);
    }
  }
  if (hasDep) {
    for (const cid of Object.keys(clientState.pipelineTethers!)) {
      updatePipelineTether(cid);
    }
  }
  tetherRafId = requestAnimationFrame(tickTethers);
}

export function startTetherTracking(): void {
  if (!tetherRafId) tetherRafId = requestAnimationFrame(tickTethers);
}

export function stopTetherTracking(): void {
  if (tetherRafId) { cancelAnimationFrame(tetherRafId); tetherRafId = null; }
}

export function removeMergeTether(conflictId: string): void {
  if (!clientState.mergeTethers || !clientState.mergeTethers[conflictId]) return;
  clientState.mergeTethers[conflictId].svg.remove();
  delete clientState.mergeTethers[conflictId];
  if (Object.keys(clientState.mergeTethers).length === 0 &&
      (!clientState.pipelineTethers || Object.keys(clientState.pipelineTethers).length === 0)) {
    stopTetherTracking();
  }
}

// ── Pipeline chain tethers ──

function tryCreatePipelineTether(chainId: string): void {
  // Collect all bugs belonging to this chain
  const chainBugs: { id: string; index: number }[] = [];
  for (const [bid, el] of Object.entries(clientState.bugs)) {
    if (el.dataset.chainId === chainId) {
      chainBugs.push({ id: bid, index: parseInt(el.dataset.chainIndex!, 10) });
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

  const lines: { line: SVGLineElement; from: string; to: string }[] = [];
  for (let i = 0; i < chainBugs.length - 1; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#a855f7');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4 6');
    line.setAttribute('opacity', '0.6');
    svg.appendChild(line);
    lines.push({ line, from: chainBugs[i].id, to: chainBugs[i + 1].id });
  }

  dom.arena!.appendChild(svg);
  clientState.pipelineTethers = clientState.pipelineTethers || {};
  clientState.pipelineTethers[chainId] = { svg, lines, bugIds: chainBugs.map(b => b.id) };
  updatePipelineTether(chainId);
  startTetherTracking();
}

export function updatePipelineTether(chainId: string): void {
  if (!clientState.pipelineTethers || !clientState.pipelineTethers[chainId]) return;
  const t = clientState.pipelineTethers[chainId];
  const arenaRect = getArenaRect();
  for (const seg of t.lines) {
    const el1 = clientState.bugs[seg.from];
    const el2 = clientState.bugs[seg.to];
    if (!el1 || !el2) continue;
    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();
    seg.line.setAttribute('x1', String(r1.left - arenaRect.left + r1.width / 2));
    seg.line.setAttribute('y1', String(r1.top - arenaRect.top + r1.height / 2));
    seg.line.setAttribute('x2', String(r2.left - arenaRect.left + r2.width / 2));
    seg.line.setAttribute('y2', String(r2.top - arenaRect.top + r2.height / 2));
  }
}

export function removePipelineTether(chainId: string): void {
  if (!clientState.pipelineTethers || !clientState.pipelineTethers[chainId]) return;
  clientState.pipelineTethers[chainId].svg.remove();
  delete clientState.pipelineTethers[chainId];
  if (Object.keys(clientState.pipelineTethers).length === 0 &&
      (!clientState.mergeTethers || Object.keys(clientState.mergeTethers).length === 0)) {
    stopTetherTracking();
  }
}

export function rebuildPipelineTether(chainId: string): void {
  removePipelineTether(chainId);
  tryCreatePipelineTether(chainId);
}

// ── Infinite Loop overlay (breakpoint marker + orbit path) ──

function createInfiniteLoopOverlay(bugId: string, variant: BugVariant): void {
  const { loopCenterX, loopCenterY, loopRadiusX, loopRadiusY, breakpointAngle } = variant;

  // Draw SVG ellipse orbit path with animated flowing dashes
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('infinite-loop-path');
  svg.setAttribute('data-bug-id', bugId);
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:8;';
  const center = logicalToPixel(loopCenterX!, loopCenterY!);
  // Bug elements are 48x48px positioned by top-left corner;
  // offset the orbit path to align with the bug's visual center
  const bugOffset = 24;
  center.x += bugOffset;
  center.y += bugOffset;
  const arenaRect = getArenaRect();
  const scaleX = arenaRect.width / 800;
  const scaleY = arenaRect.height / 500;
  const rxPx = loopRadiusX! * scaleX;
  const ryPx = loopRadiusY! * scaleY;

  // Outer glow track
  const glowEllipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  glowEllipse.setAttribute('cx', String(center.x));
  glowEllipse.setAttribute('cy', String(center.y));
  glowEllipse.setAttribute('rx', String(rxPx));
  glowEllipse.setAttribute('ry', String(ryPx));
  glowEllipse.setAttribute('fill', 'none');
  glowEllipse.setAttribute('stroke', '#06b6d4');
  glowEllipse.setAttribute('stroke-width', '4');
  glowEllipse.setAttribute('opacity', '0.08');
  svg.appendChild(glowEllipse);

  // Main orbit track with animated dash flow
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', String(center.x));
  ellipse.setAttribute('cy', String(center.y));
  ellipse.setAttribute('rx', String(rxPx));
  ellipse.setAttribute('ry', String(ryPx));
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('stroke', '#22d3ee');
  ellipse.setAttribute('stroke-width', '1.5');
  ellipse.setAttribute('stroke-dasharray', '3 8');
  ellipse.setAttribute('opacity', '0.35');
  ellipse.setAttribute('stroke-linecap', 'round');
  svg.appendChild(ellipse);

  // Animate dash offset for flowing effect
  const circumference = Math.PI * 2 * Math.max(rxPx, ryPx);
  let dashOffset = 0;
  const dashSpeed = circumference / (variant.loopTickMs ? (2800 / variant.loopTickMs) : 56);

  dom.arena!.appendChild(svg);

  // Create breakpoint marker at the breakpoint angle on the ellipse
  // Breakpoint uses translate(-50%,-50%) so it's centered — offset to match the bug-center orbit
  const bpX = loopCenterX! + Math.cos(breakpointAngle!) * loopRadiusX!;
  const bpY = loopCenterY! + Math.sin(breakpointAngle!) * loopRadiusY!;
  const bpPos = logicalToPixel(bpX, bpY);
  bpPos.x += bugOffset;
  bpPos.y += bugOffset;
  const bp = document.createElement('div');
  bp.className = 'infinite-loop-breakpoint';
  bp.setAttribute('data-bug-id', bugId);
  bp.style.left = bpPos.x + 'px';
  bp.style.top = bpPos.y + 'px';

  bp.addEventListener('click', (e: MouseEvent) => {
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

  dom.arena!.appendChild(bp);

  // Store references for cleanup
  clientState.infiniteLoopOverlays = clientState.infiniteLoopOverlays || {};
  clientState.infiniteLoopOverlays[bugId] = {
    svg, ellipse, breakpoint: bp, variant, dashOffset, dashSpeed, trailTimer: null,
  };

  // Start proximity glow check + dash animation + trail dots
  startInfiniteLoopAnimations(bugId);
}

function startInfiniteLoopAnimations(bugId: string): void {
  const overlay = clientState.infiniteLoopOverlays && clientState.infiniteLoopOverlays[bugId];
  if (!overlay) return;
  const { variant, breakpoint, ellipse } = overlay;
  const hitWindow = 0.45; // match server hitWindowRadians

  // Trail dot spawning (every 100ms, drop a fading dot at bug's position)
  overlay.trailTimer = setInterval(() => {
    const pos = clientState.bugPositions[bugId];
    if (!pos) return;
    const pxPos = logicalToPixel(pos.x, pos.y);
    const dot = document.createElement('div');
    dot.className = 'infinite-loop-trail-dot';
    dot.style.left = pxPos.x + 'px';
    dot.style.top = pxPos.y + 'px';
    dom.arena!.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }, 100);

  function animate(): void {
    if (!clientState.infiniteLoopOverlays || !clientState.infiniteLoopOverlays[bugId]) return;
    const bugEl = clientState.bugs[bugId];
    if (!bugEl) return;

    // Animate flowing dashes
    overlay!.dashOffset -= overlay!.dashSpeed * 0.016; // ~60fps
    ellipse.setAttribute('stroke-dashoffset', String(overlay!.dashOffset));

    // Proximity check: estimate current angle from bug position
    const pos = clientState.bugPositions[bugId];
    if (pos) {
      const dx = pos.x - variant.loopCenterX!;
      const dy = pos.y - variant.loopCenterY!;
      const currentAngle = Math.atan2(dy, dx);
      let diff = Math.abs(currentAngle - variant.breakpointAngle!);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      // "hot" zone at 1.2× the hit window for visual lead-in
      if (diff <= hitWindow * 1.2) {
        breakpoint.classList.add('hot');
      } else {
        breakpoint.classList.remove('hot');
      }
    }

    overlay!.rafId = requestAnimationFrame(animate);
  }

  overlay.rafId = requestAnimationFrame(animate);
}

function removeInfiniteLoopOverlay(bugId: string): void {
  if (!clientState.infiniteLoopOverlays || !clientState.infiniteLoopOverlays[bugId]) return;
  const overlay = clientState.infiniteLoopOverlays[bugId];
  if (overlay.rafId) cancelAnimationFrame(overlay.rafId);
  if (overlay.trailTimer) clearInterval(overlay.trailTimer);
  overlay.svg.remove();
  overlay.breakpoint.remove();
  // Clean up any lingering trail dots for this bug
  dom.arena!.querySelectorAll('.infinite-loop-trail-dot').forEach(dot => dot.remove());
  delete clientState.infiniteLoopOverlays[bugId];
}

export function removeBugElement(bugId: string, animate?: boolean): void {
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

export function clearAllBugs(): void {
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

export function showSquashEffect(lx: number, ly: number, color: string | null | undefined): void {
  const pos = logicalToPixel(lx, ly);
  const fx = document.createElement('div');
  fx.className = 'squash';
  fx.style.left = pos.x + 'px';
  fx.style.top = pos.y + 'px';
  const word = SQUASH_WORDS[Math.floor(Math.random() * SQUASH_WORDS.length)];
  fx.innerHTML = '<span class="squash-text" style="color:' + (color || 'var(--yellow)') + '">' + word + '</span>';
  dom.arena!.appendChild(fx);
  setTimeout(() => fx.remove(), 600);
}
