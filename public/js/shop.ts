import { dom, clientState } from './state.ts';
import { sendMessage } from './network.ts';
import { hideAllScreens, showLiveDashboard } from './hud.ts';
import { escapeHtml } from './utils.ts';
import type { ActiveBuffDisplay, ShopItem } from './client-types.ts';

let shopTimerRaf: number | null = null;
let shopEndTime = 0;

let activeBuffs: ActiveBuffDisplay[] = [];

const SHOP_ITEM_SVGS: Record<string, string> = {
  'healing-patch': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <rect x="10" y="4" width="12" height="24" rx="2" fill="#f0d0b0"/>
    <rect x="10" y="4" width="12" height="24" rx="2" fill="none" stroke="#c09070" stroke-width="1"/>
    <rect x="4" y="10" width="24" height="12" rx="2" fill="#f0d0b0"/>
    <rect x="4" y="10" width="24" height="12" rx="2" fill="none" stroke="#c09070" stroke-width="1"/>
    <rect x="14" y="8" width="4" height="16" fill="#e74c3c"/>
    <rect x="10" y="14" width="12" height="4" fill="#e74c3c"/>
    <rect x="15" y="9" width="2" height="2" fill="#ff8080" opacity="0.6"/>
  </svg>`,

  'bigger-cursor': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <polygon points="6,2 6,24 12,18 18,26 22,24 16,16 24,16" fill="#f8f8f8"/>
    <polygon points="6,2 6,24 12,18 18,26 22,24 16,16 24,16" fill="none" stroke="#333" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="8,6 8,20 12,16 16,22 18,21 14,15 20,15" fill="#4ecdc4" opacity="0.3"/>
    <circle cx="24" cy="8" r="3" fill="none" stroke="#4ecdc4" stroke-width="1.5" opacity="0.5"/>
    <circle cx="24" cy="8" r="1" fill="#4ecdc4" opacity="0.5"/>
  </svg>`,

  'bug-magnet': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <path d="M6,8 L6,18 Q6,26 16,26 Q26,26 26,18 L26,8" fill="none" stroke="#c0c0c0" stroke-width="6" stroke-linecap="round"/>
    <rect x="3" y="4" width="6" height="8" rx="1" fill="#e74c3c"/>
    <rect x="3" y="8" width="6" height="4" rx="1" fill="#cc3333"/>
    <rect x="23" y="4" width="6" height="8" rx="1" fill="#3498db"/>
    <rect x="23" y="8" width="6" height="4" rx="1" fill="#2070a0"/>
    <rect x="4" y="4" width="4" height="2" fill="#ff6b6b" opacity="0.6"/>
    <rect x="24" y="4" width="4" height="2" fill="#5dade2" opacity="0.6"/>
    <line x1="12" y1="20" x2="12" y2="24" stroke="#ffe66d" stroke-width="1" opacity="0.4"/>
    <line x1="16" y1="22" x2="16" y2="26" stroke="#ffe66d" stroke-width="1" opacity="0.4"/>
    <line x1="20" y1="20" x2="20" y2="24" stroke="#ffe66d" stroke-width="1" opacity="0.4"/>
  </svg>`,

  'eagle-eye': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <ellipse cx="16" cy="16" rx="13" ry="9" fill="#1a1a2e"/>
    <ellipse cx="16" cy="16" rx="13" ry="9" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <ellipse cx="16" cy="16" rx="13" ry="9" fill="none" stroke="#fbbf24" stroke-width="1" opacity="0.3"/>
    <circle cx="16" cy="16" r="6" fill="#d97706"/>
    <circle cx="16" cy="16" r="6" fill="none" stroke="#f59e0b" stroke-width="1"/>
    <circle cx="16" cy="16" r="3" fill="#0f0e17"/>
    <rect x="15" y="14" width="1" height="1" fill="#fbbf24" opacity="0.8"/>
    <path d="M3,16 Q8,8 16,7 Q24,8 29,16" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.5"/>
    <path d="M3,16 Q8,24 16,25 Q24,24 29,16" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.5"/>
  </svg>`,

  'kevlar-vest': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <path d="M8,6 L6,8 L4,14 L6,26 L12,28 L16,30 L20,28 L26,26 L28,14 L26,8 L24,6 L20,4 L16,6 L12,4 Z" fill="#3b5998"/>
    <path d="M8,6 L6,8 L4,14 L6,26 L12,28 L16,30 L20,28 L26,26 L28,14 L26,8 L24,6 L20,4 L16,6 L12,4 Z" fill="none" stroke="#2c3e6e" stroke-width="1"/>
    <path d="M12,4 L16,6 L20,4" fill="none" stroke="#4a6ab5" stroke-width="1.5"/>
    <rect x="14" y="10" width="4" height="10" rx="1" fill="#4a6ab5"/>
    <rect x="11" y="14" width="10" height="3" rx="1" fill="#4a6ab5"/>
    <rect x="15" y="11" width="2" height="2" fill="#6b8fd4" opacity="0.5"/>
    <line x1="8" y1="10" x2="8" y2="22" stroke="#4a6ab5" stroke-width="1" opacity="0.4"/>
    <line x1="24" y1="10" x2="24" y2="22" stroke="#4a6ab5" stroke-width="1" opacity="0.4"/>
  </svg>`,

  'turbo-duck': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <ellipse cx="16" cy="20" rx="10" ry="8" fill="#fbbf24"/>
    <ellipse cx="16" cy="20" rx="10" ry="8" fill="none" stroke="#d97706" stroke-width="1"/>
    <circle cx="14" cy="12" r="6" fill="#fbbf24"/>
    <circle cx="14" cy="12" r="6" fill="none" stroke="#d97706" stroke-width="1"/>
    <rect x="11" y="10" width="2" height="2" fill="#333"/>
    <rect x="15" y="10" width="2" height="2" fill="#333"/>
    <rect x="12" y="13" width="1" height="1" fill="#fcd34d" opacity="0.6"/>
    <path d="M18,12 L24,10 L24,14 Z" fill="#f97316"/>
    <path d="M18,12 L24,10 L24,14 Z" fill="none" stroke="#c2410c" stroke-width="0.5"/>
    <line x1="26" y1="14" x2="30" y2="12" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="26" y1="17" x2="31" y2="17" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="26" y1="20" x2="30" y2="22" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="16" cy="27" rx="5" ry="2" fill="#d97706" opacity="0.3"/>
  </svg>`,
};

