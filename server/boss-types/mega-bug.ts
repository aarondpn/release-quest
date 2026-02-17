import { getDifficultyConfig } from '../config.ts';
import { randomPosition } from '../state.ts';
import { setupBossWander, setupMinionSpawning } from '../boss.ts';
import * as bugs from '../bugs.ts';
import logger from '../logger.ts';
import type { GameContext, BossTypePluginInterface, BossClickResult, BossState, DifficultyConfig } from '../types.ts';

const PHASE_NAMES: Record<number, string> = {
  1: 'The Sprint',
  2: 'The Shield',
  3: 'The Swarm',
};

export const megaBugPlugin: BossTypePluginInterface = {
  typeKey: 'mega-bug',
  displayName: 'MEGA BUG',

  init(ctx: GameContext, bossConfig: DifficultyConfig['boss']): BossState {
    const pos = randomPosition();
    const extra = Math.max(0, Object.keys(ctx.state.players).length - 1);
    return {
      hp: bossConfig.hp + extra * 150,
      maxHp: bossConfig.hp + extra * 150,
      x: pos.x,
      y: pos.y,
      lastClickBy: {},
      timeRemaining: bossConfig.timeLimit,
      currentSpawnRate: bossConfig.minionSpawnRate,
      currentMaxOnScreen: bossConfig.minionMaxOnScreen + extra,
      regenPerSecond: bossConfig.regenPerSecond + extra,
      extraPlayers: extra,
      bossType: 'mega-bug',
      data: {
        phase: 1,
        phaseName: PHASE_NAMES[1],
        invulnUntil: 0,
        shieldActive: false,
        shieldCycleStart: 0,
        screenWipeLastAt: 0,
      },
    };
  },

  onTick(ctx: GameContext): void {
    const { state } = ctx;
    if (!state.boss) return;
    const data = state.boss.data;
    const phase = data.phase as number;

    // Phase 1: Apply base regen
    if (phase === 1) {
      const oldHp = state.boss.hp;
      state.boss.hp = Math.min(state.boss.hp + state.boss.regenPerSecond, state.boss.maxHp);
      const regenAmount = state.boss.hp - oldHp;
      if (regenAmount > 0) {
        ctx.events.emit({
          type: 'boss-regen',
          regenAmount,
          bossHp: state.boss.hp,
          bossMaxHp: state.boss.maxHp,
        });
      }
    }

    // Phase 2: Shield cycle + regen
    if (phase === 2) {
      const phases = getPhaseConfig(ctx);
      const now = Date.now();
      const cycleStart = data.shieldCycleStart as number;
      const elapsed = now - cycleStart;
      const cycleDuration = phases.shieldInterval + phases.shieldDuration;
      const cyclePos = elapsed % cycleDuration;

      const shouldBeShielded = cyclePos >= phases.shieldInterval;
      const wasShielded = data.shieldActive as boolean;

      if (shouldBeShielded !== wasShielded) {
        data.shieldActive = shouldBeShielded;
        ctx.events.emit({
          type: 'boss-shield-toggle',
          active: shouldBeShielded,
        });
      }

      // Regen: double rate while shielded
      const regenMult = (data.shieldActive as boolean) ? 2 : 1;
      const oldHp = state.boss.hp;
      state.boss.hp = Math.min(state.boss.hp + state.boss.regenPerSecond * regenMult, state.boss.maxHp);
      const regenAmount = state.boss.hp - oldHp;
      if (regenAmount > 0) {
        ctx.events.emit({
          type: 'boss-regen',
          regenAmount,
          bossHp: state.boss.hp,
          bossMaxHp: state.boss.maxHp,
        });
      }
    }

    // Phase 3: No regen, screen wipe
    if (phase === 3) {
      const phases = getPhaseConfig(ctx);
      const now = Date.now();
      const lastWipe = data.screenWipeLastAt as number;
      if (now - lastWipe >= phases.screenWipeInterval) {
        data.screenWipeLastAt = now;
        doScreenWipe(ctx, phases.screenWipeBugCount);
      }
    }
  },

  onClick(ctx: GameContext, pid: string, damage: number): BossClickResult {
    const { state } = ctx;
    if (!state.boss) return { damageApplied: 0, blocked: false, points: 0 };
    const data = state.boss.data;

    // Check invulnerability during phase transition
    if ((data.invulnUntil as number) > Date.now()) {
      return { damageApplied: 0, blocked: true, points: 0, emit: { reason: 'invuln' } };
    }

    // Phase 2 shield blocks damage
    if ((data.phase as number) === 2 && (data.shieldActive as boolean)) {
      return { damageApplied: 0, blocked: true, points: 0, emit: { reason: 'shield' } };
    }

    // Phase 3: minions on screen reduce boss damage
    if ((data.phase as number) === 3) {
      const minionCount = Object.values(state.bugs).filter(b => b.isMinion).length;
      const phases = getPhaseConfig(ctx);
      const reduction = Math.min(minionCount * phases.phase3DamageReductionPerMinion, phases.phase3MaxDamageReduction);
      damage = Math.max(1, Math.round(damage * (1 - reduction)));
    }

    // Apply damage
    state.boss.hp -= damage;
    if (state.boss.hp < 0) state.boss.hp = 0;

    // Check phase transitions
    const phases = getPhaseConfig(ctx);
    const hpRatio = state.boss.hp / state.boss.maxHp;
    const currentPhase = data.phase as number;

    if (currentPhase === 1 && hpRatio <= phases.phase2Threshold) {
      transitionPhase(ctx, 2);
    } else if (currentPhase === 2 && hpRatio <= phases.phase3Threshold) {
      transitionPhase(ctx, 3);
    }

    return { damageApplied: damage, blocked: false, points: 0 };
  },

  onStun(ctx: GameContext): void {
    const { state } = ctx;
    if (!state.boss) return;
    const data = state.boss.data;
    data._shieldCyclePausedAt = Date.now();
    data._screenWipePausedAt = Date.now();
  },

  onResume(ctx: GameContext): void {
    const { state } = ctx;
    if (!state.boss) return;
    const data = state.boss.data;
    const now = Date.now();

    if (data._shieldCyclePausedAt && data.shieldCycleStart) {
      const pauseDuration = now - (data._shieldCyclePausedAt as number);
      data.shieldCycleStart = (data.shieldCycleStart as number) + pauseDuration;
    }

    if (data._screenWipePausedAt && data.screenWipeLastAt) {
      const pauseDuration = now - (data._screenWipePausedAt as number);
      data.screenWipeLastAt = (data.screenWipeLastAt as number) + pauseDuration;
    }

    delete data._shieldCyclePausedAt;
    delete data._screenWipePausedAt;
  },

  onDefeat(_ctx: GameContext): void {
    // Kill bonus is handled by boss.ts orchestrator
  },

  getSpawnRate(ctx: GameContext): number {
    const { state } = ctx;
    if (!state.boss) return 4000;
    const data = state.boss.data;
    const phase = data.phase as number;
    const phases = getPhaseConfig(ctx);

    if (phase === 2) return state.boss.currentSpawnRate / phases.phase2SpawnRateMultiplier;
    if (phase === 3) return state.boss.currentSpawnRate / phases.phase3SpawnRateMultiplier;
    return state.boss.currentSpawnRate;
  },

  getMaxOnScreen(ctx: GameContext): number {
    const { state } = ctx;
    if (!state.boss) return 3;
    const data = state.boss.data;
    const phase = data.phase as number;
    const phases = getPhaseConfig(ctx);

    if (phase === 3) return Math.ceil(state.boss.currentMaxOnScreen * phases.phase3MaxOnScreenMultiplier);
    return state.boss.currentMaxOnScreen;
  },

  broadcastFields(ctx: GameContext): Record<string, unknown> {
    const { state } = ctx;
    if (!state.boss) return {};
    const data = state.boss.data;
    const fields: Record<string, unknown> = {
      bossType: 'mega-bug',
      phase: data.phase,
      phaseName: data.phaseName,
      shieldActive: data.shieldActive,
      invulnUntil: data.invulnUntil,
    };
    if ((data.phase as number) === 3) {
      const minionCount = Object.values(state.bugs).filter(b => b.isMinion).length;
      const phases = getPhaseConfig(ctx);
      fields.damageReduction = Math.round(Math.min(minionCount * phases.phase3DamageReductionPerMinion, phases.phase3MaxDamageReduction) * 100);
    }
    return fields;
  },
};

