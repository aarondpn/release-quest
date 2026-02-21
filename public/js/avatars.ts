// ── Standard emoji icons (available to everyone) ──
export const STANDARD_ICONS: string[] = ['\u{1F431}', '\u{1F436}', '\u{1F430}', '\u{1F98A}', '\u{1F438}', '\u{1F427}', '\u{1F43C}', '\u{1F428}'];

// ── Premium pixel-art SVG avatars (members only) ──
// 32x32 pixel-art, neon-on-dark aesthetic, stored as data URIs

const S = 32; // grid size
function px(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">${svg}</svg>`
  );
}

export interface Avatar {
  name: string;
  svg: string;
  rarity?: string;
}

/** @deprecated Use Avatar instead */
export type PremiumAvatar = Avatar;
/** @deprecated Use Avatar instead */
export type ShopAvatar = Avatar;

export const PREMIUM_AVATARS: Record<string, Avatar> = {
  'av:knight': {
    name: 'Pixel Knight',
    svg: px(
      '<rect x="10" y="2" width="12" height="4" fill="#888"/>' +
      '<rect x="8" y="6" width="16" height="10" fill="#aaa"/>' +
      '<rect x="10" y="8" width="12" height="4" fill="#333"/>' +
      '<rect x="12" y="9" width="8" height="2" fill="#00e5ff"/>' +
      '<rect x="8" y="16" width="16" height="8" fill="#888"/>' +
      '<rect x="10" y="18" width="4" height="4" fill="#aaa"/>' +
      '<rect x="18" y="18" width="4" height="4" fill="#aaa"/>' +
      '<rect x="10" y="24" width="4" height="4" fill="#666"/>' +
      '<rect x="18" y="24" width="4" height="4" fill="#666"/>' +
      '<rect x="4" y="12" width="4" height="10" fill="#aaa"/>' +
      '<rect x="24" y="12" width="4" height="10" fill="#aaa"/>'
    ),
  },
  'av:ninja': {
    name: 'Shadow Ninja',
    svg: px(
      '<rect x="10" y="4" width="12" height="6" fill="#222"/>' +
      '<rect x="8" y="6" width="16" height="4" fill="#1a1a2e"/>' +
      '<rect x="10" y="7" width="4" height="2" fill="#ff1744"/>' +
      '<rect x="18" y="7" width="4" height="2" fill="#ff1744"/>' +
      '<rect x="6" y="4" width="4" height="2" fill="#333"/>' +
      '<rect x="22" y="4" width="4" height="2" fill="#333"/>' +
      '<rect x="10" y="10" width="12" height="8" fill="#222"/>' +
      '<rect x="8" y="12" width="4" height="6" fill="#1a1a2e"/>' +
      '<rect x="20" y="12" width="4" height="6" fill="#1a1a2e"/>' +
      '<rect x="10" y="18" width="5" height="6" fill="#222"/>' +
      '<rect x="17" y="18" width="5" height="6" fill="#222"/>' +
      '<rect x="10" y="24" width="5" height="4" fill="#1a1a2e"/>' +
      '<rect x="17" y="24" width="5" height="4" fill="#1a1a2e"/>'
    ),
  },
  'av:mage': {
    name: 'Glitch Mage',
    svg: px(
      '<rect x="12" y="0" width="8" height="2" fill="#a855f7"/>' +
      '<rect x="10" y="2" width="12" height="4" fill="#7c3aed"/>' +
      '<rect x="8" y="6" width="16" height="4" fill="#6d28d9"/>' +
      '<rect x="14" y="1" width="4" height="2" fill="#e0b0ff"/>' +
      '<rect x="10" y="10" width="12" height="6" fill="#f5deb3"/>' +
      '<rect x="12" y="11" width="3" height="2" fill="#a855f7"/>' +
      '<rect x="18" y="11" width="3" height="2" fill="#a855f7"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#6d28d9"/>' +
      '<rect x="8" y="18" width="4" height="6" fill="#7c3aed"/>' +
      '<rect x="20" y="18" width="4" height="6" fill="#7c3aed"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#4c1d95"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#4c1d95"/>' +
      '<rect x="6" y="3" width="2" height="2" fill="#e0b0ff" opacity="0.7"/>' +
      '<rect x="24" y="5" width="2" height="2" fill="#e0b0ff" opacity="0.5"/>' +
      '<rect x="4" y="8" width="2" height="2" fill="#c084fc" opacity="0.4"/>'
    ),
  },
};

