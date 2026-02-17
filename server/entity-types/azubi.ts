import { baseDescriptor } from './base.ts';
import { getDifficultyConfig, LOGICAL_W, LOGICAL_H } from '../config.ts';
import { randomPosition, awardScore, currentLevelConfig } from '../state.ts';
import * as game from '../game.ts';
import * as powerups from '../powerups.ts';
import { gameBugsSquashed } from '../metrics.ts';
import type { BugEntity, GameContext, EntityDescriptor, BugTypePlugin, SpawnEntityOptions } from '../types.ts';

export const AZUBI_MECHANICS = {
  clicksToKill: 10,
  spawnInterval: 1800,
  spawnSpeedupPerHit: 0.80,
  bonusPoints: 50,
  escapeDamage: 25,
  escapeTimeMultiplier: 2.5,
};

// Lazy-cached reference to spawnEntity to avoid circular dependency at module load time
let _spawnEntity: ((ctx: GameContext, opts: SpawnEntityOptions) => boolean) | null = null;
async function getSpawnEntity() {
  if (!_spawnEntity) {
    const mod = await import('../bugs.ts');
    _spawnEntity = mod.spawnEntity;
  }
  return _spawnEntity;
}
// Eagerly resolve on first import so it's ready by the time any azubi spawns
getSpawnEntity();

function startAzubiSpawning(bug: BugEntity, ctx: GameContext) {
  const interval = bug.azubiSpawnInterval ?? AZUBI_MECHANICS.spawnInterval;
  bug._timers.setInterval('azubi-spawn', () => {
    if (!ctx.state.bugs[bug.id] || ctx.state.hammerStunActive) return;
    if (!_spawnEntity) return; // not resolved yet (shouldn't happen)

    const cfg = currentLevelConfig(ctx.state);
    const isFeature = Math.random() < 0.5;
    // Spawn near the azubi with some random offset (clamped to arena bounds)
    const offset = 60;
    const nx = Math.max(20, Math.min(LOGICAL_W - 20, bug.x + (Math.random() - 0.5) * offset * 2));
    const ny = Math.max(20, Math.min(LOGICAL_H - 20, bug.y + (Math.random() - 0.5) * offset * 2));
    const baseVariant: Partial<BugEntity> = { x: nx, y: ny };
    if (isFeature) baseVariant.isFeature = true;
    const variant = baseVariant;
    const phaseCheck = ctx.state.phase === 'boss' ? 'boss' : 'playing';
    const onEscapeCheck = ctx.state.phase === 'boss'
      ? () => game.checkBossGameState(ctx)
      : () => game.checkGameState(ctx);

    _spawnEntity(ctx, {
      phaseCheck,
      maxOnScreen: cfg.maxOnScreen + 2, // allow slightly more bugs when azubi is spawning
      escapeTime: cfg.escapeTime,
      isMinion: false,
      onEscapeCheck,
      variant,
    });
    // Don't increment bugsSpawned — these are extra bugs from the azubi
  }, interval);
}

export const azubiDescriptor: EntityDescriptor = {
  ...baseDescriptor,

  broadcastFields(bug: BugEntity) {
    return { isAzubi: true, azubiHp: bug.azubiHp, azubiMaxHp: bug.azubiMaxHp };
  },

  setupTimers(bug: BugEntity, ctx: GameContext) {
    startAzubiSpawning(bug, ctx);
  },

  onStun(bug: BugEntity, ctx: GameContext) {
    baseDescriptor.onStun(bug, ctx);
    // Base clears all timers including azubi-spawn, which is what we want
  },

  onResume(this: EntityDescriptor, bug: BugEntity, ctx: GameContext) {
    bug.isStunned = false;
    const remainingTime = bug.remainingEscapeTime!;
    bug.escapeStartedAt = Date.now();
    bug.escapeTime = remainingTime;

    if (bug._onEscape && !bug._sharedEscapeWith) {
      bug._timers.setTimeout('escape', bug._onEscape, remainingTime);
    }

    if (remainingTime > 0) {
      this.createWander(bug, ctx);
      startAzubiSpawning(bug, ctx);
    }
  },

  onEscape(bug: BugEntity, ctx: GameContext, onEscapeCheck: () => void) {
    bug._timers.clearAll();
    delete ctx.state.bugs[bug.id];
    ctx.state.hp -= AZUBI_MECHANICS.escapeDamage;
    if (ctx.state.hp < 0) ctx.state.hp = 0;

    if (ctx.matchLog) {
      ctx.matchLog.log('escape', { bugId: bug.id, type: 'azubi', activeBugs: Object.keys(ctx.state.bugs).length, hp: ctx.state.hp });
    }

    ctx.events.emit({ type: 'azubi-escaped', bugId: bug.id, hp: ctx.state.hp });
    onEscapeCheck();
  },

  onClick(bug: BugEntity, ctx: GameContext, pid: string, _msg: any) {
    const { state } = ctx;
    const player = state.players[pid];
    if (!player) return;

    bug.azubiHp = (bug.azubiHp ?? AZUBI_MECHANICS.clicksToKill) - 1;

    if (bug.azubiHp! <= 0) {
      // Azubi killed
      bug._timers.clearAll();
      delete state.bugs[bug.id];

      player.bugsSquashed = (player.bugsSquashed || 0) + 1;
      gameBugsSquashed.inc();
      let rawPoints = AZUBI_MECHANICS.bonusPoints;
      if (powerups.isDuckBuffActive(ctx)) rawPoints *= 2;
      const points = awardScore(ctx, pid, rawPoints);

      if (ctx.matchLog) {
        ctx.matchLog.log('squash', { bugId: bug.id, type: 'azubi', by: pid, activeBugs: Object.keys(state.bugs).length, score: state.score });
      }

      ctx.events.emit({
        type: 'azubi-killed',
        bugId: bug.id,
        playerId: pid,
        playerColor: player.color,
        score: state.score,
        playerScore: player.score,
        points,
      });

      if (state.phase === 'boss') game.checkBossGameState(ctx);
      else game.checkGameState(ctx);
    } else {
      // Hit but not dead — speed up spawning
      bug.azubiSpawnInterval = (bug.azubiSpawnInterval ?? AZUBI_MECHANICS.spawnInterval) * AZUBI_MECHANICS.spawnSpeedupPerHit;
      // Restart spawn timer with new faster interval
      bug._timers.clear('azubi-spawn');
      startAzubiSpawning(bug, ctx);

      ctx.events.emit({
        type: 'azubi-hit',
        bugId: bug.id,
        playerId: pid,
        playerColor: player.color,
        azubiHp: bug.azubiHp,
        azubiMaxHp: bug.azubiMaxHp,
      });
    }
  },
};

export const azubiPlugin: BugTypePlugin = {
  typeKey: 'azubi',
  detect: (bug) => !!bug.isAzubi,
  descriptor: azubiDescriptor,
  escapeTimeMultiplier: AZUBI_MECHANICS.escapeTimeMultiplier,
  spawn: {
    mode: 'single',
    chanceKey: 'azubiChance',
    startLevelKey: 'azubiStartLevel',
    createVariant: () => ({
      isAzubi: true,
      azubiHp: AZUBI_MECHANICS.clicksToKill,
      azubiMaxHp: AZUBI_MECHANICS.clicksToKill,
      azubiSpawnInterval: AZUBI_MECHANICS.spawnInterval,
    }),
    canSpawn: (ctx) => {
      // Max 1 azubi at a time
      return !Object.values(ctx.state.bugs).some(b => b.isAzubi);
    },
  },
};
