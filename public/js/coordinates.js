import { LOGICAL_W, LOGICAL_H } from './config.js';
import { dom } from './state.js';

export function logicalToPixel(lx, ly) {
  const rect = dom.arena.getBoundingClientRect();
  return {
    x: (lx / LOGICAL_W) * rect.width,
    y: (ly / LOGICAL_H) * rect.height,
  };
}

export function pixelToLogical(px, py) {
  const rect = dom.arena.getBoundingClientRect();
  return {
    x: (px / rect.width) * LOGICAL_W,
    y: (py / rect.height) * LOGICAL_H,
  };
}
