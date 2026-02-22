import { getPlayerScores, awardScore } from './state.ts';
import * as roguelike from './roguelike.ts';
import { endGame } from './game.ts';
import { mulberry32, hashString } from './rng.ts';
import { tallyVotes, isSoloMode } from './vote-utils.ts';
import logger from './logger.ts';
import type { GameContext, EventDefinition, EventModifiers } from './types.ts';

// ── Event pool ──

interface EventPoolEntry {
  definition: EventDefinition;
  resolve(optionId: string, ctx: GameContext): { modifiers: EventModifiers; summary: string };
}

const EVENT_POOL: EventPoolEntry[] = [
  {
    definition: {
      id: 'praktikant',
      title: 'Der Praktikant',
      description: 'Ein Praktikant bietet an, "ein paar Bugs zu fixen". Klingt zu gut um wahr zu sein...',
      icon: '\u{1F468}\u200D\u{1F4BB}',
      options: [
        { id: 'accept', label: 'Annehmen', description: '+50% Score, aber +25% mehr Bugs', icon: '\u2705' },
        { id: 'decline', label: 'Ablehnen', description: 'Sicherer Weg: +20 Score pro Spieler', icon: '\u274C' },
      ],
    },
    resolve(optionId, ctx) {
      const playerCount = Object.keys(ctx.state.players).length;
      if (optionId === 'accept') {
        return {
          modifiers: { bugsTotalMultiplier: 1.25, scoreMultiplier: 1.5 },
          summary: '+50% Score, +25% Bugs im nächsten Kampf',
        };
      }
      return {
        modifiers: { scoreChange: 20 * playerCount },
        summary: `+${20 * playerCount} Score (sicherer Weg)`,
      };
    },
  },
  {
    definition: {
      id: 'tech-debt',
      title: 'Technische Schulden',
      description: 'Der Tech-Debt-Berg wächst. Jetzt refactorn oder später büßen?',
      icon: '\u{1F4DA}',
      options: [
        { id: 'refactor', label: 'Refactorn', description: '-15 HP, aber 2x Score', icon: '\u{1F527}' },
        { id: 'ignore', label: 'Ignorieren', description: '+25% mehr Bugs', icon: '\u{1F648}' },
      ],
    },
    resolve(optionId) {
      if (optionId === 'refactor') {
        return {
          modifiers: { hpChange: -15, scoreMultiplier: 2 },
          summary: '-15 HP, 2x Score im nächsten Kampf',
        };
      }
      return {
        modifiers: { bugsTotalMultiplier: 1.25 },
        summary: '+25% Bugs im nächsten Kampf',
      };
    },
  },
  {
    definition: {
      id: 'code-freeze',
      title: 'Code Freeze',
      description: 'Das Management hat einen Code Freeze angeordnet. Keine Experimente!',
      icon: '\u2744\uFE0F',
      options: [
        { id: 'comply', label: 'Einhalten', description: 'Nur normale Bugs (keine Spezialtypen)', icon: '\u{1F9CA}' },
        { id: 'rebel', label: 'Ignorieren', description: 'Weiter wie bisher', icon: '\u{1F525}' },
      ],
    },
    resolve(optionId) {
      if (optionId === 'comply') {
        return {
          modifiers: { onlyNormalBugs: true },
          summary: 'Nur normale Bugs im nächsten Kampf',
        };
      }
      return { modifiers: {}, summary: 'Keine Änderung' };
    },
  },
  {
    definition: {
      id: 'usb-stick',
      title: 'Mysteriöser USB-Stick',
      description: 'Jemand hat einen USB-Stick im Pausenraum vergessen. Einstecken?',
      icon: '\u{1F4BE}',
      options: [
        { id: 'plug', label: 'Einstecken', description: '50/50: +50 Score oder -20 HP', icon: '\u{1F50C}' },
        { id: 'ignore', label: 'Liegen lassen', description: 'Sicherheit geht vor', icon: '\u{1F6AB}' },
      ],
    },
    resolve(optionId, ctx) {
      if (optionId === 'plug') {
        // Use seeded RNG for deterministic outcome in roguelike
        const seed = (ctx.state.roguelikeMap?.seed ?? Date.now()) + hashString('usb-stick-outcome');
        const rng = mulberry32(seed);
        const lucky = rng() < 0.5;
        if (lucky) {
          return {
            modifiers: { scoreChange: 50 },
            summary: '+50 Score! Der Stick enthielt Bonus-Code!',
          };
        }
        return {
          modifiers: { hpChange: -20 },
          summary: '-20 HP! Der Stick enthielt Malware!',
        };
      }
      return { modifiers: {}, summary: 'Keine Änderung' };
    },
  },
  {
    definition: {
      id: 'security-audit',
      title: 'Security Audit',
      description: 'Das Security-Team bietet einen Audit an. Gründlich, aber stressig.',
      icon: '\u{1F6E1}\uFE0F',
      options: [
        { id: 'accept', label: 'Audit starten', description: 'Feature-Bugs leuchten rot, aber kürzere Escape-Zeit', icon: '\u{1F50D}' },
        { id: 'skip', label: 'Überspringen', description: 'Keine Änderung', icon: '\u23ED\uFE0F' },
      ],
    },
    resolve(optionId) {
      if (optionId === 'accept') {
        return {
          modifiers: { grantEagleEye: true, escapeTimeOffset: -3000 },
          summary: 'Eagle Eye aktiv, aber Bugs entkommen schneller',
        };
      }
      return { modifiers: {}, summary: 'Keine Änderung' };
    },
  },
  {
    definition: {
      id: 'hackathon',
      title: 'Hackathon',
      description: 'Das Team will einen spontanen Hackathon machen. Intensiv, aber effektiv!',
      icon: '\u{1F680}',
      options: [
        { id: 'join', label: 'Mitmachen', description: 'Halb so viele Bugs, aber doppelt so schnell', icon: '\u26A1' },
        { id: 'skip', label: 'Passen', description: 'Keine Änderung', icon: '\u{1F634}' },
      ],
    },
    resolve(optionId) {
      if (optionId === 'join') {
        return {
          modifiers: { bugsTotalMultiplier: 0.5, spawnRateMultiplier: 2 },
          summary: '50% weniger Bugs, aber 2x Spawn-Rate',
        };
      }
      return { modifiers: {}, summary: 'Keine Änderung' };
    },
  },
];

