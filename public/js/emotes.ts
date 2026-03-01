import { EMOTE_CATALOG, EMOTE_MAP } from '../../shared/emotes.ts';
import { logicalToPixel } from './coordinates.ts';
import { dom } from './state.ts';
import type { SendMessageFn } from './client-types.ts';

const BINDINGS_STORAGE_KEY = 'release-quest-emote-bindings';
const BINDING_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

let _sendMessage: SendMessageFn | null = null;

// Cached bindings — invalidated on set/reset
let _cachedBindings: Map<string, string> | null = null;

export function getDefaultBindings(): Map<string, string> {
  const map = new Map<string, string>();
  for (const emote of EMOTE_CATALOG) {
    if (BINDING_KEYS.includes(emote.key)) {
      map.set(emote.key, emote.id);
    }
  }
  return map;
}

export function getEmoteBindings(): Map<string, string> {
  if (_cachedBindings) return _cachedBindings;
  try {
    const raw = localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (raw) {
      const defaults = getDefaultBindings();
      const obj: Record<string, string> = JSON.parse(raw);
      const map = new Map<string, string>();
      for (const key of BINDING_KEYS) {
        if (obj[key] && EMOTE_MAP.has(obj[key])) {
          map.set(key, obj[key]);
        } else if (defaults.has(key)) {
          map.set(key, defaults.get(key)!);
        }
      }
      if (map.size > 0) {
        _cachedBindings = map;
        return map;
      }
    }
  } catch { /* ignore */ }
  const defaults = getDefaultBindings();
  _cachedBindings = defaults;
  return defaults;
}

export function setEmoteBinding(key: string, emoteId: string): void {
  const bindings = getEmoteBindings();
  // If emote is already on another key, swap
  for (const [k, v] of bindings) {
    if (v === emoteId && k !== key) {
      const displaced = bindings.get(key);
      if (displaced) {
        bindings.set(k, displaced);
      } else {
        bindings.delete(k);
      }
      break;
    }
  }
  bindings.set(key, emoteId);
  _saveBindings(bindings);
}

export function resetEmoteBindings(): void {
  localStorage.removeItem(BINDINGS_STORAGE_KEY);
  _cachedBindings = null;
}

function _saveBindings(bindings: Map<string, string>): void {
  const obj: Record<string, string> = {};
  for (const [k, v] of bindings) obj[k] = v;
  localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(obj));
  _cachedBindings = bindings;
}

// ── Animated SVG emotes ──
// Each SVG uses SMIL <animate> for self-contained looping micro-animations.
// Designed at 56px for the neon arcade aesthetic.

