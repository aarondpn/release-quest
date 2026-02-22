import { LOGICAL_W, LOGICAL_H } from '../../shared/constants.ts';
import logger from '../logger.ts';
import type { GameContext, MiniBossPlugin, MiniBossEntity } from '../types.ts';

const BOSS_HP = 30;
const DAMAGE_PER_SEQUENCE = 10;
const HEAL_ON_FAIL = 3;
const LOCK_COUNT = 6;
const SHOW_DURATION_PER_LOCK_MS = 800;
const SHOW_PAUSE_MS = 500;

// Sequence lengths increase: round 1=3, round 2=4, round 3=5
function sequenceLengthForRound(round: number): number {
  return round + 2;
}

interface DeadlockData {
  bossHp: number;
  round: number;
  phase: 'showing' | 'input';
  sequence: number[];
  inputIndex: number;
  showingUntil: number;
  _extra: {
    bossHp: number;
    bossMaxHp: number;
    phase: 'showing' | 'input';
    sequence: string[];
    showStartedAt: number;
    showDurationPerLock: number;
    showPause: number;
    inputIndex: number;
    round: number;
  };
}

function lockPositions(): { x: number; y: number }[] {
  const cx = LOGICAL_W / 2;
  const cy = LOGICAL_H / 2;
  const radius = Math.min(LOGICAL_W, LOGICAL_H) * 0.32;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < LOCK_COUNT; i++) {
    const angle = (i / LOCK_COUNT) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return positions;
}

function generateSequence(length: number): number[] {
  const seq: number[] = [];
  let last = -1;
  for (let i = 0; i < length; i++) {
    let next: number;
    do {
      next = Math.floor(Math.random() * LOCK_COUNT);
    } while (next === last);
    seq.push(next);
    last = next;
  }
  return seq;
}

function startShowingPhase(data: DeadlockData): void {
  const seqLen = sequenceLengthForRound(data.round);
  data.sequence = generateSequence(seqLen);
  data.phase = 'showing';
  data.inputIndex = 0;

  const now = Date.now();
  const showDuration = SHOW_PAUSE_MS + seqLen * SHOW_DURATION_PER_LOCK_MS + SHOW_PAUSE_MS;
  data.showingUntil = now + showDuration;

  data._extra.phase = 'showing';
  data._extra.sequence = data.sequence.map(i => 'mb_lock_' + i);
  data._extra.showStartedAt = now;
  data._extra.showDurationPerLock = SHOW_DURATION_PER_LOCK_MS;
  data._extra.showPause = SHOW_PAUSE_MS;
  data._extra.inputIndex = 0;
  data._extra.round = data.round;
}