function getPhaseConfig(ctx: GameContext): DifficultyConfig['boss']['bossPhases'] {
  return getDifficultyConfig(ctx.state.difficulty, ctx.state.customConfig).boss.bossPhases;
}

function transitionPhase(ctx: GameContext, newPhase: number): void {
  const { state } = ctx;
  if (!state.boss) return;
  const data = state.boss.data;
  const bossConfig = getDifficultyConfig(state.difficulty, state.customConfig).boss;
  const phases = bossConfig.bossPhases;

  // Clear all minions during transition
  bugs.clearAllMinions(ctx);

  // Set invulnerability
  data.invulnUntil = Date.now() + phases.transitionInvulnTime;

  // Update phase
  data.phase = newPhase;
  data.phaseName = PHASE_NAMES[newPhase];

  if (ctx.matchLog) {
    ctx.matchLog.log('boss-phase-change', {
      phase: newPhase,
      phaseName: PHASE_NAMES[newPhase],
      bossHp: state.boss.hp,
      bossMaxHp: state.boss.maxHp,
    });
  }

  if (newPhase === 2) {
    data.shieldActive = false;
    data.shieldCycleStart = Date.now() + phases.transitionInvulnTime;
    setupBossWander(ctx, phases.phase2WanderInterval);
    setupMinionSpawning(ctx, megaBugPlugin.getSpawnRate(ctx));
  }

  if (newPhase === 3) {
    data.shieldActive = false;
    state.boss.x = 400;
    state.boss.y = 250;
    state.boss.regenPerSecond = 0;
    state.boss.timeRemaining = Math.ceil(state.boss.timeRemaining * (1 - phases.phase3TimeReduction));
    data.screenWipeLastAt = Date.now();
    ctx.timers.boss.clear('bossWander');
    setupMinionSpawning(ctx, megaBugPlugin.getSpawnRate(ctx));
  }

  ctx.events.emit({
    type: 'boss-phase-change',
    phase: newPhase,
    phaseName: PHASE_NAMES[newPhase],
    bossHp: state.boss.hp,
    bossMaxHp: state.boss.maxHp,
    x: state.boss.x,
    y: state.boss.y,
    timeRemaining: state.boss.timeRemaining,
  });

  // Seed initial minions AFTER phase-change event so the client's clearAllBugs() runs first
  if (newPhase === 3) {
    const initialCount = Math.ceil(megaBugPlugin.getMaxOnScreen(ctx) * 0.6);
    for (let i = 0; i < initialCount; i++) {
      bugs.spawnMinion(ctx);
    }
  }
}

function doScreenWipe(ctx: GameContext, bugCount: number): void {
  const { state } = ctx;
  if (!state.boss || state.hammerStunActive) return;

  ctx.events.emit({ type: 'boss-screen-wipe' });

  const y = 40 + Math.random() * 420;
  for (let i = 0; i < bugCount; i++) {
    const x = 40 + (i / (bugCount - 1 || 1)) * 720;
    try {
      bugs.spawnMinionAtPosition(ctx, x, y);
    } catch (err) {
      logger.error({ err, lobbyId: ctx.lobbyId }, 'Error spawning screen wipe minion');
    }
  }
}
