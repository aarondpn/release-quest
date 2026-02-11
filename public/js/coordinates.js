import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom } from './state.js';

let cachedRect = null;

export function getArenaRect() {
  if (!cachedRect) {
    cachedRect = dom.arena.getBoundingClientRect();
  }
  return cachedRect;
}

export function refreshArenaRect() {
  cachedRect = null;
}

window.addEventListener('resize', refreshArenaRect);

export function logicalToPixel(lx, ly) {
  const rect = getArenaRect();
  return {
    x: (lx / LOGICAL_W) * rect.width,
    y: (ly / LOGICAL_H) * rect.height,
  };
}

export function pixelToLogical(px, py) {
  const rect = getArenaRect();
  return {
    x: (px / rect.width) * LOGICAL_W,
    y: (py / rect.height) * LOGICAL_H,
  };
}