// ── Core functions ──

const EVENT_VOTE_TIMER_MS = 15000;

export function pickEventDefinition(seed: number, nodeId: string): EventDefinition {
  const combined = seed + hashString(nodeId);
  const rng = mulberry32(combined);
  const idx = Math.floor(rng() * EVENT_POOL.length);
  return EVENT_POOL[idx].definition;
}

export function showEvent(ctx: GameContext, nodeId: string): void {
  const { state } = ctx;
  if (!state.roguelikeMap) return;

  const event = pickEventDefinition(state.roguelikeMap.seed, nodeId);
  state.activeEventId = event.id;
  state.eventVotes = {};

  ctx.lifecycle.transition(state, 'event');

  const soloMode = isSoloMode(state.players);

  logger.info({ lobbyId: ctx.lobbyId, eventId: event.id, soloMode }, 'Event shown');

  ctx.events.emit({
    type: 'event-show',
    event,
    soloMode,
  });

  if (!soloMode) {
    state.voteDeadline = Date.now() + EVENT_VOTE_TIMER_MS;
    ctx.timers.lobby.setTimeout('eventVoteTimer', () => {
      resolveEventVote(ctx);
    }, EVENT_VOTE_TIMER_MS);
  }
}

export function handleEventVote(ctx: GameContext, pid: string, optionId: string): void {
  const { state } = ctx;
  if (state.phase !== 'event' || !state.activeEventId) return;

  // Validate option exists
  const entry = EVENT_POOL.find(e => e.definition.id === state.activeEventId);
  if (!entry) return;
  const validOption = entry.definition.options.some(o => o.id === optionId);
  if (!validOption) return;

  if (!state.eventVotes) state.eventVotes = {};
  state.eventVotes[pid] = optionId;

  const soloMode = isSoloMode(state.players);

  if (soloMode) {
    resolveEventVote(ctx);
    return;
  }

  const timeRemaining = state.voteDeadline ? Math.max(0, state.voteDeadline - Date.now()) : 0;
  ctx.events.emit({
    type: 'event-vote-update',
    votes: state.eventVotes,
    timeRemaining,
  });

  // Check if all players voted
  const votedCount = Object.keys(state.eventVotes).length;
  if (votedCount >= Object.keys(state.players).length) {
    resolveEventVote(ctx);
  }
}

