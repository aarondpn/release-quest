import { megaBugPlugin } from './mega-bug.ts';
import type { BossTypePluginInterface } from '../types.ts';
import type { ZodType } from 'zod';

const plugins: BossTypePluginInterface[] = [megaBugPlugin];

const pluginMap = new Map<string, BossTypePluginInterface>();
for (const p of plugins) pluginMap.set(p.typeKey, p);

export function getBossType(typeKey: string): BossTypePluginInterface {
  const plugin = pluginMap.get(typeKey);
  if (!plugin) throw new Error(`Unknown boss type: ${typeKey}`);
  return plugin;
}

export function getDefaultBossType(): BossTypePluginInterface {
  return megaBugPlugin;
}

export function getAllBossTypes(): BossTypePluginInterface[] {
  return plugins;
}

export function getBossHandlers(): Record<string, (ctx: any) => void | Promise<void>> {
  const handlers: Record<string, (ctx: any) => void | Promise<void>> = {};
  for (const p of plugins) {
    if (p.handlers) Object.assign(handlers, p.handlers);
  }
  return handlers;
}

export function getBossSchemas(): Record<string, ZodType> {
  const schemas: Record<string, ZodType> = {};
  for (const p of plugins) {
    if (p.schemas) Object.assign(schemas, p.schemas);
  }
  return schemas;
}
