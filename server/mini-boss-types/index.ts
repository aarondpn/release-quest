import { stackOverflowPlugin } from './stack-overflow.ts';
import { raceConditionPlugin } from './race-condition.ts';
import { deadlockPlugin } from './deadlock.ts';
import type { MiniBossPlugin } from '../types.ts';

const ALL_MINI_BOSSES: MiniBossPlugin[] = [
  stackOverflowPlugin,
  raceConditionPlugin,
  deadlockPlugin,
];

const MINI_BOSS_MAP = new Map(ALL_MINI_BOSSES.map(p => [p.typeKey, p]));

export function getMiniBossType(key: string): MiniBossPlugin | undefined {
  return MINI_BOSS_MAP.get(key);
}

export function getAllMiniBossTypes(): MiniBossPlugin[] {
  return ALL_MINI_BOSSES;
}

export function getMiniBossKeys(): string[] {
  return ALL_MINI_BOSSES.map(p => p.typeKey);
}
