import { dom, clientState } from './state.ts';
import { SHOP_AVATARS, renderIcon, COIN_SVG } from './avatars.ts';
import type { SendMessageFn } from './client-types.ts';

interface ShopCatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: string;
}

let _sendMessage: SendMessageFn | null = null;
let _permanentItems: ShopCatalogItem[] = [];
let _rotatingItems: ShopCatalogItem[] = [];
let _rotationEndUtc: string | null = null;
let _ownedItems: Set<string> = new Set();
let _shopBalance = 0;
let _rotationTimerId: ReturnType<typeof setInterval> | null = null;
let _isNewRotation = false;

export function initShopSend(fn: SendMessageFn): void { _sendMessage = fn; }

export function requestShopCatalog(): void {
  if (_sendMessage) _sendMessage({ type: 'get-shop-catalog' });
}

export function handleShopCatalog(msg: Record<string, unknown>): void {
  // Support new split format and backward-compat flat catalog
  if (msg.permanentItems) {
    _permanentItems = msg.permanentItems as ShopCatalogItem[];
    _rotatingItems = (msg.rotatingItems || []) as ShopCatalogItem[];
    _rotationEndUtc = (msg.rotationEndUtc as string) || null;
  } else {
    _permanentItems = (msg.catalog || []) as ShopCatalogItem[];
    _rotatingItems = [];
    _rotationEndUtc = null;
  }
  _ownedItems = new Set((msg.owned || []) as string[]);
  _shopBalance = (msg.balance as number) ?? 0;
  // Only show badge if server says new AND shop is not currently open
  const shopVisible = dom.shopPanel && !dom.shopPanel.classList.contains('hidden');
  if (!shopVisible) _isNewRotation = !!msg.isNewRotation;
  if (dom.shopBalanceAmount) dom.shopBalanceAmount.textContent = _shopBalance.toLocaleString();
  renderShopGrid();
  startRotationTimer();
  updateShopNewBadge();
}

export function handleShopPurchaseResult(msg: Record<string, unknown>): void {
  if (msg.success) {
    _ownedItems.add(msg.itemId as string);
    _shopBalance = msg.newBalance as number;
    if (dom.shopBalanceAmount) dom.shopBalanceAmount.textContent = _shopBalance.toLocaleString();
    // Update global balance
    clientState.byteCoinsBalance = msg.newBalance as number;
    const qtBal = document.getElementById('qt-balance');
    if (qtBal) qtBal.textContent = (msg.newBalance as number).toLocaleString();
    const profBal = document.getElementById('profile-coin-balance');
    if (profBal) profBal.textContent = (msg.newBalance as number).toLocaleString();
    renderShopGrid();
    showPurchaseToast(msg.itemId as string);
  } else {
    showPurchaseError((msg.error as string) || 'Purchase failed');
  }
}

function showPurchaseToast(itemId: string): void {
  const allItems = [..._permanentItems, ..._rotatingItems];
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  const av = SHOP_AVATARS[itemId];
  const toast = document.createElement('div');
  toast.className = 'quest-toast shop-purchase-toast';
  toast.innerHTML =
    '<span class="quest-toast-icon">' + (av ? renderIcon(itemId, 20) : '') + '</span>' +
    '<span class="quest-toast-text">PURCHASED!</span>' +
    '<span class="quest-toast-reward">' + escapeHtml(item.name) + '</span>';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('quest-toast-show'));
  setTimeout(() => {
    toast.classList.add('quest-toast-hide');
    toast.addEventListener('animationend', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2000);
  }, 3500);
}

function showPurchaseError(error: string): void {
  const toast = document.createElement('div');
  toast.className = 'quest-toast shop-error-toast';
  toast.innerHTML =
    '<span class="quest-toast-icon">&#x26A0;</span>' +
    '<span class="quest-toast-text">' + escapeHtml(error) + '</span>';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('quest-toast-show'));
  setTimeout(() => {
    toast.classList.add('quest-toast-hide');
    toast.addEventListener('animationend', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2000);
  }, 3000);
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderItemCard(item: ShopCatalogItem, isGuest: boolean): string {
  const owned = _ownedItems.has(item.id);
  const canAfford = _shopBalance >= item.price;
  const av = SHOP_AVATARS[item.id];
  const iconHtml = av ? renderIcon(item.id, 40) : '';
  const safeId = escapeHtml(item.id);
  const safeRarity = escapeHtml(item.rarity);

  let actionHtml: string;
  if (isGuest) {
    actionHtml = '<span class="shop-login-badge">LOG IN</span>';
  } else if (owned) {
    actionHtml = '<span class="shop-owned-badge">OWNED</span>';
  } else {
    actionHtml = '<button class="btn btn-small shop-buy-btn' + (canAfford ? '' : ' shop-buy-disabled') + '" data-item-id="' + safeId + '">' +
      item.price + ' ' + COIN_SVG + '</button>';
  }

  return '<div class="shop-item-card shop-rarity-' + safeRarity + (owned ? ' shop-item-owned' : '') + '" data-item-id="' + safeId + '">' +
    '<div class="shop-item-preview">' + iconHtml + '</div>' +
    '<div class="shop-item-info">' +
      '<div class="shop-item-name">' + escapeHtml(item.name) + '</div>' +
      '<div class="shop-item-desc">' + escapeHtml(item.description) + '</div>' +
      '<div class="shop-item-rarity shop-rarity-tag-' + safeRarity + '">' + safeRarity.toUpperCase() + '</div>' +
    '</div>' +
    '<div class="shop-item-action">' + actionHtml + '</div>' +
  '</div>';
}