export const PREMIUM_IDS: string[] = Object.keys(PREMIUM_AVATARS);


export function isPremium(icon: string | null | undefined): boolean {
  return typeof icon === 'string' && icon.startsWith('av:');
}

export function isShopAvatar(icon: string | null | undefined): boolean {
  return typeof icon === 'string' && icon.startsWith('shop:');
}

// ── Shop pixel-art SVG avatars (purchased with Byte Coins) ──

export const SHOP_AVATARS: Record<string, Avatar> = {
  'shop:cyborg': {
    name: 'Neon Cyborg',
    rarity: 'rare',
    svg: px(
      '<rect x="8" y="4" width="16" height="12" fill="#f5deb3"/>' +
      '<rect x="16" y="4" width="8" height="12" fill="#555"/>' +
      '<rect x="10" y="7" width="4" height="3" fill="#333"/>' +
      '<rect x="11" y="8" width="2" height="1" fill="#fff"/>' +
      '<rect x="18" y="7" width="4" height="3" fill="#111"/>' +
      '<rect x="19" y="8" width="2" height="1" fill="#00e676"/>' +
      '<rect x="24" y="6" width="2" height="2" fill="#00e676"/>' +
      '<rect x="20" y="4" width="2" height="2" fill="#00e676" opacity="0.6"/>' +
      '<rect x="22" y="10" width="2" height="4" fill="#00e676" opacity="0.4"/>' +
      '<rect x="12" y="12" width="8" height="2" fill="#c9a87c"/>' +
      '<rect x="10" y="16" width="12" height="8" fill="#555"/>' +
      '<rect x="12" y="18" width="2" height="2" fill="#00e676"/>' +
      '<rect x="16" y="20" width="2" height="2" fill="#00e676"/>' +
      '<rect x="10" y="24" width="5" height="4" fill="#444"/>' +
      '<rect x="17" y="24" width="5" height="4" fill="#444"/>'
    ),
  },
  'shop:phoenix_bird': {
    name: 'Pixel Phoenix',
    rarity: 'rare',
    svg: px(
      '<rect x="14" y="2" width="4" height="4" fill="#ff6d00"/>' +
      '<rect x="12" y="0" width="2" height="4" fill="#ffab00"/>' +
      '<rect x="18" y="0" width="2" height="4" fill="#ffab00"/>' +
      '<rect x="10" y="6" width="12" height="6" fill="#ff6d00"/>' +
      '<rect x="12" y="7" width="3" height="2" fill="#fff"/>' +
      '<rect x="18" y="7" width="3" height="2" fill="#fff"/>' +
      '<rect x="13" y="7" width="2" height="2" fill="#111"/>' +
      '<rect x="19" y="7" width="2" height="2" fill="#111"/>' +
      '<rect x="14" y="10" width="4" height="2" fill="#ffab00"/>' +
      '<rect x="8" y="12" width="16" height="6" fill="#ff6d00"/>' +
      '<rect x="4" y="10" width="6" height="4" fill="#ffab00"/>' +
      '<rect x="22" y="10" width="6" height="4" fill="#ffab00"/>' +
      '<rect x="2" y="8" width="4" height="4" fill="#ff9100"/>' +
      '<rect x="26" y="8" width="4" height="4" fill="#ff9100"/>' +
      '<rect x="10" y="18" width="12" height="4" fill="#ff6d00"/>' +
      '<rect x="12" y="22" width="3" height="4" fill="#ffab00"/>' +
      '<rect x="17" y="22" width="3" height="4" fill="#ffab00"/>' +
      '<rect x="14" y="26" width="4" height="4" fill="#ff9100" opacity="0.6"/>'
    ),
  },
  'shop:samurai': {
    name: 'Neon Samurai',
    rarity: 'rare',
    svg: px(
      '<rect x="6" y="4" width="20" height="4" fill="#444"/>' +
      '<rect x="8" y="2" width="16" height="4" fill="#555"/>' +
      '<rect x="14" y="0" width="4" height="2" fill="#00e5ff"/>' +
      '<rect x="8" y="8" width="16" height="8" fill="#333"/>' +
      '<rect x="10" y="9" width="4" height="3" fill="#00e5ff"/>' +
      '<rect x="18" y="9" width="4" height="3" fill="#00e5ff"/>' +
      '<rect x="12" y="13" width="8" height="2" fill="#222"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#444"/>' +
      '<rect x="8" y="18" width="4" height="6" fill="#555"/>' +
      '<rect x="20" y="18" width="4" height="6" fill="#555"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#333"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#333"/>' +
      '<rect x="6" y="6" width="2" height="2" fill="#00e5ff" opacity="0.5"/>' +
      '<rect x="24" y="6" width="2" height="2" fill="#00e5ff" opacity="0.5"/>'
    ),
  },
  'shop:reaper': {
    name: 'Code Reaper',
    rarity: 'epic',
    svg: px(
      '<rect x="8" y="2" width="16" height="6" fill="#2d1b30"/>' +
      '<rect x="6" y="4" width="4" height="8" fill="#2d1b30"/>' +
      '<rect x="22" y="4" width="4" height="8" fill="#2d1b30"/>' +
      '<rect x="10" y="8" width="12" height="8" fill="#1a1a2e"/>' +
      '<rect x="10" y="9" width="4" height="3" fill="#111"/>' +
      '<rect x="18" y="9" width="4" height="3" fill="#111"/>' +
      '<rect x="11" y="10" width="2" height="1" fill="#a855f7"/>' +
      '<rect x="19" y="10" width="2" height="1" fill="#a855f7"/>' +
      '<rect x="12" y="14" width="8" height="2" fill="#333"/>' +
      '<rect x="10" y="16" width="12" height="8" fill="#2d1b30"/>' +
      '<rect x="10" y="24" width="12" height="4" fill="#1a1a2e"/>' +
      '<rect x="4" y="10" width="4" height="2" fill="#a855f7" opacity="0.3"/>' +
      '<rect x="24" y="10" width="4" height="2" fill="#a855f7" opacity="0.3"/>' +
      '<rect x="14" y="0" width="4" height="2" fill="#a855f7" opacity="0.5"/>'
    ),
  },
  'shop:dragon': {
    name: 'Bit Dragon',
    rarity: 'epic',
    svg: px(
      '<rect x="6" y="4" width="6" height="4" fill="#388e3c"/>' +
      '<rect x="18" y="4" width="6" height="4" fill="#388e3c"/>' +
      '<rect x="8" y="2" width="4" height="2" fill="#2e7d32"/>' +
      '<rect x="20" y="2" width="4" height="2" fill="#2e7d32"/>' +
      '<rect x="8" y="8" width="16" height="8" fill="#43a047"/>' +
      '<rect x="10" y="9" width="4" height="3" fill="#ffab00"/>' +
      '<rect x="18" y="9" width="4" height="3" fill="#ffab00"/>' +
      '<rect x="11" y="10" width="2" height="1" fill="#111"/>' +
      '<rect x="19" y="10" width="2" height="1" fill="#111"/>' +
      '<rect x="12" y="14" width="8" height="2" fill="#2e7d32"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#388e3c"/>' +
      '<rect x="0" y="12" width="8" height="4" fill="#ff1744"/>' +
      '<rect x="0" y="10" width="4" height="2" fill="#ff5252"/>' +
      '<rect x="0" y="16" width="4" height="2" fill="#ff5252" opacity="0.5"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#2e7d32"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#2e7d32"/>'
    ),
  },
  'shop:robot': {
    name: 'Pixel Robot',
    rarity: 'common',
    svg: px(
      '<rect x="10" y="2" width="12" height="4" fill="#4ecdc4"/>' +
      '<rect x="8" y="6" width="16" height="10" fill="#3db8b0"/>' +
      '<rect x="10" y="8" width="4" height="3" fill="#111"/>' +
      '<rect x="18" y="8" width="4" height="3" fill="#111"/>' +
      '<rect x="11" y="9" width="2" height="1" fill="#00e5ff"/>' +
      '<rect x="19" y="9" width="2" height="1" fill="#00e5ff"/>' +
      '<rect x="13" y="13" width="6" height="2" fill="#222"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#3db8b0"/>' +
      '<rect x="6" y="10" width="4" height="6" fill="#4ecdc4"/>' +
      '<rect x="22" y="10" width="4" height="6" fill="#4ecdc4"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#2a9d8f"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#2a9d8f"/>'
    ),
  },
  'shop:alien': {
    name: 'Neon Alien',
    rarity: 'common',
    svg: px(
      '<rect x="10" y="2" width="12" height="8" fill="#76ff03"/>' +
      '<rect x="8" y="4" width="4" height="6" fill="#64dd17"/>' +
      '<rect x="20" y="4" width="4" height="6" fill="#64dd17"/>' +
      '<rect x="10" y="6" width="4" height="4" fill="#111"/>' +
      '<rect x="18" y="6" width="4" height="4" fill="#111"/>' +
      '<rect x="11" y="7" width="2" height="2" fill="#b2ff59"/>' +
      '<rect x="19" y="7" width="2" height="2" fill="#b2ff59"/>' +
      '<rect x="12" y="10" width="8" height="4" fill="#64dd17"/>' +
      '<rect x="14" y="12" width="4" height="2" fill="#333"/>' +
      '<rect x="10" y="14" width="12" height="6" fill="#76ff03"/>' +
      '<rect x="8" y="16" width="4" height="4" fill="#64dd17"/>' +
      '<rect x="20" y="16" width="4" height="4" fill="#64dd17"/>' +
      '<rect x="11" y="20" width="4" height="6" fill="#64dd17"/>' +
      '<rect x="17" y="20" width="4" height="6" fill="#64dd17"/>'
    ),
  },
  'shop:witch': {
    name: 'Glitch Witch',
    rarity: 'common',
    svg: px(
      '<rect x="14" y="0" width="4" height="2" fill="#9c27b0"/>' +
      '<rect x="12" y="2" width="8" height="2" fill="#7b1fa2"/>' +
      '<rect x="10" y="4" width="12" height="4" fill="#6a1b9a"/>' +
      '<rect x="8" y="8" width="16" height="8" fill="#f5deb3"/>' +
      '<rect x="10" y="10" width="4" height="3" fill="#333"/>' +
      '<rect x="18" y="10" width="4" height="3" fill="#333"/>' +
      '<rect x="11" y="11" width="2" height="1" fill="#e040fb"/>' +
      '<rect x="19" y="11" width="2" height="1" fill="#e040fb"/>' +
      '<rect x="13" y="14" width="6" height="1" fill="#9c27b0"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#6a1b9a"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#4a148c"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#4a148c"/>' +
      '<rect x="6" y="6" width="2" height="2" fill="#e040fb" opacity="0.5"/>' +
      '<rect x="24" y="4" width="2" height="2" fill="#e040fb" opacity="0.4"/>'
    ),
  },
  'shop:pirate': {
    name: 'Data Pirate',
    rarity: 'common',
    svg: px(
      '<rect x="8" y="4" width="16" height="4" fill="#5d4037"/>' +
      '<rect x="6" y="2" width="20" height="2" fill="#4e342e"/>' +
      '<rect x="14" y="0" width="4" height="2" fill="#ffe66d"/>' +
      '<rect x="8" y="8" width="16" height="8" fill="#f5deb3"/>' +
      '<rect x="10" y="10" width="4" height="3" fill="#111"/>' +
      '<rect x="18" y="10" width="4" height="3" fill="#111"/>' +
      '<rect x="11" y="11" width="2" height="1" fill="#fff"/>' +
      '<rect x="18" y="9" width="4" height="4" fill="#333"/>' +
      '<rect x="13" y="14" width="6" height="1" fill="#5d4037"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#8d6e63"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#5d4037"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#5d4037"/>'
    ),
  },
  'shop:astronaut': {
    name: 'Space Dev',
    rarity: 'rare',
    svg: px(
      '<rect x="10" y="2" width="12" height="12" fill="#e0e0e0"/>' +
      '<rect x="12" y="4" width="8" height="8" fill="#263238"/>' +
      '<rect x="14" y="6" width="4" height="4" fill="#42a5f5"/>' +
      '<rect x="12" y="5" width="2" height="2" fill="#e8f5e9" opacity="0.5"/>' +
      '<rect x="8" y="14" width="16" height="8" fill="#e0e0e0"/>' +
      '<rect x="6" y="16" width="4" height="6" fill="#bdbdbd"/>' +
      '<rect x="22" y="16" width="4" height="6" fill="#bdbdbd"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#9e9e9e"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#9e9e9e"/>' +
      '<rect x="14" y="15" width="4" height="2" fill="#42a5f5"/>'
    ),
  },
  'shop:vampire': {
    name: 'Byte Vampire',
    rarity: 'rare',
    svg: px(
      '<rect x="10" y="4" width="12" height="4" fill="#1a1a2e"/>' +
      '<rect x="8" y="8" width="16" height="8" fill="#e0e0e0"/>' +
      '<rect x="10" y="10" width="4" height="3" fill="#111"/>' +
      '<rect x="18" y="10" width="4" height="3" fill="#111"/>' +
      '<rect x="11" y="11" width="2" height="1" fill="#f44336"/>' +
      '<rect x="19" y="11" width="2" height="1" fill="#f44336"/>' +
      '<rect x="12" y="14" width="2" height="2" fill="#fff"/>' +
      '<rect x="18" y="14" width="2" height="2" fill="#fff"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#1a1a2e"/>' +
      '<rect x="6" y="8" width="4" height="8" fill="#b71c1c"/>' +
      '<rect x="22" y="8" width="4" height="8" fill="#b71c1c"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#0d0d1a"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#0d0d1a"/>'
    ),
  },
  'shop:demon': {
    name: 'Core Dump Demon',
    rarity: 'epic',
    svg: px(
      '<rect x="6" y="2" width="4" height="4" fill="#ff1744"/>' +
      '<rect x="22" y="2" width="4" height="4" fill="#ff1744"/>' +
      '<rect x="8" y="6" width="16" height="10" fill="#d32f2f"/>' +
      '<rect x="10" y="8" width="4" height="3" fill="#111"/>' +
      '<rect x="18" y="8" width="4" height="3" fill="#111"/>' +
      '<rect x="11" y="9" width="2" height="1" fill="#ffab00"/>' +
      '<rect x="19" y="9" width="2" height="1" fill="#ffab00"/>' +
      '<rect x="12" y="13" width="8" height="2" fill="#b71c1c"/>' +
      '<rect x="14" y="13" width="4" height="2" fill="#333"/>' +
      '<rect x="10" y="16" width="12" height="6" fill="#c62828"/>' +
      '<rect x="10" y="22" width="5" height="4" fill="#b71c1c"/>' +
      '<rect x="17" y="22" width="5" height="4" fill="#b71c1c"/>' +
      '<rect x="4" y="4" width="2" height="2" fill="#ff1744" opacity="0.6"/>' +
      '<rect x="26" y="4" width="2" height="2" fill="#ff1744" opacity="0.6"/>'
    ),
  },
  'shop:angel': {
    name: 'Refactor Angel',
    rarity: 'epic',
    svg: px(
      '<rect x="14" y="0" width="4" height="2" fill="#fff9c4"/>' +
      '<rect x="12" y="2" width="8" height="2" fill="#fff176"/>' +
      '<rect x="10" y="4" width="12" height="8" fill="#f5deb3"/>' +
      '<rect x="12" y="6" width="3" height="2" fill="#42a5f5"/>' +
      '<rect x="19" y="6" width="3" height="2" fill="#42a5f5"/>' +
      '<rect x="14" y="10" width="4" height="1" fill="#e0a080"/>' +
      '<rect x="10" y="12" width="12" height="6" fill="#e3f2fd"/>' +
      '<rect x="4" y="8" width="6" height="4" fill="#e3f2fd"/>' +
      '<rect x="22" y="8" width="6" height="4" fill="#e3f2fd"/>' +
      '<rect x="2" y="6" width="4" height="4" fill="#bbdefb"/>' +
      '<rect x="26" y="6" width="4" height="4" fill="#bbdefb"/>' +
      '<rect x="10" y="18" width="5" height="6" fill="#e3f2fd"/>' +
      '<rect x="17" y="18" width="5" height="6" fill="#e3f2fd"/>' +
      '<rect x="6" y="6" width="2" height="2" fill="#fff9c4" opacity="0.5"/>' +
      '<rect x="24" y="6" width="2" height="2" fill="#fff9c4" opacity="0.5"/>'
    ),
  },
  'shop:kraken': {
    name: 'Dependency Kraken',
    rarity: 'epic',
    svg: px(
      '<rect x="8" y="4" width="16" height="10" fill="#1565c0"/>' +
      '<rect x="10" y="6" width="4" height="4" fill="#111"/>' +
      '<rect x="18" y="6" width="4" height="4" fill="#111"/>' +
      '<rect x="11" y="7" width="2" height="2" fill="#ff6d00"/>' +
      '<rect x="19" y="7" width="2" height="2" fill="#ff6d00"/>' +
      '<rect x="12" y="12" width="8" height="2" fill="#0d47a1"/>' +
      '<rect x="6" y="14" width="4" height="8" fill="#1565c0"/>' +
      '<rect x="10" y="14" width="4" height="8" fill="#1976d2"/>' +
      '<rect x="14" y="14" width="4" height="8" fill="#1565c0"/>' +
      '<rect x="18" y="14" width="4" height="8" fill="#1976d2"/>' +
      '<rect x="22" y="14" width="4" height="8" fill="#1565c0"/>' +
      '<rect x="4" y="20" width="4" height="4" fill="#1565c0"/>' +
      '<rect x="24" y="20" width="4" height="4" fill="#1565c0"/>' +
      '<rect x="8" y="22" width="4" height="4" fill="#1976d2"/>' +
      '<rect x="20" y="22" width="4" height="4" fill="#1976d2"/>'
    ),
  },
  'shop:phoenix_gold': {
    name: 'Golden Phoenix',
    rarity: 'epic',
    svg: px(
      '<rect x="14" y="0" width="4" height="4" fill="#ffd700"/>' +
      '<rect x="12" y="0" width="2" height="4" fill="#ffab00"/>' +
      '<rect x="18" y="0" width="2" height="4" fill="#ffab00"/>' +
      '<rect x="10" y="4" width="12" height="6" fill="#ffd700"/>' +
      '<rect x="12" y="5" width="3" height="2" fill="#fff"/>' +
      '<rect x="18" y="5" width="3" height="2" fill="#fff"/>' +
      '<rect x="13" y="5" width="2" height="2" fill="#111"/>' +
      '<rect x="19" y="5" width="2" height="2" fill="#111"/>' +
      '<rect x="14" y="8" width="4" height="2" fill="#ffab00"/>' +
      '<rect x="8" y="10" width="16" height="6" fill="#ffd700"/>' +
      '<rect x="4" y="8" width="6" height="4" fill="#ffab00"/>' +
      '<rect x="22" y="8" width="6" height="4" fill="#ffab00"/>' +
      '<rect x="2" y="6" width="4" height="4" fill="#ff9100"/>' +
      '<rect x="26" y="6" width="4" height="4" fill="#ff9100"/>' +
      '<rect x="10" y="16" width="12" height="4" fill="#ffd700"/>' +
      '<rect x="12" y="20" width="3" height="4" fill="#ffab00"/>' +
      '<rect x="17" y="20" width="3" height="4" fill="#ffab00"/>' +
      '<rect x="14" y="24" width="4" height="4" fill="#ff9100" opacity="0.6"/>'
    ),
  },
};