function getItemSvg(itemId: string): string | null {
  return SHOP_ITEM_SVGS[itemId] || null;
}


export function openShop(msg: Record<string, any>): void {
  hideAllScreens();
  activeBuffs = [];
  renderBuffHud();
  if (dom.arena) dom.arena.classList.remove('cursor-enlarged');
  if (!dom.shopScreen) return;

  const myScore = msg.playerScores[clientState.myId!] || 0;
  document.getElementById('shop-player-score')!.textContent = String(myScore);
  clientState.shopPlayerScore = myScore;

  const container = document.getElementById('shop-items')!;
  container.innerHTML = '';

  const items: ShopItem[] = msg.items || [];
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.dataset.itemId = item.id;
    const alreadyOwned = activeBuffs.some(b => b.itemId === item.id);
    const canAfford = myScore >= item.cost && !alreadyOwned;
    if (!canAfford && !alreadyOwned) card.classList.add('cannot-afford');
    if (alreadyOwned) card.classList.add('shop-item-bought');

    const svg = getItemSvg(item.id);
    const iconHtml = svg
      ? '<div class="shop-item-icon shop-item-icon-svg">' + svg + '</div>'
      : '<div class="shop-item-icon">' + item.icon + '</div>';

    card.innerHTML =
      iconHtml +
      '<div class="shop-item-name">' + escapeHtml(item.name) + '</div>' +
      '<div class="shop-item-desc">' + escapeHtml(item.description) + '</div>' +
      '<div class="shop-item-cost">' +
        '<button class="btn btn-small shop-buy-btn" ' + (canAfford ? '' : 'disabled') + '>' +
          (alreadyOwned ? 'OWNED' : '<span class="shop-cost-coin"></span> ' + item.cost) +
        '</button>' +
      '</div>';

    if (!alreadyOwned) {
      const buyBtn = card.querySelector<HTMLButtonElement>('.shop-buy-btn')!;
      buyBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        sendMessage({ type: 'shop-buy', itemId: item.id });
      });
    }

    container.appendChild(card);
  }

  const feed = document.getElementById('shop-feed')!;
  feed.innerHTML = '';

  const readyBtn = document.getElementById('shop-ready-btn') as HTMLButtonElement;
  readyBtn.disabled = false;
  readyBtn.textContent = 'READY';
  readyBtn.classList.remove('shop-ready-active');

  const newBtn = readyBtn.cloneNode(true) as HTMLButtonElement;
  readyBtn.parentNode!.replaceChild(newBtn, readyBtn);
  newBtn.addEventListener('click', () => {
    sendMessage({ type: 'shop-ready' });
    newBtn.disabled = true;
    newBtn.textContent = 'WAITING...';
    newBtn.classList.add('shop-ready-active');
  });

  shopEndTime = Date.now() + msg.duration;
  const fill = document.getElementById('shop-timer-fill')!;
  fill.style.width = '100%';
  animateTimer();

  dom.shopScreen.classList.remove('hidden');
}

