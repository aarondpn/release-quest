import { dom, clientState } from './state.ts';
import { renderIcon, isPremium, PREMIUM_AVATARS } from './avatars.ts';
import type { SendMessageFn, StatsData } from './client-types.ts';

let _sendMessage: SendMessageFn | null = null;
export function initStatsCardSend(fn: SendMessageFn): void { _sendMessage = fn; }

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

interface Theme {
  label: string;
  bg1: string;
  bg2: string;
  border: string;
  accent: string;
  accent2: string;
  glow: string;
  title: string;
  statVal: string;
  statLabel: string;
  rankBg: string;
  rankBorder: string;
  rankText: string;
  gridColor: string;
  scanlineColor: string;
}

const THEMES: Record<string, Theme> = {
  neon: {
    label: 'NEON',
    bg1: '#0a0a1a', bg2: '#0f0e17', border: '#4ecdc4', accent: '#4ecdc4', accent2: '#a855f7',
    glow: 'rgba(78,205,196,0.3)', title: '#4ecdc4', statVal: '#ffe66d', statLabel: '#a7a9be',
    rankBg: 'rgba(78,205,196,0.15)', rankBorder: '#4ecdc4', rankText: '#4ecdc4',
    gridColor: 'rgba(78,205,196,0.06)', scanlineColor: 'rgba(78,205,196,0.03)',
  },
  inferno: {
    label: 'INFERNO',
    bg1: '#1a0a0a', bg2: '#170e0e', border: '#ff6b6b', accent: '#ff6b6b', accent2: '#ffe66d',
    glow: 'rgba(255,107,107,0.3)', title: '#ff6b6b', statVal: '#ffe66d', statLabel: '#a7a9be',
    rankBg: 'rgba(255,107,107,0.15)', rankBorder: '#ff6b6b', rankText: '#ff6b6b',
    gridColor: 'rgba(255,107,107,0.06)', scanlineColor: 'rgba(255,107,107,0.03)',
  },
  phantom: {
    label: 'PHANTOM',
    bg1: '#0d0a1a', bg2: '#12101e', border: '#a855f7', accent: '#a855f7', accent2: '#ff9ff3',
    glow: 'rgba(168,85,247,0.3)', title: '#a855f7', statVal: '#ff9ff3', statLabel: '#a7a9be',
    rankBg: 'rgba(168,85,247,0.15)', rankBorder: '#a855f7', rankText: '#a855f7',
    gridColor: 'rgba(168,85,247,0.06)', scanlineColor: 'rgba(168,85,247,0.03)',
  },
};

let currentTheme = 'neon';
let currentStats: StatsData | null = null;

interface Rank { title: string; tier: number; }

function getRank(stats: StatsData | null): Rank {
  if (!stats) return { title: 'UNKNOWN', tier: 0 };
  const score = Number(stats.total_score) || 0;
  const wins = stats.games_won || 0;
  const played = stats.games_played || 0;

  if (score >= 50000 && wins >= 50) return { title: 'DEBUG LEGEND', tier: 6 };
  if (score >= 20000 && wins >= 25) return { title: 'EXTERMINATOR', tier: 5 };
  if (score >= 10000 && wins >= 10) return { title: 'BUG SLAYER', tier: 4 };
  if (score >= 5000 && played >= 10) return { title: 'CODE HUNTER', tier: 3 };
  if (score >= 1000 || played >= 5) return { title: 'BUG TRACKER', tier: 2 };
  if (played >= 1) return { title: 'BUG ROOKIE', tier: 1 };
  return { title: 'NEWCOMER', tier: 0 };
}

export function requestMyStats(): void {
  if (_sendMessage) _sendMessage({ type: 'get-my-stats' });
}

export function handleMyStats(stats: StatsData | null): void {
  currentStats = stats || {
    games_played: 0, games_won: 0, games_lost: 0,
    total_score: 0, highest_score: 0, bugs_squashed: 0,
  };
  renderStatsCardPreview();
}

