import { ref } from 'vue';
import { LOGICAL_W, LOGICAL_H } from '../config';

const arenaEl = ref<HTMLElement | null>(null);
let cachedRect: DOMRect | null = null;

export function setArenaElement(el: HTMLElement | null) {
  arenaEl.value = el;
  cachedRect = null;
}

export function getArenaRect(): DOMRect {
  if (!cachedRect && arenaEl.value) {
    cachedRect = arenaEl.value.getBoundingClientRect();
  }
  return cachedRect || new DOMRect(0, 0, 800, 500);
}

export function refreshArenaRect() {
  cachedRect = null;
}

export function logicalToPixel(lx: number, ly: number) {
  const rect = getArenaRect();
  return {
    x: (lx / LOGICAL_W) * rect.width,
    y: (ly / LOGICAL_H) * rect.height,
  };
}

export function pixelToLogical(px: number, py: number) {
  const rect = getArenaRect();
  return {
    x: (px / rect.width) * LOGICAL_W,
    y: (py / rect.height) * LOGICAL_H,
  };
}

// Re-invalidate cache on resize
if (typeof window !== 'undefined') {
  window.addEventListener('resize', refreshArenaRect);
}
