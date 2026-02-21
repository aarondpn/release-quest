import type { MessageHandler } from './types.ts';
import { COSMETIC_SHOP_MAP, PERMANENT_SHOP_ITEMS, getWeeklyRotation } from '../config.ts';
import * as network from '../network.ts';
import * as db from '../db.ts';

export const handleGetShopCatalog: MessageHandler = async ({ ws, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  const rotation = getWeeklyRotation();
  if (!info?.userId) {
    network.send(ws, {
      type: 'shop-catalog',
      permanentItems: PERMANENT_SHOP_ITEMS,
      rotatingItems: rotation.items,
      rotationEndUtc: rotation.rotationEndUtc,
      owned: [],
      balance: 0,
      isGuest: true,
      isNewRotation: false,
    });
    return;
  }
  const userId = info.userId;
  try {
    const [inventory, { balance }, dbSeenRotation] = await Promise.all([
      db.getUserInventory(userId),
      db.getCurrencyBalance(userId),
      db.getShopSeenRotation(userId),
    ]);
    // Prefer in-memory value (set by handleShopSeen) over DB to avoid race conditions
    const seenRotation = info.shopSeenRotation ?? dbSeenRotation;
    const owned = inventory.map(i => i.item_id);
    network.send(ws, {
      type: 'shop-catalog',
      permanentItems: PERMANENT_SHOP_ITEMS,
      rotatingItems: rotation.items,
      rotationEndUtc: rotation.rotationEndUtc,
      owned,
      balance,
      isGuest: false,
      isNewRotation: seenRotation !== rotation.rotationEndUtc,
    });
  } catch {
    network.send(ws, {
      type: 'shop-catalog',
      permanentItems: PERMANENT_SHOP_ITEMS,
      rotatingItems: rotation.items,
      rotationEndUtc: rotation.rotationEndUtc,
      owned: [],
      balance: 0,
      isGuest: false,
      isNewRotation: true,
    });
  }
};

export const handleShopSeen: MessageHandler = async ({ pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) return;
  const rotation = getWeeklyRotation();
  // Set in-memory immediately so subsequent catalog requests see it
  info.shopSeenRotation = rotation.rotationEndUtc;
  await db.setShopSeenRotation(info.userId, rotation.rotationEndUtc);
};

export const handleShopPurchase: MessageHandler = ({ ws, msg, pid, playerInfo }) => {
  const info = playerInfo.get(pid);
  if (!info?.userId) {
    network.send(ws, { type: 'shop-purchase-result', success: false, error: 'Not logged in' });
    return;
  }
  const itemId = String(msg.itemId || '');
  const item = COSMETIC_SHOP_MAP.get(itemId);
  if (!item) {
    network.send(ws, { type: 'shop-purchase-result', success: false, error: 'Item not found' });
    return;
  }
  // Verify item is currently available (permanent or in this week's rotation)
  const isPermanent = PERMANENT_SHOP_ITEMS.some(i => i.id === itemId);
  if (!isPermanent) {
    const rotation = getWeeklyRotation();
    const inRotation = rotation.items.some(i => i.id === itemId);
    if (!inRotation) {
      network.send(ws, { type: 'shop-purchase-result', success: false, error: 'Item not currently available' });
      return;
    }
  }
  db.purchaseItem(info.userId, itemId, item.category, item.price).then(result => {
    if (!result.success) {
      network.send(ws, { type: 'shop-purchase-result', success: false, error: result.error });
      return;
    }
    network.send(ws, {
      type: 'shop-purchase-result',
      success: true,
      itemId,
      newBalance: result.newBalance,
    });
  }).catch(() => {
    network.send(ws, { type: 'shop-purchase-result', success: false, error: 'Purchase failed' });
  });
};