export const SHOP_IDS: string[] = Object.keys(SHOP_AVATARS);

// Shared Byte Coin SVG markup (small inline variant)
export const COIN_SVG_SMALL = '<svg class="byte-coin-svg" width="8" height="8" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="1" fill="#ffe66d"/><rect x="3" y="2" width="1" height="12" fill="#ffe66d"/><rect x="12" y="2" width="1" height="12" fill="#ffe66d"/><rect x="6" y="3" width="4" height="2" fill="#ffd700"/><rect x="6" y="7" width="4" height="2" fill="#ffd700"/><rect x="6" y="11" width="4" height="2" fill="#ffd700"/></svg>';

export const COIN_SVG = '<svg class="byte-coin-svg" width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="1" fill="#ffe66d"/><rect x="3" y="2" width="1" height="12" fill="#ffe66d"/><rect x="12" y="2" width="1" height="12" fill="#ffe66d"/><rect x="6" y="3" width="4" height="2" fill="#ffd700"/><rect x="6" y="7" width="4" height="2" fill="#ffd700"/><rect x="6" y="11" width="4" height="2" fill="#ffd700"/><rect x="5" y="1" width="6" height="1" fill="#fff8c4" opacity="0.6"/></svg>';

/**
 * Return safe HTML for an icon (emoji, premium, or shop SVG).
 * @param icon - emoji character, premium ID "av:knight", or shop ID "shop:robot"
 * @param sizePx - rendered size in CSS pixels
 */