export const deadlockPlugin: MiniBossPlugin = {
  typeKey: 'deadlock',
  displayName: 'Deadlock',
  icon: '\u{1F512}',
  description: 'Memorize the sequence! Replay it in order. Wrong clicks heal the boss.',
  timeLimit: 40,
  defeatPenalty: 25,

  init(ctx: GameContext): MiniBossEntity[] {
    const mb = ctx.state.miniBoss!;
    const data: DeadlockData = {
      bossHp: BOSS_HP,
      round: 1,
      phase: 'showing',
      sequence: [],
      inputIndex: 0,
      showingUntil: 0,
      _extra: {
        bossHp: BOSS_HP,
        bossMaxHp: BOSS_HP,
        phase: 'showing',
        sequence: [],
        showStartedAt: 0,
        showDurationPerLock: SHOW_DURATION_PER_LOCK_MS,
        showPause: SHOW_PAUSE_MS,
        inputIndex: 0,
        round: 1,
      },
    };

    startShowingPhase(data);
    mb.data = data as unknown as Record<string, unknown>;

    const showDurationMs = SHOW_PAUSE_MS + sequenceLengthForRound(1) * SHOW_DURATION_PER_LOCK_MS + SHOW_PAUSE_MS;
    logger.info({
      miniBoss: 'deadlock',
      event: 'init',
      lobbyId: ctx.lobbyId,
      constants: {
        BOSS_HP,
        DAMAGE_PER_SEQUENCE,
        HEAL_ON_FAIL,
        LOCK_COUNT,
        SHOW_DURATION_PER_LOCK_MS,
        SHOW_PAUSE_MS,
        timeLimit: 40,
      },
      round1: {
        sequenceLength: sequenceLengthForRound(1),
        showDurationMs,
        sequence: data.sequence,
        sequenceIds: data._extra.sequence,
      },
      note: `3 rounds needed (10+10+10 = 30 HP). Round seq lengths: 3, 4, 5. Show duration r1: ${showDurationMs}ms.`,
    }, '[Deadlock] Boss initialized');

    const positions = lockPositions();
    return positions.map((pos, i) => ({
      id: 'mb_lock_' + i,
      x: pos.x,
      y: pos.y,
      hp: 1,
      maxHp: 1,
      variant: 'lock',
    }));
  },

  onClick(ctx: GameContext, pid: string, entityId: string): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as DeadlockData;
    const now = Date.now();

    // Ignore clicks during showing phase
    if (data.phase === 'showing') {
      if (now < data.showingUntil) {
        const remainingMs = data.showingUntil - now;
        logger.info({
          miniBoss: 'deadlock',
          event: 'click-blocked-showing',
          lobbyId: ctx.lobbyId,
          pid,
          entityId,
          remainingShowMs: remainingMs,
          sequence: data.sequence,
        }, '[Deadlock] Click ignored — still in showing phase');
        return;
      }
      // Showing phase just ended, transition to input
      data.phase = 'input';
      data._extra.phase = 'input';
      logger.info({
        miniBoss: 'deadlock',
        event: 'phase-transition',
        lobbyId: ctx.lobbyId,
        from: 'showing',
        to: 'input',
        sequence: data.sequence,
        sequenceIds: data._extra.sequence,
        timeRemaining: mb.timeRemaining,
      }, '[Deadlock] Phase transition: showing → input');
    }

    // Parse lock index from entity ID
    const match = entityId.match(/^mb_lock_(\d+)$/);
    if (!match) {
      logger.info({
        miniBoss: 'deadlock',
        event: 'click-invalid-entity',
        lobbyId: ctx.lobbyId,
        pid,
        entityId,
      }, '[Deadlock] Click on non-lock entity');
      return;
    }
    const clickedIndex = parseInt(match[1], 10);
    const expectedIndex = data.sequence[data.inputIndex];

    if (clickedIndex === expectedIndex) {
      // Correct click!
      data.inputIndex++;
      data._extra.inputIndex = data.inputIndex;

      logger.info({
        miniBoss: 'deadlock',
        event: 'click-correct',
        lobbyId: ctx.lobbyId,
        pid,
        clickedLock: clickedIndex,
        expectedLock: expectedIndex,
        inputProgress: `${data.inputIndex}/${data.sequence.length}`,
        round: data.round,
        bossHp: data.bossHp,
      }, '[Deadlock] Correct lock clicked');

      if (data.inputIndex >= data.sequence.length) {
        // Sequence complete! Deal damage
        const hpBefore = data.bossHp;
        data.bossHp = Math.max(0, data.bossHp - DAMAGE_PER_SEQUENCE);
        data._extra.bossHp = data.bossHp;
        data.round++;

        logger.info({
          miniBoss: 'deadlock',
          event: 'sequence-complete',
          lobbyId: ctx.lobbyId,
          pid,
          round: data.round - 1,
          bossHpBefore: hpBefore,
          bossHpAfter: data.bossHp,
          damage: DAMAGE_PER_SEQUENCE,
          timeRemaining: mb.timeRemaining,
        }, '[Deadlock] Sequence complete — boss takes damage');

        if (data.bossHp > 0) {
          // Start next round
          startShowingPhase(data);
          const showDurationMs = SHOW_PAUSE_MS + sequenceLengthForRound(data.round) * SHOW_DURATION_PER_LOCK_MS + SHOW_PAUSE_MS;
          logger.info({
            miniBoss: 'deadlock',
            event: 'round-start',
            lobbyId: ctx.lobbyId,
            round: data.round,
            sequenceLength: data.sequence.length,
            sequence: data.sequence,
            sequenceIds: data._extra.sequence,
            showDurationMs,
            bossHp: data.bossHp,
            timeRemaining: mb.timeRemaining,
          }, '[Deadlock] New round started');

          ctx.events.emit({
            type: 'mini-boss-entity-update',
            entities: mb.entities,
            warning: 'Sequence complete! Boss takes damage!',
            extra: { ...data._extra },
          });
        } else {
          ctx.events.emit({
            type: 'mini-boss-entity-update',
            entities: mb.entities,
            extra: { ...data._extra },
          });
        }
        return;
      }

      // Partial progress
      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        extra: { ...data._extra },
      });
    } else {
      // Wrong click! Boss heals, restart sequence
      const hpBefore = data.bossHp;
      data.bossHp = Math.min(BOSS_HP, data.bossHp + HEAL_ON_FAIL);
      data._extra.bossHp = data.bossHp;
      startShowingPhase(data);

      logger.warn({
        miniBoss: 'deadlock',
        event: 'click-wrong',
        lobbyId: ctx.lobbyId,
        pid,
        clickedLock: clickedIndex,
        expectedLock: expectedIndex,
        inputProgressAtFail: `${data.inputIndex}/${data.sequence.length}`,
        round: data.round,
        bossHpBefore: hpBefore,
        bossHpAfter: data.bossHp,
        healAmount: HEAL_ON_FAIL,
        newSequence: data.sequence,
        timeRemaining: mb.timeRemaining,
      }, '[Deadlock] Wrong lock — boss heals, sequence reset');

      ctx.events.emit({
        type: 'mini-boss-entity-update',
        entities: mb.entities,
        warning: 'Wrong! Boss heals. Watch the new sequence...',
        extra: { ...data._extra },
      });
    }
  },

  onTick(ctx: GameContext): void {
    const mb = ctx.state.miniBoss;
    if (!mb) return;

    const data = mb.data as unknown as DeadlockData;
    const now = Date.now();

    // Auto-transition from showing to input when time expires
    if (data.phase === 'showing' && now >= data.showingUntil) {
      data.phase = 'input';
      data._extra.phase = 'input';
      logger.info({
        miniBoss: 'deadlock',
        event: 'phase-transition-tick',
        lobbyId: ctx.lobbyId,
        from: 'showing',
        to: 'input',
        sequence: data.sequence,
        timeRemaining: mb.timeRemaining,
      }, '[Deadlock] Phase transition via tick: showing → input');
    }

    logger.info({
      miniBoss: 'deadlock',
      event: 'tick',
      lobbyId: ctx.lobbyId,
      timeRemaining: mb.timeRemaining,
      phase: data.phase,
      round: data.round,
      bossHp: data.bossHp,
      inputProgress: data.phase === 'input' ? `${data.inputIndex}/${data.sequence.length}` : 'n/a',
      showingRemainingMs: data.phase === 'showing' ? Math.max(0, data.showingUntil - now) : 0,
    }, '[Deadlock] Tick');
  },

  checkVictory(ctx: GameContext): boolean {
    const mb = ctx.state.miniBoss;
    if (!mb) return false;
    const data = mb.data as unknown as DeadlockData;
    const victory = data.bossHp <= 0;
    if (victory) {
      logger.info({
        miniBoss: 'deadlock',
        event: 'victory',
        lobbyId: ctx.lobbyId,
        timeRemaining: mb.timeRemaining,
        roundsCompleted: data.round - 1,
      }, '[Deadlock] Victory condition met');
    }
    return victory;
  },
};