function resolveEventVote(ctx: GameContext): void {
  const { state } = ctx;
  ctx.timers.lobby.clear('eventVoteTimer');

  if (!state.activeEventId || !state.eventVotes) return;

  const entry = EVENT_POOL.find(e => e.definition.id === state.activeEventId);
  if (!entry) return;

  // Grab votes and immediately clear to prevent re-entrancy
  const votes = state.eventVotes;
  state.eventVotes = undefined;

  // Count votes and find winner
  const candidates = entry.definition.options.map(o => o.id);
  const chosenOptionId = tallyVotes(votes, candidates);

  // Resolve effects
  const { modifiers, summary } = entry.resolve(chosenOptionId, ctx);

  // Apply instant effects (HP/score changes)
  let hpChange: number | undefined;
  let scoreChange: number | undefined;

  if (modifiers.hpChange) {
    hpChange = modifiers.hpChange;
    state.hp = Math.max(0, state.hp + modifiers.hpChange);
  }
  if (modifiers.scoreChange) {
    scoreChange = modifiers.scoreChange;
    // Distribute score evenly among all players via awardScore
    const playerIds = Object.keys(state.players);
    if (playerIds.length > 0) {
      const perPlayer = Math.floor(modifiers.scoreChange / playerIds.length);
      const remainder = modifiers.scoreChange - perPlayer * playerIds.length;
      for (let i = 0; i < playerIds.length; i++) {
        awardScore(ctx, playerIds[i], perPlayer + (i === 0 ? remainder : 0));
      }
    }
  }

  // Store combat modifiers for next fight
  const combatModifiers: EventModifiers = {};
  if (modifiers.bugsTotalMultiplier) combatModifiers.bugsTotalMultiplier = modifiers.bugsTotalMultiplier;
  if (modifiers.escapeTimeOffset) combatModifiers.escapeTimeOffset = modifiers.escapeTimeOffset;
  if (modifiers.spawnRateMultiplier) combatModifiers.spawnRateMultiplier = modifiers.spawnRateMultiplier;
  if (modifiers.scoreMultiplier) combatModifiers.scoreMultiplier = modifiers.scoreMultiplier;
  if (modifiers.grantEagleEye) combatModifiers.grantEagleEye = modifiers.grantEagleEye;
  if (modifiers.onlyNormalBugs) combatModifiers.onlyNormalBugs = modifiers.onlyNormalBugs;

  if (Object.keys(combatModifiers).length > 0) {
    state.eventModifiers = combatModifiers;
  }

  logger.info({
    lobbyId: ctx.lobbyId,
    eventId: state.activeEventId,
    chosenOptionId,
    hpChange,
    scoreChange,
    modifiers: combatModifiers,
  }, 'Event resolved');

  ctx.events.emit({
    type: 'event-resolved',
    eventId: state.activeEventId!,
    chosenOptionId,
    hpChange,
    scoreChange,
    newHp: state.hp,
    newScore: state.score,
    modifierSummary: summary,
  });

  // Check for game over from HP loss
  if (state.hp <= 0) {
    ctx.timers.lobby.setTimeout('eventGameOver', () => {
      endGame(ctx, 'loss', false);
    }, 2500);
    return;
  }

  // Clear remaining vote state
  state.activeEventId = undefined;
  state.voteDeadline = undefined;

  // After delay, return to map
  ctx.timers.lobby.setTimeout('eventComplete', () => {
    roguelike.handleNodeComplete(ctx);
  }, 2500);
}
