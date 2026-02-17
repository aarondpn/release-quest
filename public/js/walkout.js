import { renderIcon } from './avatars.js';

const ROW_HEIGHT = 80;

/**
 * Show a slot-machine "Player of the Match" reveal animation.
 * @param {object[]} playerList - All players [{ name, icon, color, score, bugsSquashed }]
 * @param {() => void} onComplete - Called when dismissed
 */
export function showWalkout(playerList, onComplete) {
  const sorted = playerList.slice().sort((a, b) => b.score - a.score);
  const mvp = sorted[0];
  const numPlayers = sorted.length;
  const reps = Math.max(14, Math.ceil(56 / numPlayers));
  const totalSlots = numPlayers * reps;
  const totalHeight = totalSlots * ROW_HEIGHT;

  // Target: land on MVP (index 0 in sorted) late in the strip
  const targetRep = Math.floor(reps * 0.8);
  const targetSlot = targetRep * numPlayers; // MVP is index 0
  const targetY = targetSlot * ROW_HEIGHT;

  let running = true;
  let phase = 0;
  let clickReady = false;
  const timers = [];
  let sparkles = [];
  let confettiPieces = [];
  let sparkleCtx = null;
  let confettiCtx = null;
  let lastParticleTime = 0;

  function schedule(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function wait(ms) { return new Promise(r => { timers.push(setTimeout(r, ms)); }); }

  // ── Build DOM ──
  const overlay = document.createElement('div');
  overlay.className = 'walkout-overlay';

  const titleEl = document.createElement('div');
  titleEl.className = 'walkout-title';
  titleEl.innerHTML = 'PLAYER OF<br>THE MATCH';
  overlay.appendChild(titleEl);

  const reelFrame = document.createElement('div');
  reelFrame.className = 'walkout-reel-frame';

  const scanlines = document.createElement('div');
  scanlines.className = 'walkout-scanlines';
  reelFrame.appendChild(scanlines);

  const indicator = document.createElement('div');
  indicator.className = 'walkout-reel-indicator';
  reelFrame.appendChild(indicator);

  const reelStrip = document.createElement('div');
  reelStrip.className = 'walkout-reel-strip';
  // Fill reel with repeated player rows
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < numPlayers; i++) {
      const p = sorted[i];
      const row = document.createElement('div');
      row.className = 'walkout-reel-name';
      row.dataset.player = String(i);
      row.innerHTML =
        '<span class="walkout-reel-icon">' + renderIcon(p.icon || '', 30) + '</span>' +
        '<span style="color:' + (p.color || '#fff') + '">' + escapeText(p.name) + '</span>';
      reelStrip.appendChild(row);
    }
  }
  reelFrame.appendChild(reelStrip);

  const sparkleCanvas = document.createElement('canvas');
  sparkleCanvas.className = 'walkout-sparkle-canvas';
  reelFrame.appendChild(sparkleCanvas);

  // MVP card (inside reel frame, revealed after spin)
  const mvpCard = document.createElement('div');
  mvpCard.className = 'walkout-mvp-card';

  const mvpAvatar = document.createElement('div');
  mvpAvatar.className = 'walkout-mvp-avatar';
  if (mvp.color) {
    mvpAvatar.style.borderColor = mvp.color;
    mvpAvatar.style.boxShadow = '0 0 25px ' + mvp.color + '4d';
  }
  mvpAvatar.innerHTML = renderIcon(mvp.icon || '', 44);

  const mvpName = document.createElement('div');
  mvpName.className = 'walkout-mvp-name';
  mvpName.textContent = mvp.name;

  const mvpStats = document.createElement('div');
  mvpStats.className = 'walkout-mvp-stats';
  mvpStats.innerHTML =
    '<div class="walkout-stat-box">' +
      '<div class="walkout-stat-label">SCORE</div>' +
      '<div class="walkout-stat-value" data-target="' + mvp.score + '">0</div>' +
    '</div>' +
    '<div class="walkout-stat-box">' +
      '<div class="walkout-stat-label">BUGS SQUASHED</div>' +
      '<div class="walkout-stat-value" data-target="' + (mvp.bugsSquashed || 0) + '">0</div>' +
    '</div>';

  mvpCard.appendChild(mvpAvatar);
  mvpCard.appendChild(mvpName);
  mvpCard.appendChild(mvpStats);
  reelFrame.appendChild(mvpCard);

  overlay.appendChild(reelFrame);

  const continueEl = document.createElement('div');
  continueEl.className = 'walkout-continue';
  continueEl.textContent = 'CLICK TO CONTINUE';
  overlay.appendChild(continueEl);

  const confettiCanvas = document.createElement('canvas');
  confettiCanvas.className = 'walkout-confetti-canvas';
  overlay.appendChild(confettiCanvas);

  const flashEl = document.createElement('div');
  flashEl.className = 'walkout-flash';
  overlay.appendChild(flashEl);

  document.body.appendChild(overlay);

  // ── Click handler (ignore clicks for 1.5s to prevent accidental dismissal) ──
  schedule(() => { clickReady = true; }, 1500);
  overlay.addEventListener('click', () => {
    if (!clickReady) return;
    if (phase >= 10) {
      dismiss();
    } else if (phase >= 1) {
      skipToEnd();
    }
  });

  function dismiss() {
    if (!running) return;
    running = false;
    timers.forEach(clearTimeout);
    overlay.classList.add('walkout-fading');
    setTimeout(() => {
      overlay.remove();
      onComplete();
    }, 300);
  }

  function skipToEnd() {
    phase = 10;
    titleEl.classList.add('visible');
    reelFrame.classList.add('visible', 'walkout-reel-glow', 'walkout-reel-expand');
    indicator.classList.remove('visible');
    reelStrip.style.display = 'none';
    scanlines.style.opacity = '0';
    mvpCard.style.display = 'flex';
    mvpCard.classList.add('visible');
    // Set final counter values
    mvpCard.querySelectorAll('.walkout-stat-value').forEach(el => {
      el.textContent = parseInt(el.dataset.target) || 0;
    });
    continueEl.classList.add('visible');
    resizeCanvases();
    spawnConfetti(50);
  }

  // ── Canvas sizing ──
  function resizeCanvases() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    sparkleCanvas.width = reelFrame.offsetWidth;
    sparkleCanvas.height = reelFrame.offsetHeight;
  }

  // ── Particle loop ──
  function particleLoop(time) {
    if (!running) return;
    const dt = Math.min((time - lastParticleTime) / 1000, 0.05);
    lastParticleTime = time;
    tickSparkles(dt);
    tickConfetti(dt);
    requestAnimationFrame(particleLoop);
  }

  // ── Sparkle system ──
  function spawnSparkles(cx, cy, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 100;
      sparkles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.6, age: 0,
        size: 2 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#ffe66d' : '#ffffff'
      });
    }
  }

  function tickSparkles(dt) {
    if (!sparkleCtx) return;
    const w = sparkleCanvas.width, h = sparkleCanvas.height;
    sparkleCtx.clearRect(0, 0, w, h);
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.age += dt;
      if (s.age >= s.life) { sparkles.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.95; s.vy *= 0.95;
      const alpha = Math.pow(1 - s.age / s.life, 2);
      const sz = s.size * (1 - s.age / s.life * 0.4);
      sparkleCtx.save();
      sparkleCtx.globalAlpha = alpha;
      sparkleCtx.fillStyle = s.color;
      sparkleCtx.shadowColor = s.color;
      sparkleCtx.shadowBlur = 8;
      sparkleCtx.translate(s.x, s.y);
      sparkleCtx.rotate(s.age * 3);
      sparkleCtx.fillRect(-sz * 0.15, -sz, sz * 0.3, sz * 2);
      sparkleCtx.fillRect(-sz, -sz * 0.15, sz * 2, sz * 0.3);
      sparkleCtx.rotate(Math.PI / 4);
      sparkleCtx.fillRect(-sz * 0.1, -sz * 0.7, sz * 0.2, sz * 1.4);
      sparkleCtx.fillRect(-sz * 0.7, -sz * 0.1, sz * 1.4, sz * 0.2);
      sparkleCtx.restore();
    }
  }

  // ── Confetti system ──
  function spawnConfetti(count) {
    const w = confettiCanvas.width, h = confettiCanvas.height;
    const cx = w / 2, cy = h * 0.42;
    const colors = ['#ffe66d', '#fff5b0', '#ffd700', '#4ecdc4', '#a855f7', '#ff6b6b'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 250 + Math.random() * 500;
      confettiPieces.push({
        x: cx + (Math.random() - 0.5) * 60, y: cy,
        vx: Math.cos(angle) * speed * (0.6 + Math.random() * 0.8),
        vy: Math.sin(angle) * speed * (0.6 + Math.random() * 0.8),
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 700,
        w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2.5 + Math.random() * 1.5, age: 0,
        gravity: 380 + Math.random() * 120,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 3 + Math.random() * 4
      });
    }
  }

  function tickConfetti(dt) {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (let i = confettiPieces.length - 1; i >= 0; i--) {
      const c = confettiPieces[i];
      c.age += dt;
      if (c.age >= c.life) { confettiPieces.splice(i, 1); continue; }
      c.vy += c.gravity * dt;
      c.vx *= 0.995;
      c.wobble += c.wobbleSpeed * dt;
      c.x += c.vx * dt + Math.sin(c.wobble) * 0.5;
      c.y += c.vy * dt;
      c.rotation += c.rotSpeed * dt;
      const alpha = c.age < c.life - 0.5 ? 1 : (c.life - c.age) / 0.5;
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, alpha);
      confettiCtx.translate(c.x, c.y);
      confettiCtx.rotate(c.rotation * Math.PI / 180);
      confettiCtx.scale(Math.cos(c.wobble), 1);
      confettiCtx.fillStyle = c.color;
      confettiCtx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      confettiCtx.restore();
    }
  }

  // ── Reel spin physics ──
  function spinReel() {
    return new Promise(resolve => {
      const k = 1.5;
      const v0 = targetY * k;
      let startTime = null;
      let bouncePhase = false;
      let bounceStart = 0;

      function tick(timestamp) {
        if (!running) { resolve(); return; }
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;

        if (!bouncePhase) {
          const currentV = v0 * Math.exp(-k * elapsed);
          let dist = (v0 / k) * (1 - Math.exp(-k * elapsed));
          if (dist >= targetY || currentV < 3) {
            dist = targetY;
            bouncePhase = true;
            bounceStart = timestamp;
          }
          reelStrip.style.transform = 'translateY(' + (-(dist % totalHeight)) + 'px)';
        } else {
          const bt = (timestamp - bounceStart) / 1000;
          const offset = ROW_HEIGHT * 0.12 * Math.exp(-8 * bt) * Math.sin(14 * bt);
          reelStrip.style.transform = 'translateY(' + (-((targetY + offset) % totalHeight)) + 'px)';
          if (bt > 0.5) {
            reelStrip.style.transform = 'translateY(' + (-(targetY % totalHeight)) + 'px)';
            resolve();
            return;
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ── Counter animation ──
  function animateCounter(el, target, duration) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target);
      if (t < 1 && running) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  // ── Flash effect ──
  function doFlash() {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '0.75';
    void flashEl.offsetWidth;
    flashEl.style.transition = 'opacity 0.18s ease-out';
    flashEl.style.opacity = '0';
  }

  // ── Highlight winner row ──
  function highlightWinner() {
    const rows = reelStrip.querySelectorAll('.walkout-reel-name');
    if (rows[targetSlot]) rows[targetSlot].classList.add('winner');
  }

  // ── Main sequence ──
  async function run() {
    resizeCanvases();
    sparkleCtx = sparkleCanvas.getContext('2d');
    confettiCtx = confettiCanvas.getContext('2d');
    lastParticleTime = performance.now();
    requestAnimationFrame(particleLoop);

    // 0.0s — overlay fades in
    phase = 1;
    await wait(350);
    if (!running) return;

    // Title
    phase = 2;
    titleEl.classList.add('visible');
    await wait(350);
    if (!running) return;

    // Reel frame
    phase = 3;
    reelFrame.classList.add('visible');
    indicator.classList.add('visible');
    await wait(250);
    if (!running) return;

    // Spin
    phase = 4;
    await spinReel();
    if (!running) return;

    // Lock — flash + glow + sparkles
    phase = 5;
    doFlash();
    reelFrame.classList.add('walkout-reel-glow');
    highlightWinner();
    resizeCanvases();
    const fw = reelFrame.offsetWidth, fh = reelFrame.offsetHeight;
    spawnSparkles(fw * 0.5, fh * 0.5, 24);
    spawnSparkles(fw * 0.25, fh * 0.5, 10);
    spawnSparkles(fw * 0.75, fh * 0.5, 10);
    await wait(450);
    if (!running) return;

    // Expand to MVP card
    phase = 6;
    reelStrip.style.display = 'none';
    scanlines.style.opacity = '0';
    indicator.classList.remove('visible');
    reelFrame.classList.add('walkout-reel-expand');
    await wait(300);
    if (!running) return;

    mvpCard.style.display = 'flex';
    void mvpCard.offsetHeight;
    mvpCard.classList.add('visible');
    phase = 7;
    await wait(500);
    if (!running) return;

    // Stats count up
    phase = 8;
    const statEls = mvpCard.querySelectorAll('.walkout-stat-value');
    statEls.forEach(el => {
      animateCounter(el, parseInt(el.dataset.target) || 0, 900);
    });
    await wait(900);
    if (!running) return;

    // Confetti
    phase = 9;
    resizeCanvases();
    spawnConfetti(50);
    schedule(() => { if (running) spawnConfetti(20); }, 300);
    await wait(600);
    if (!running) return;

    // Continue
    phase = 10;
    continueEl.classList.add('visible');
  }

  run();
}

function escapeText(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
