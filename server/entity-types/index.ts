import { normalDescriptor } from './normal.ts';
import { minionDescriptor } from './minion.ts';
import { heisenbugPlugin } from './heisenbug.ts';
import { featurePlugin } from './feature.ts';
import { memoryLeakPlugin } from './memory-leak.ts';
import { mergeConflictPlugin } from './merge-conflict.ts';
import { pipelinePlugin } from './pipeline.ts';
import { infiniteLoopPlugin } from './infinite-loop.ts';
import type { BugEntity, BugTypePlugin, EntityDescriptor } from '../types.ts';
import type { ZodType } from 'zod';

// Order = detection priority (checked first to last)
const plugins: BugTypePlugin[] = [
  infiniteLoopPlugin, pipelinePlugin, mergeConflictPlugin,
  memoryLeakPlugin, heisenbugPlugin, featurePlugin,
];

const descriptors: Record<string, EntityDescriptor> = {
  normal: normalDescriptor,
  minion: minionDescriptor,
};
for (const p of plugins) descriptors[p.typeKey] = p.descriptor;

function getType(bug: BugEntity): string {
  for (const p of plugins) {
    if (p.detect(bug)) return p.typeKey;
  }
  if (bug.isMinion) return 'minion';
  return 'normal';
}

export function getDescriptor(bug: BugEntity): EntityDescriptor {
  return descriptors[getType(bug)];
}

export function getPlugins(): BugTypePlugin[] {
  return plugins;
}

export function getHandlers(): Record<string, (ctx: any) => void | Promise<void>> {
  const handlers: Record<string, (ctx: any) => void | Promise<void>> = {};
  for (const p of plugins) {
    if (p.handlers) Object.assign(handlers, p.handlers);
  }
  return handlers;
}

export function getSchemas(): Record<string, ZodType> {
  const schemas: Record<string, ZodType> = {};
  for (const p of plugins) {
    if (p.schemas) Object.assign(schemas, p.schemas);
  }
  return schemas;
}

export { descriptors as types, getType };
