// ── Standard emoji icons (available to everyone) ──
export const STANDARD_ICONS = ['\u{1F431}', '\u{1F436}', '\u{1F430}', '\u{1F98A}', '\u{1F438}', '\u{1F427}', '\u{1F43C}', '\u{1F428}'];

// ── Premium pixel-art SVG avatars (members only) ──
// 32x32 pixel-art, neon-on-dark aesthetic, stored as data URIs

const S = 32; // grid size
function px(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">${svg}</svg>`
  );
}

export const PREMIUM_AVATARS = {
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
  'av:cyborg': {
    name: 'Neon Cyborg',
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
  'av:phoenix': {
    name: 'Pixel Phoenix',
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
  'av:samurai': {
    name: 'Neon Samurai',
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
  'av:reaper': {
    name: 'Code Reaper',
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
  'av:dragon': {
    name: 'Bit Dragon',
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
};

export const PREMIUM_IDS = Object.keys(PREMIUM_AVATARS);

export function isPremium(icon) {
  return typeof icon === 'string' && icon.startsWith('av:');
}

/**
 * Return safe HTML for an icon (emoji or premium SVG).
 * @param {string} icon - emoji character or premium ID like "av:knight"
 * @param {number} sizePx - rendered size in CSS pixels
 * @returns {string} HTML string
 */
export function renderIcon(icon, sizePx) {
  if (isPremium(icon)) {
    const av = PREMIUM_AVATARS[icon];
    if (av) {
      return '<img class="avatar-icon avatar-premium" src="' + av.svg +
        '" width="' + sizePx + '" height="' + sizePx +
        '" alt="' + av.name + '" style="vertical-align:middle;image-rendering:pixelated">';
    }
    // Unknown premium ID — fall back to generic
    return '<span class="avatar-icon" style="font-size:' + sizePx + 'px;line-height:1;vertical-align:middle">?</span>';
  }
  // Standard emoji — use textContent trick for safe HTML
  const d = document.createElement('span');
  d.textContent = icon || '';
  return '<span class="avatar-icon" style="font-size:' + sizePx + 'px;line-height:1;vertical-align:middle">' + d.innerHTML + '</span>';
}