function formatCountdown(endUtc: string): string | null {
  const diff = new Date(endUtc).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return days + 'd ' + hours + 'h';
  if (hours > 0) return hours + 'h ' + mins + 'm';
  return mins + 'm';
}

function renderShopGrid(): void {
  if (!dom.shopGrid) return;

  const isGuest = !clientState.isLoggedIn;
  if (dom.shopGuestLock) dom.shopGuestLock.classList.add('hidden');
  // Hide balance for guests
  const balanceEl = document.querySelector('.shop-cosmetic-balance') as HTMLElement | null;
  if (balanceEl) balanceEl.style.display = isGuest ? 'none' : '';

  if (_permanentItems.length === 0 && _rotatingItems.length === 0) {
    dom.shopGrid.innerHTML = '<div class="shop-empty">Loading shop...</div>';
    return;
  }

  const cardRenderer = (item: ShopCatalogItem) => renderItemCard(item, isGuest);
  let html = '';

  // Guest banner
  if (isGuest) {
    html += '<div class="shop-guest-banner">LOG IN TO PURCHASE AVATARS</div>';
  }

  // Permanent section
  if (_permanentItems.length > 0) {
    html += '<div class="shop-section-header">ALWAYS AVAILABLE</div>';
    html += '<div class="shop-section-grid">';
    html += _permanentItems.map(cardRenderer).join('');
    html += '</div>';
  }

  // Rotating section
  if (_rotatingItems.length > 0) {
    const timerText = _rotationEndUtc ? formatCountdown(_rotationEndUtc) : null;
    html += '<div class="shop-section-header shop-rotation-header">' +
      '<span>WEEKLY ROTATION</span>' +
      (timerText ? '<span class="shop-rotation-timer">' + timerText + '</span>' : '') +
    '</div>';
    html += '<div class="shop-section-grid">';
    html += _rotatingItems.map(cardRenderer).join('');
    html += '</div>';
  }

  dom.shopGrid.innerHTML = html;

  // Attach buy handlers
  dom.shopGrid.querySelectorAll<HTMLElement>('.shop-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.itemId;
      if (btn.classList.contains('shop-buy-disabled')) {
        btn.classList.add('locked-shake');
        btn.addEventListener('animationend', () => btn.classList.remove('locked-shake'), { once: true });
        return;
      }
      if (_sendMessage) _sendMessage({ type: 'shop-purchase', itemId: id });
    });
  });
}

function startRotationTimer(): void {
  stopRotationTimer();
  if (!_rotationEndUtc) return;
  updateRotationTimerDisplay();
  _rotationTimerId = setInterval(() => {
    updateRotationTimerDisplay();
  }, 60000);
}

function stopRotationTimer(): void {
  if (_rotationTimerId !== null) {
    clearInterval(_rotationTimerId);
    _rotationTimerId = null;
  }
}

function updateRotationTimerDisplay(): void {
  if (!_rotationEndUtc) return;
  const text = formatCountdown(_rotationEndUtc);
  if (!text) {
    // Rotation expired — refresh catalog
    stopRotationTimer();
    requestShopCatalog();
    return;
  }
  const el = document.querySelector('.shop-rotation-timer');
  if (el) el.textContent = text;
}

function updateShopNewBadge(): void {
  if (!dom.shopTab) return;
  const badge = dom.shopTab.querySelector('.shop-new-badge');
  if (_isNewRotation) {
    if (!badge) {
      const el = document.createElement('span');
      el.className = 'shop-new-badge';
      el.textContent = 'NEW';
      dom.shopTab.appendChild(el);
    }
  } else {
    if (badge) badge.remove();
  }
}

function markShopSeen(): void {
  if (!_isNewRotation) return;
  _isNewRotation = false;
  updateShopNewBadge();
  if (_sendMessage) _sendMessage({ type: 'shop-seen' });
}

export function showShopTab(): void {
  // Hide all other panels
  if (dom.lobbyListPanel) dom.lobbyListPanel.classList.add('hidden');
  if (dom.leaderboardPanel) dom.leaderboardPanel.classList.add('hidden');
  if (dom.replaysPanel) dom.replaysPanel.classList.add('hidden');
  if (dom.statsCardPanel) dom.statsCardPanel.classList.add('hidden');
  if (dom.shopPanel) dom.shopPanel.classList.remove('hidden');
  // Deactivate all other tabs
  if (dom.lobbiesTab) dom.lobbiesTab.classList.remove('active');
  if (dom.leaderboardTab) dom.leaderboardTab.classList.remove('active');
  if (dom.replaysTab) dom.replaysTab.classList.remove('active');
  if (dom.statsCardTab) dom.statsCardTab.classList.remove('active');
  if (dom.shopTab) dom.shopTab.classList.add('active');
  markShopSeen();
  requestShopCatalog();
}

export function hideShopPanel(): void {
  if (dom.shopPanel) dom.shopPanel.classList.add('hidden');
  if (dom.shopTab) dom.shopTab.classList.remove('active');
  stopRotationTimer();
}

export function getOwnedShopItems(): Set<string> {
  return new Set(_ownedItems);
}

export function getShopItemPrice(itemId: string): number | null {
  const allItems = [..._permanentItems, ..._rotatingItems];
  const item = allItems.find(i => i.id === itemId);
  return item ? item.price : null;
}