/**
 * Build icon picker content (standard, premium, shop sections) into the given container.
 * Returns the resolved selected icon (reset to default if selected shop avatar is unowned).
 */
export function buildIconPickerContent(
  container: HTMLElement,
  current: string | null,
  owned: ReadonlySet<string>,
  getPrice: (id: string) => number | null | string,
  onSelect: (id: string) => void,
): string | null {
  // Standard section
  const stdLabel = document.createElement('div');
  stdLabel.className = 'icon-picker-label';
  stdLabel.textContent = 'PICK YOUR HUNTER';
  container.appendChild(stdLabel);

  STANDARD_ICONS.forEach(icon => {
    const el = document.createElement('div');
    el.className = 'icon-option' + (current === icon ? ' selected' : '');
    el.dataset.icon = icon;
    el.textContent = icon;
    el.addEventListener('click', () => {
      container.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      onSelect(icon);
    });
    container.appendChild(el);
  });

  // Premium section
  const premLabel = document.createElement('div');
  premLabel.className = 'icon-picker-label icon-picker-premium-label';
  premLabel.textContent = 'MEMBERS ONLY';
  container.appendChild(premLabel);

  PREMIUM_IDS.forEach(id => {
    const av = PREMIUM_AVATARS[id];
    const el = document.createElement('div');
    el.className = 'icon-option icon-option-premium' + (current === id ? ' selected' : '');
    el.dataset.icon = id;
    el.innerHTML = '<img src="' + av.svg + '" width="28" height="28" alt="' + av.name + '" style="image-rendering:pixelated">';
    el.addEventListener('click', () => {
      container.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      onSelect(id);
    });
    container.appendChild(el);
  });

  // Shop section
  if (SHOP_IDS.length > 0) {
    const shopLabel = document.createElement('div');
    shopLabel.className = 'icon-picker-label icon-picker-shop-label';
    shopLabel.innerHTML = COIN_SVG + ' SHOP EXCLUSIVES';
    container.appendChild(shopLabel);

    SHOP_IDS.forEach(id => {
      const av = SHOP_AVATARS[id];
      const isOwned = owned.has(id);
      const el = document.createElement('div');
      el.className = 'icon-option icon-option-shop icon-option-rarity-' + (av.rarity || '') +
        (current === id ? ' selected' : '') +
        (!isOwned ? ' locked' : '');
      el.dataset.icon = id;
      el.innerHTML = '<img src="' + av.svg + '" width="28" height="28" alt="' + av.name + '" style="image-rendering:pixelated">';
      if (!isOwned) {
        const lock = document.createElement('div');
        lock.className = 'icon-lock-overlay icon-lock-coin';
        lock.innerHTML = COIN_SVG_SMALL + (getPrice(id) ?? '?');
        el.appendChild(lock);
      }
      el.addEventListener('click', () => {
        if (!isOwned) {
          el.classList.add('locked-shake');
          el.addEventListener('animationend', () => el.classList.remove('locked-shake'), { once: true });
          return;
        }
        container.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        onSelect(id);
      });
      container.appendChild(el);
    });
  }

  // If selected icon is a shop avatar the user doesn't own, reset
  if (isShopAvatar(current) && !owned.has(current!)) {
    const fallback = STANDARD_ICONS[0];
    const first = container.querySelector<HTMLElement>('.icon-option[data-icon="' + fallback + '"]');
    if (first) first.classList.add('selected');
    return fallback;
  }
  return current;
}

export function renderIcon(icon: string, sizePx: number): string {
  const av = isPremium(icon) ? PREMIUM_AVATARS[icon]
    : isShopAvatar(icon) ? SHOP_AVATARS[icon]
    : null;
  if (av) {
    const cls = 'avatar-icon' + (isPremium(icon) ? ' avatar-premium' : ' avatar-shop') +
      (av.rarity ? ' avatar-rarity-' + av.rarity : '');
    return '<img class="' + cls + '" src="' + av.svg +
      '" width="' + sizePx + '" height="' + sizePx +
      '" alt="' + av.name + '" style="vertical-align:middle;image-rendering:pixelated">';
  }
  if (isPremium(icon) || isShopAvatar(icon)) {
    return '<span class="avatar-icon" style="font-size:' + sizePx + 'px;line-height:1;vertical-align:middle">?</span>';
  }
  // Standard emoji — use textContent trick for safe HTML
  const d = document.createElement('span');
  d.textContent = icon || '';
  return '<span class="avatar-icon" style="font-size:' + sizePx + 'px;line-height:1;vertical-align:middle">' + d.innerHTML + '</span>';
}
