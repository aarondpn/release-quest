import { normalDescriptor } from './normal.ts';
import { minionDescriptor } from './minion.ts';
import { heisenbugDescriptor } from './heisenbug.ts';
import { featureDescriptor } from './feature.ts';
import { memoryLeakDescriptor } from './memory-leak.ts';
import { mergeConflictDescriptor } from './merge-conflict.ts';
import { pipelineDescriptor } from './pipeline.ts';
import { infiniteLoopDescriptor } from './infinite-loop.ts';
import type { BugEntity, EntityDescriptor } from '../types.ts';

export { handleBreakpointClick } from './infinite-loop.ts';

const types: Record<string, EntityDescriptor> = {
  normal: normalDescriptor,
  minion: minionDescriptor,
  heisenbug: heisenbugDescriptor,
  feature: featureDescriptor,
  memoryLeak: memoryLeakDescriptor,
  mergeConflict: mergeConflictDescriptor,
  pipeline: pipelineDescriptor,
  infiniteLoop: infiniteLoopDescriptor,
};

function getType(bug: BugEntity): string {
  if (bug.isInfiniteLoop) return 'infiniteLoop';
  if (bug.isPipeline) return 'pipeline';
  if (bug.mergeConflict) return 'mergeConflict';
  if (bug.isMemoryLeak) return 'memoryLeak';
  if (bug.isHeisenbug) return 'heisenbug';
  if (bug.isFeature) return 'feature';
  if (bug.isMinion) return 'minion';
  return 'normal';
}

export function getDescriptor(bug: BugEntity): EntityDescriptor {
  return types[getType(bug)];
}

export { types, getType };
