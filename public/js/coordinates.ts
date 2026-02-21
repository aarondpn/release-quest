import { LOGICAL_W, LOGICAL_H } from './config.ts';
import { dom } from './state.ts';

let cachedRect: DOMRect | null = null;

export function getArenaRect(): DOMRect {
  if (!cachedRect) {
    cachedRect = dom.arena!.getBoundingClientRect();
  }
  return cachedRect;
}

export function refreshArenaRect(): void {
  cachedRect = null;
}

window.addEventListener('resize', refreshArenaRect);

export function logicalToPixel(lx: number, ly: number): { x: number; y: number } {
  const rect = getArenaRect();
  return {
    x: (lx / LOGICAL_W) * rect.width,
    y: (ly / LOGICAL_H) * rect.height,
  };
}

export function pixelToLogical(px: number, py: number): { x: number; y: number } {
  const rect = getArenaRect();
  return {
    x: (px / rect.width) * LOGICAL_W,
    y: (py / rect.height) * LOGICAL_H,
  };
}