function animateTimer(): void {
  if (shopTimerRaf) cancelAnimationFrame(shopTimerRaf);
  const fill = document.getElementById('shop-timer-fill');
  if (!fill) return;

  const duration = Math.max(0, shopEndTime - Date.now());
  fill.style.transition = 'none';
  fill.style.width = '100%';
  requestAnimationFrame(() => {
    fill.style.transition = 'width ' + duration + 'ms linear';
    fill.style.width = '0%';
  });
}

export function handleShopBuyResult(msg: Record<string, any>): void {
  if (msg.playerId === clientState.myId && msg.itemId === 'bigger-cursor') {
    if (dom.arena) dom.arena.classList.add('cursor-enlarged');
  }

  if (msg.playerId === clientState.myId && msg.itemId !== 'healing-patch') {
    activeBuffs.push({ itemId: msg.itemId, icon: msg.itemIcon, name: msg.itemName });
    renderBuffHud();
  }

  if (msg.playerId === clientState.myId) {
    clientState.shopPlayerScore = msg.playerScore;
    const scoreEl = document.getElementById('shop-player-score');
    if (scoreEl) scoreEl.textContent = String(msg.playerScore);

    const card = document.querySelector<HTMLElement>('.shop-item-card[data-item-id="' + msg.itemId + '"]');
    if (card) {
      card.classList.add('shop-item-bought');
      const btn = card.querySelector<HTMLButtonElement>('.shop-buy-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'BOUGHT';
      }
    }

    updateAffordability(msg.playerScore);
  }

  const feed = document.getElementById('shop-feed');
  if (feed) {
    const entry = document.createElement('div');
    entry.className = 'shop-feed-entry';
    const isMe = msg.playerId === clientState.myId;
    entry.innerHTML =
      '<span class="shop-feed-player" style="color:' + (msg.playerColor || 'var(--teal)') + '">' +
        escapeHtml(isMe ? 'You' : msg.playerName) +
      '</span> bought ' +
      '<span class="shop-feed-item">' + msg.itemIcon + ' ' + escapeHtml(msg.itemName) + '</span>';
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
  }
}

export function handleShopReady(msg: Record<string, any>): void {
  const feed = document.getElementById('shop-feed');
  if (feed && msg.playerId !== clientState.myId) {
    const player = clientState.players[msg.playerId];
    const name = player ? player.name : 'Someone';
    const entry = document.createElement('div');
    entry.className = 'shop-feed-entry shop-feed-ready';
    entry.textContent = name + ' is ready (' + msg.readyCount + '/' + msg.totalPlayers + ')';
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
  }
}

export function closeShop(): void {
  if (shopTimerRaf) {
    cancelAnimationFrame(shopTimerRaf);
    shopTimerRaf = null;
  }
  if (dom.shopScreen) dom.shopScreen.classList.add('hidden');
}

export function clearBuffs(): void {
  activeBuffs = [];
  renderBuffHud();
  if (dom.arena) dom.arena.classList.remove('cursor-enlarged');
}

export function clearAllShopState(): void {
  activeBuffs = [];
  renderBuffHud();
  if (dom.arena) dom.arena.classList.remove('cursor-enlarged');
}

function renderBuffHud(): void {
  const container = document.getElementById('hud-buffs');
  if (!container) return;

  if (activeBuffs.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = activeBuffs.map(b => {
    const svg = getItemSvg(b.itemId);
    const iconContent = svg
      ? '<span class="hud-buff-icon hud-buff-icon-svg">' + svg + '</span>'
      : '<span class="hud-buff-icon">' + b.icon + '</span>';
    return '<div class="hud-buff" title="' + escapeHtml(b.name) + '">' + iconContent + '</div>';
  }).join('');
}

function updateAffordability(score: number): void {
  const cards = document.querySelectorAll<HTMLElement>('.shop-item-card:not(.shop-item-bought)');
  for (const card of cards) {
    const btn = card.querySelector<HTMLButtonElement>('.shop-buy-btn');
    if (!btn) continue;
    const cost = parseInt(btn.textContent!);
    if (score < cost) {
      card.classList.add('cannot-afford');
      btn.disabled = true;
    } else {
      card.classList.remove('cannot-afford');
      btn.disabled = false;
    }
  }
}