export function showStatsCardTab(): void {
  if (dom.lobbyListPanel) dom.lobbyListPanel.classList.add('hidden');
  if (dom.leaderboardPanel) dom.leaderboardPanel.classList.add('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  if (dom.statsCardPanel) dom.statsCardPanel.classList.remove('hidden');
  if (dom.lobbiesTab) dom.lobbiesTab.classList.remove('active');
  if (dom.leaderboardTab) dom.leaderboardTab.classList.remove('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  if (dom.statsCardTab) dom.statsCardTab.classList.add('active');
  requestMyStats();
}

export function hideStatsCardTab(): void {
  if (dom.statsCardPanel) dom.statsCardPanel.classList.add('hidden');
  if (dom.statsCardTab) dom.statsCardTab.classList.remove('active');
}

function renderStatsCardPreview(): void {
  if (!dom.statsCardPreview) return;

  if (!clientState.isLoggedIn) {
    dom.statsCardPreview.innerHTML = '<div class="stats-card-empty">Log in to create your stats card</div>';
    if (dom.statsCardDownloadBtn) {
      dom.statsCardDownloadBtn.classList.remove('hidden');
      dom.statsCardDownloadBtn.disabled = true;
      dom.statsCardDownloadBtn.title = 'Log in to download your stats card';
    }
    setThemeButtonsDisabled(true);
    return;
  }

  if (!currentStats) {
    dom.statsCardPreview.innerHTML = '<div class="stats-card-empty">Loading stats...</div>';
    if (dom.statsCardDownloadBtn) {
      dom.statsCardDownloadBtn.disabled = true;
      dom.statsCardDownloadBtn.title = '';
    }
    setThemeButtonsDisabled(true);
    return;
  }

  const user = clientState.authUser || { username: 'Player', displayName: 'Player', icon: '\u{1F431}', id: 0 };
  const name = user.displayName || user.username || 'Player';
  const icon = user.icon || '\u{1F431}';
  const rank = getRank(currentStats);
  const winRate = currentStats.games_played > 0
    ? Math.round((currentStats.games_won / currentStats.games_played) * 100)
    : 0;

  const avatarHtml = renderIcon(icon, 64);

  dom.statsCardPreview.innerHTML =
    '<div class="sc-card" data-theme="' + currentTheme + '">' +
      '<div class="sc-corner sc-corner-tl"></div>' +
      '<div class="sc-corner sc-corner-tr"></div>' +
      '<div class="sc-corner sc-corner-bl"></div>' +
      '<div class="sc-corner sc-corner-br"></div>' +
      '<div class="sc-scanlines"></div>' +
      '<div class="sc-grid"></div>' +
      '<div class="sc-header">' +
        '<div class="sc-avatar">' + avatarHtml + '</div>' +
        '<div class="sc-name" data-text="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>' +
        '<div class="sc-rank">' + rank.title + '</div>' +
      '</div>' +
      '<div class="sc-divider"></div>' +
      '<div class="sc-stats">' +
        '<div class="sc-stat"><div class="sc-stat-val">' + Number(currentStats.total_score).toLocaleString() + '</div><div class="sc-stat-label">TOTAL SCORE</div></div>' +
        '<div class="sc-stat"><div class="sc-stat-val">' + currentStats.highest_score.toLocaleString() + '</div><div class="sc-stat-label">BEST SCORE</div></div>' +
        '<div class="sc-stat"><div class="sc-stat-val">' + currentStats.games_played + '</div><div class="sc-stat-label">GAMES</div></div>' +
        '<div class="sc-stat"><div class="sc-stat-val">' + currentStats.games_won + '</div><div class="sc-stat-label">WINS</div></div>' +
        '<div class="sc-stat"><div class="sc-stat-val">' + winRate + '%</div><div class="sc-stat-label">WIN RATE</div></div>' +
        '<div class="sc-stat"><div class="sc-stat-val">' + currentStats.bugs_squashed.toLocaleString() + '</div><div class="sc-stat-label">BUGS SQUASHED</div></div>' +
      '</div>' +
      '<div class="sc-footer">RELEASE QUEST</div>' +
    '</div>';

  if (dom.statsCardDownloadBtn) {
    dom.statsCardDownloadBtn.classList.remove('hidden');
    dom.statsCardDownloadBtn.disabled = false;
    dom.statsCardDownloadBtn.title = '';
  }
  setThemeButtonsDisabled(false);
}

function setThemeButtonsDisabled(disabled: boolean): void {
  if (!dom.statsCardThemes) return;
  dom.statsCardThemes.querySelectorAll<HTMLButtonElement>('.sc-theme-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

export function initThemePicker(): void {
  if (!dom.statsCardThemes) return;
  dom.statsCardThemes.innerHTML = '';
  for (const [key, theme] of Object.entries(THEMES)) {
    const btn = document.createElement('button');
    btn.className = 'sc-theme-btn' + (key === currentTheme ? ' active' : '');
    btn.dataset.theme = key;
    btn.innerHTML = '<span class="sc-theme-swatch" style="background:' + theme.accent + '"></span>' + theme.label;
    btn.addEventListener('click', () => {
      currentTheme = key;
      dom.statsCardThemes!.querySelectorAll('.sc-theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStatsCardPreview();
    });
    dom.statsCardThemes.appendChild(btn);
  }
}

export function downloadStatsCardPng(): void {
  if (!currentStats || !clientState.isLoggedIn) return;

  const t = THEMES[currentTheme];
  const user = clientState.authUser || { username: 'Player', displayName: 'Player', icon: '\u{1F431}', id: 0 };
  const name = user.displayName || user.username || 'Player';
  const icon = user.icon || '\u{1F431}';
  const rank = getRank(currentStats);
  const winRate = currentStats.games_played > 0
    ? Math.round((currentStats.games_won / currentStats.games_played) * 100)
    : 0;

  const W = 400;
  const H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const c = canvas.getContext('2d')!;
  c.scale(2, 2);

  function drawCard(): void {
    const bgGrad = c.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, t.bg1);
    bgGrad.addColorStop(1, t.bg2);
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    c.strokeStyle = t.gridColor;
    c.lineWidth = 0.5;
    for (let x = 0; x < W; x += 16) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let y = 0; y < H; y += 16) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }

    c.fillStyle = t.scanlineColor;
    for (let y = 0; y < H; y += 4) {
      c.fillRect(0, y, W, 2);
    }

    c.strokeStyle = t.border;
    c.lineWidth = 3;
    c.strokeRect(6, 6, W - 12, H - 12);
    c.lineWidth = 1;
    c.globalAlpha = 0.3;
    c.strokeRect(12, 12, W - 24, H - 24);
    c.globalAlpha = 1;

    const cs = 14;
    c.fillStyle = t.accent;
    c.fillRect(6, 6, cs, 3); c.fillRect(6, 6, 3, cs);
    c.fillRect(W - 6 - cs, 6, cs, 3); c.fillRect(W - 9, 6, 3, cs);
    c.fillRect(6, H - 9, cs, 3); c.fillRect(6, H - 6 - cs, 3, cs);
    c.fillRect(W - 6 - cs, H - 9, cs, 3); c.fillRect(W - 9, H - 6 - cs, 3, cs);

    const glowGrad = c.createRadialGradient(W / 2, 100, 10, W / 2, 100, 90);
    glowGrad.addColorStop(0, t.glow);
    glowGrad.addColorStop(1, 'transparent');
    c.fillStyle = glowGrad;
    c.fillRect(0, 30, W, 160);

    c.beginPath();
    c.arc(W / 2, 100, 44, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fill();
    c.strokeStyle = t.accent;
    c.lineWidth = 2;
    c.stroke();
  }

  function drawContent(): void {
    c.font = '14px "Press Start 2P"';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.globalAlpha = 0.3;
    c.fillStyle = t.accent2;
    c.fillText(name, W / 2 - 1, 163);
    c.globalAlpha = 1;
    c.fillStyle = t.title;
    c.fillText(name, W / 2, 162);

    c.font = '7px "Press Start 2P"';
    const rankW = c.measureText(rank.title).width + 24;
    const rankX = (W - rankW) / 2;
    c.fillStyle = t.rankBg;
    c.fillRect(rankX, 182, rankW, 22);
    c.strokeStyle = t.rankBorder;
    c.lineWidth = 1;
    c.strokeRect(rankX, 182, rankW, 22);
    c.fillStyle = t.rankText;
    c.fillText(rank.title, W / 2, 194);

    const divY = 220;
    c.strokeStyle = t.accent;
    c.globalAlpha = 0.4;
    c.beginPath(); c.moveTo(30, divY); c.lineTo(W - 30, divY); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = t.accent;
    c.save();
    c.translate(W / 2, divY);
    c.rotate(Math.PI / 4);
    c.fillRect(-4, -4, 8, 8);
    c.restore();

    const stats: { label: string; value: string }[] = [
      { label: 'TOTAL SCORE', value: Number(currentStats!.total_score).toLocaleString() },
      { label: 'BEST SCORE', value: currentStats!.highest_score.toLocaleString() },
      { label: 'GAMES', value: String(currentStats!.games_played) },
      { label: 'WINS', value: String(currentStats!.games_won) },
      { label: 'WIN RATE', value: winRate + '%' },
      { label: 'BUGS SQUASHED', value: currentStats!.bugs_squashed.toLocaleString() },
    ];
    const gridTop = 240;
    const colW = (W - 60) / 2;
    const rowH = 64;
    stats.forEach((stat, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 30 + col * colW + colW / 2;
      const cy = gridTop + row * rowH;
      c.fillStyle = t.statVal;
      c.font = '14px "Press Start 2P"';
      c.textAlign = 'center';
      c.fillText(stat.value, cx, cy + 10);
      c.fillStyle = t.statLabel;
      c.font = '6px "Press Start 2P"';
      c.fillText(stat.label, cx, cy + 30);
    });

    const footDivY = gridTop + 3 * rowH + 8;
    c.strokeStyle = t.accent;
    c.globalAlpha = 0.2;
    c.beginPath(); c.moveTo(30, footDivY); c.lineTo(W - 30, footDivY); c.stroke();
    c.globalAlpha = 1;

    c.fillStyle = t.accent;
    c.globalAlpha = 0.5;
    c.font = '6px "Press Start 2P"';
    c.fillText('RELEASE QUEST', W / 2, H - 22);
    c.globalAlpha = 1;

    const pixels: { x: number; y: number; cl: string; s: number; a?: number }[] = [
      { x: 20, y: 45, cl: t.accent, s: 4 },
      { x: W - 24, y: 50, cl: t.accent2, s: 3 },
      { x: 25, y: H - 45, cl: t.accent2, s: 4 },
      { x: W - 20, y: H - 50, cl: t.accent, s: 3 },
      { x: 45, y: 30, cl: t.accent, s: 2, a: 0.5 },
      { x: W - 50, y: 35, cl: t.accent2, s: 2, a: 0.5 },
    ];
    pixels.forEach(p => {
      c.globalAlpha = p.a || 0.7;
      c.fillStyle = p.cl;
      c.fillRect(p.x, p.y, p.s, p.s);
    });
    c.globalAlpha = 1;
  }

  function finalize(): void {
    drawContent();
    triggerDownload(canvas, name);
  }

  drawCard();

  const avatarResult = drawAvatar(c, icon, W / 2, 100, 36);
  if (avatarResult instanceof Promise) {
    avatarResult.then(finalize);
  } else {
    finalize();
  }
}

function drawAvatar(ctx: CanvasRenderingContext2D, icon: string, cx: number, cy: number, radius: number): Promise<void> | true {
  if (isPremium(icon)) {
    const av = PREMIUM_AVATARS[icon];
    if (av) {
      const img = new Image();
      img.src = av.svg;
      return new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.imageSmoothingEnabled = true;
          resolve();
        };
        img.onerror = () => {
          drawEmojiAvatar(ctx, '?', cx, cy);
          resolve();
        };
      });
    }
  }
  drawEmojiAvatar(ctx, icon || '\u{1F431}', cx, cy);
  return true;
}

function drawEmojiAvatar(ctx: CanvasRenderingContext2D, emoji: string, cx: number, cy: number): void {
  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 2);
  ctx.font = '10px "Press Start 2P"';
}

function triggerDownload(canvas: HTMLCanvasElement, name: string): void {
  const link = document.createElement('a');
  link.download = 'release-quest-' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