const EMOTE_SVGS: Record<string, string> = {

  // GG — Victory crown with pulsing golden glow & sparkle rays
  'emote:gg': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="gg-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#gg-glow)">
      <polygon points="28,6 34,18 22,18" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
      <polygon points="12,22 20,14 20,22" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
      <polygon points="44,22 36,14 36,22" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
      <rect x="10" y="22" width="36" height="14" rx="2" fill="#f59e0b" stroke="#d97706" stroke-width="1.2"/>
      <rect x="10" y="36" width="36" height="6" rx="1" fill="#d97706" stroke="#b45309" stroke-width="0.8"/>
      <circle cx="20" cy="29" r="2.5" fill="#fef3c7">
        <animate attributeName="opacity" values="1;0.4;1" dur="0.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="28" cy="29" r="2.5" fill="#fef3c7">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="0.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="36" cy="29" r="2.5" fill="#fef3c7">
        <animate attributeName="opacity" values="1;0.4;1" dur="0.8s" repeatCount="indefinite" begin="0.4s"/>
      </circle>
    </g>
    <line x1="28" y1="1" x2="28" y2="5" stroke="#fef08a" stroke-width="1.5" stroke-linecap="round" opacity="0.8">
      <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite"/>
    </line>
    <line x1="8" y1="10" x2="11" y2="13" stroke="#fef08a" stroke-width="1.2" stroke-linecap="round" opacity="0.6">
      <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" begin="0.3s"/>
    </line>
    <line x1="48" y1="10" x2="45" y2="13" stroke="#fef08a" stroke-width="1.2" stroke-linecap="round" opacity="0.6">
      <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" begin="0.6s"/>
    </line>
    <line x1="4" y1="28" x2="8" y2="28" stroke="#fef08a" stroke-width="1" stroke-linecap="round" opacity="0.5">
      <animate attributeName="opacity" values="0;0.7;0" dur="1s" repeatCount="indefinite" begin="0.2s"/>
    </line>
    <line x1="48" y1="28" x2="52" y2="28" stroke="#fef08a" stroke-width="1" stroke-linecap="round" opacity="0.5">
      <animate attributeName="opacity" values="0;0.7;0" dur="1s" repeatCount="indefinite" begin="0.7s"/>
    </line>
  </svg>`,

  // Nice — Thumbs up with bouncy scaling
  'emote:nice': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="nice-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#nice-glow)">
      <g transform="translate(28,30)">
        <animateTransform attributeName="transform" type="translate" values="28,30;28,26;28,30" dur="0.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
        <path d="M-4,8 L-4,-2 Q-4,-8 2,-10 L4,-10 Q6,-10 6,-8 L6,-4 L12,-4 Q14,-4 14,-2 L12,8 Q12,10 10,10 L-2,10 Q-4,10 -4,8 Z" fill="#4ade80" stroke="#16a34a" stroke-width="1.5"/>
        <rect x="-12" y="-4" width="7" height="14" rx="1.5" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
        <circle cx="8" cy="-16" r="2" fill="#86efac" opacity="0">
          <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite"/>
          <animate attributeName="r" values="1;3;1" dur="0.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="-6" cy="-14" r="1.5" fill="#86efac" opacity="0">
          <animate attributeName="opacity" values="0;0.8;0" dur="0.6s" repeatCount="indefinite" begin="0.3s"/>
          <animate attributeName="r" values="0.5;2.5;0.5" dur="0.6s" repeatCount="indefinite" begin="0.3s"/>
        </circle>
      </g>
    </g>
  </svg>`,

  // LOL — Laughing face shaking with tears
  'emote:lol': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="lol-glow"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#lol-glow)">
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-3,28,28;3,28,28;-3,28,28" dur="0.15s" repeatCount="indefinite"/>
        <circle cx="28" cy="28" r="20" fill="#eab308" stroke="#ca8a04" stroke-width="1.5"/>
        <path d="M18,18 Q20,14 22,18" stroke="#92400e" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M34,18 Q36,14 38,18" stroke="#92400e" stroke-width="2" stroke-linecap="round" fill="none"/>
        <path d="M17,30 Q28,42 39,30" stroke="#92400e" stroke-width="2" stroke-linecap="round" fill="#fbbf24"/>
        <path d="M20,32 L20,35" stroke="#92400e" stroke-width="1" stroke-linecap="round"/>
        <path d="M28,34 L28,37" stroke="#92400e" stroke-width="1" stroke-linecap="round"/>
        <path d="M36,32 L36,35" stroke="#92400e" stroke-width="1" stroke-linecap="round"/>
      </g>
    </g>
    <circle cx="12" cy="32" r="2" fill="#60a5fa" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0" dur="0.8s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="28;40" dur="0.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="44" cy="32" r="2" fill="#60a5fa" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0" dur="0.8s" repeatCount="indefinite" begin="0.4s"/>
      <animate attributeName="cy" values="28;40" dur="0.8s" repeatCount="indefinite" begin="0.4s"/>
    </circle>
  </svg>`,

  // Wow — Surprised face with pulsing eyes
  'emote:wow': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="wow-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#wow-glow)">
      <circle cx="28" cy="28" r="20" fill="#3b82f6" stroke="#2563eb" stroke-width="1.5"/>
      <circle cx="20" cy="24" r="5" fill="#fff" stroke="#1e40af" stroke-width="0.8">
        <animate attributeName="r" values="4;6;4" dur="0.7s" repeatCount="indefinite"/>
      </circle>
      <circle cx="20" cy="24" r="2.5" fill="#1e3a8a">
        <animate attributeName="r" values="2;3;2" dur="0.7s" repeatCount="indefinite"/>
      </circle>
      <circle cx="20" cy="23" r="1" fill="#fff" opacity="0.8"/>
      <circle cx="36" cy="24" r="5" fill="#fff" stroke="#1e40af" stroke-width="0.8">
        <animate attributeName="r" values="4;6;4" dur="0.7s" repeatCount="indefinite"/>
      </circle>
      <circle cx="36" cy="24" r="2.5" fill="#1e3a8a">
        <animate attributeName="r" values="2;3;2" dur="0.7s" repeatCount="indefinite"/>
      </circle>
      <circle cx="36" cy="23" r="1" fill="#fff" opacity="0.8"/>
      <ellipse cx="28" cy="38" rx="5" ry="6" fill="#1e3a8a" stroke="#60a5fa" stroke-width="0.8">
        <animate attributeName="ry" values="5;7;5" dur="0.7s" repeatCount="indefinite"/>
      </ellipse>
      <path d="M16,14 L14,10" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" opacity="0.7">
        <animate attributeName="opacity" values="0;0.8;0" dur="1s" repeatCount="indefinite"/>
      </path>
      <path d="M40,14 L42,10" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" opacity="0.7">
        <animate attributeName="opacity" values="0;0.8;0" dur="1s" repeatCount="indefinite" begin="0.5s"/>
      </path>
    </g>
  </svg>`,

  // Panic — Screaming face trembling rapidly with alarm lines
  'emote:panic': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="panic-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#panic-glow)">
      <g>
        <animateTransform attributeName="transform" type="translate" values="-1.5,0;1.5,0;-1,0;1,0;-1.5,0" dur="0.12s" repeatCount="indefinite"/>
        <circle cx="28" cy="28" r="20" fill="#ef4444" stroke="#dc2626" stroke-width="1.5"/>
        <ellipse cx="20" cy="22" rx="4" ry="5" fill="#fff" stroke="#7f1d1d" stroke-width="0.6"/>
        <circle cx="20" cy="23" r="2" fill="#1c1917"/>
        <circle cx="20" cy="22" r="0.8" fill="#fff"/>
        <ellipse cx="36" cy="22" rx="4" ry="5" fill="#fff" stroke="#7f1d1d" stroke-width="0.6"/>
        <circle cx="36" cy="23" r="2" fill="#1c1917"/>
        <circle cx="36" cy="22" r="0.8" fill="#fff"/>
        <ellipse cx="28" cy="38" rx="6" ry="5" fill="#7f1d1d" stroke="#fca5a5" stroke-width="0.6"/>
        <path d="M15,12 L12,6" stroke="#fbbf24" stroke-width="2" stroke-linecap="round">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite"/>
        </path>
        <path d="M28,10 L28,4" stroke="#fbbf24" stroke-width="2" stroke-linecap="round">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="0.3s" repeatCount="indefinite"/>
        </path>
        <path d="M41,12 L44,6" stroke="#fbbf24" stroke-width="2" stroke-linecap="round">
          <animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite" begin="0.15s"/>
        </path>
      </g>
    </g>
  </svg>`,

  // Ship It — Rocket blasting upward with animated exhaust
  'emote:shipit': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ship-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#ship-glow)">
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,2;0,-2;0,2" dur="0.4s" repeatCount="indefinite"/>
        <path d="M28,4 Q28,4 34,20 L34,34 Q34,36 32,36 L24,36 Q22,36 22,34 L22,20 Z" fill="#7c3aed" stroke="#a78bfa" stroke-width="1.2"/>
        <ellipse cx="28" cy="14" rx="4" ry="4" fill="#c4b5fd" stroke="#a78bfa" stroke-width="0.8"/>
        <circle cx="28" cy="14" r="2" fill="#e9d5ff"/>
        <path d="M22,28 L16,36 L22,34 Z" fill="#6d28d9" stroke="#7c3aed" stroke-width="0.6"/>
        <path d="M34,28 L40,36 L34,34 Z" fill="#6d28d9" stroke="#7c3aed" stroke-width="0.6"/>
      </g>
    </g>
    <ellipse cx="28" cy="42" rx="4" ry="3" fill="#f97316" opacity="0.9">
      <animate attributeName="ry" values="3;6;3" dur="0.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.2s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="28" cy="44" rx="2.5" ry="2" fill="#fbbf24" opacity="0.8">
      <animate attributeName="ry" values="2;4;2" dur="0.15s" repeatCount="indefinite"/>
    </ellipse>
    <circle cx="24" cy="48" r="1.5" fill="#f97316" opacity="0">
      <animate attributeName="opacity" values="0;0.7;0" dur="0.5s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="44;54" dur="0.5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="32" cy="48" r="1.5" fill="#f97316" opacity="0">
      <animate attributeName="opacity" values="0;0.7;0" dur="0.5s" repeatCount="indefinite" begin="0.25s"/>
      <animate attributeName="cy" values="44;54" dur="0.5s" repeatCount="indefinite" begin="0.25s"/>
    </circle>
    <circle cx="28" cy="50" r="1" fill="#fbbf24" opacity="0">
      <animate attributeName="opacity" values="0;0.5;0" dur="0.4s" repeatCount="indefinite" begin="0.1s"/>
      <animate attributeName="cy" values="46;56" dur="0.4s" repeatCount="indefinite" begin="0.1s"/>
    </circle>
  </svg>`,

  // Rubber Duck — Duck bobbing on water with ripples
  'emote:duck': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="duck-glow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#duck-glow)">
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-5,28,36;5,28,36;-5,28,36" dur="1s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
        <ellipse cx="28" cy="34" rx="14" ry="10" fill="#eab308" stroke="#ca8a04" stroke-width="1.2"/>
        <circle cx="26" cy="20" r="10" fill="#facc15" stroke="#ca8a04" stroke-width="1.2"/>
        <circle cx="22" cy="18" r="2" fill="#1c1917"/>
        <circle cx="22" cy="17" r="0.8" fill="#fff"/>
        <ellipse cx="33" cy="20" rx="5" ry="2.5" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
        <path d="M14,32 Q10,28 14,26" stroke="#ca8a04" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>
    </g>
    <ellipse cx="28" cy="46" rx="18" ry="2" fill="none" stroke="#60a5fa" stroke-width="0.8" opacity="0.4">
      <animate attributeName="rx" values="10;20;10" dur="1.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="28" cy="46" rx="12" ry="1.5" fill="none" stroke="#60a5fa" stroke-width="0.6" opacity="0.3">
      <animate attributeName="rx" values="8;16;8" dur="1.2s" repeatCount="indefinite" begin="0.4s"/>
      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" begin="0.4s"/>
    </ellipse>
  </svg>`,

  // Stack Overflow — Bars stacking in from below
  'emote:stack': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="stack-glow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#stack-glow)">
      <rect x="12" y="38" width="32" height="6" rx="1.5" fill="#f97316" stroke="#ea580c" stroke-width="1">
        <animate attributeName="opacity" values="0;1;1;1;0" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="y" values="50;38;38;38;38" dur="2s" repeatCount="indefinite"/>
      </rect>
      <rect x="12" y="30" width="32" height="6" rx="1.5" fill="#6366f1" stroke="#4f46e5" stroke-width="1">
        <animate attributeName="opacity" values="0;0;1;1;0" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="y" values="50;50;30;30;30" dur="2s" repeatCount="indefinite"/>
      </rect>
      <rect x="12" y="22" width="32" height="6" rx="1.5" fill="#22c55e" stroke="#16a34a" stroke-width="1">
        <animate attributeName="opacity" values="0;0;0;1;0" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="y" values="50;50;50;22;22" dur="2s" repeatCount="indefinite"/>
      </rect>
      <rect x="12" y="14" width="32" height="6" rx="1.5" fill="#eab308" stroke="#ca8a04" stroke-width="1">
        <animate attributeName="opacity" values="0;0;0;0;1" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="y" values="50;50;50;50;14" dur="2s" repeatCount="indefinite"/>
      </rect>
    </g>
    <rect x="8" y="45" width="40" height="3" rx="1" fill="#475569" stroke="#64748b" stroke-width="0.5"/>
  </svg>`,

  // 404 Not Found — Terminal screen with glitching text
  'emote:404': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="f404-glow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="f404-clip"><rect x="6" y="8" width="44" height="38" rx="2"/></clipPath>
    </defs>
    <g filter="url(#f404-glow)">
      <rect x="4" y="6" width="48" height="42" rx="4" fill="#0f172a" stroke="#6366f1" stroke-width="1.5"/>
      <rect x="4" y="6" width="48" height="8" rx="4" fill="#1e1b4b"/>
      <rect x="4" y="10" width="48" height="4" fill="#1e1b4b"/>
      <circle cx="11" cy="10" r="1.5" fill="#ef4444"/>
      <circle cx="17" cy="10" r="1.5" fill="#eab308"/>
      <circle cx="23" cy="10" r="1.5" fill="#22c55e"/>
    </g>
    <g clip-path="url(#f404-clip)">
      <text x="28" y="32" text-anchor="middle" font-family="monospace" font-weight="900" font-size="16" fill="#f87171">
        404
        <animate attributeName="opacity" values="1;1;0;1;1;0.5;1" dur="2s" repeatCount="indefinite"/>
      </text>
      <text x="28" y="32" text-anchor="middle" font-family="monospace" font-weight="900" font-size="16" fill="#818cf8" opacity="0">
        404
        <animate attributeName="opacity" values="0;0;0.8;0;0;0.4;0" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="x" values="28;30;26;28" dur="0.15s" repeatCount="indefinite"/>
      </text>
      <rect x="12" y="38" width="16" height="1.5" rx="0.5" fill="#475569" opacity="0.5"/>
      <rect x="12" y="42" width="24" height="1.5" rx="0.5" fill="#475569" opacity="0.3"/>
    </g>
    <line x1="10" y1="24" x2="46" y2="24" stroke="#6366f1" stroke-width="0.3" opacity="0.15">
      <animate attributeName="y1" values="18;46;18" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="y2" values="18;46;18" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.3;0" dur="3s" repeatCount="indefinite"/>
    </line>
  </svg>`,
};

let _svgUid = 0;

/** Returns the SVG string with unique filter/clipPath IDs to avoid collisions */
export function getEmoteSvg(emoteId: string): string | null {
  const svg = EMOTE_SVGS[emoteId];
  if (!svg) return null;
  const uid = 'e' + (++_svgUid);
  // Replace all id="..." and url(#...) / href="#..." references with unique suffixed versions
  return svg
    .replace(/id="([^"]+)"/g, (_m, id) => `id="${id}-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${id}-${uid})`)
    .replace(/href="#([^"]+)"/g, (_m, id) => `href="#${id}-${uid}"`);
}

export function initEmotes(sendFn: SendMessageFn): void {
  _sendMessage = sendFn;

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore if typing in an input/textarea
    if (!(e.target instanceof HTMLElement)) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const bindings = getEmoteBindings();
    const emoteId = bindings.get(e.key);
    if (!emoteId || !_sendMessage) return;

    _sendMessage({ type: 'emote', emoteId });
  });
}

export function showEmoteBubble(playerId: string, emoteId: string, lx: number, ly: number): void {
  const emote = EMOTE_MAP.get(emoteId);
  if (!emote || !dom.arena) return;

  const pos = logicalToPixel(lx, ly);

  const bubble = document.createElement('div');
  bubble.className = 'emote-bubble';
  // Add emote-specific class for per-type glow color
  const shortId = emoteId.replace('emote:', '');
  bubble.classList.add('emote-' + shortId);
  bubble.style.left = pos.x + 'px';
  bubble.style.top = pos.y + 'px';

  const svg = EMOTE_SVGS[emoteId];
  if (svg) {
    bubble.innerHTML = svg;
  }

  dom.arena.appendChild(bubble);

  // Remove after animation completes
  setTimeout(() => bubble.remove(), 2200);
}
