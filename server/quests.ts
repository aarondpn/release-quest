import logger from './logger.ts';
import * as db from './db.ts';
import type { QuestDefinition, UserQuestRow } from './types.ts';

// ── Quest Pools ──

const DAILY_QUESTS: QuestDefinition[] = [
  { key: 'daily_squash_20', type: 'daily', title: 'Bug Swatter', description: 'Squash 20 bugs', icon: '🐛', target: 20, rewardMin: 10, rewardMax: 15, metric: 'bugs_squashed' },
  { key: 'daily_squash_40', type: 'daily', title: 'Exterminator', description: 'Squash 40 bugs', icon: '🔨', target: 40, rewardMin: 15, rewardMax: 25, metric: 'bugs_squashed' },
  { key: 'daily_win_1', type: 'daily', title: 'Victory Lap', description: 'Win a game', icon: '🏆', target: 1, rewardMin: 15, rewardMax: 20, metric: 'games_won' },
  { key: 'daily_play_3', type: 'daily', title: 'Regular', description: 'Play 3 games', icon: '🎮', target: 3, rewardMin: 10, rewardMax: 15, metric: 'games_played' },
  { key: 'daily_play_5', type: 'daily', title: 'Dedicated', description: 'Play 5 games', icon: '🕹️', target: 5, rewardMin: 15, rewardMax: 20, metric: 'games_played' },
  { key: 'daily_score_500', type: 'daily', title: 'High Scorer', description: 'Score 500+ in one game', icon: '⭐', target: 500, rewardMin: 15, rewardMax: 25, metric: 'single_game_score' },
  { key: 'daily_score_300', type: 'daily', title: 'Points Collector', description: 'Score 300+ in one game', icon: '💎', target: 300, rewardMin: 10, rewardMax: 15, metric: 'single_game_score' },
  { key: 'daily_total_800', type: 'daily', title: 'Score Grinder', description: 'Earn 800 total score', icon: '📊', target: 800, rewardMin: 15, rewardMax: 20, metric: 'total_score' },
  { key: 'daily_squash_10', type: 'daily', title: 'Quick Squash', description: 'Squash 10 bugs', icon: '👟', target: 10, rewardMin: 10, rewardMax: 12, metric: 'bugs_squashed' },
];

const WEEKLY_QUESTS: QuestDefinition[] = [
  { key: 'weekly_squash_100', type: 'weekly', title: 'Bug Hunter', description: 'Squash 100 bugs', icon: '🎯', target: 100, rewardMin: 50, rewardMax: 75, metric: 'bugs_squashed' },
  { key: 'weekly_squash_200', type: 'weekly', title: 'Pest Control', description: 'Squash 200 bugs', icon: '🧹', target: 200, rewardMin: 75, rewardMax: 100, metric: 'bugs_squashed' },
  { key: 'weekly_win_5', type: 'weekly', title: 'Champion', description: 'Win 5 games', icon: '👑', target: 5, rewardMin: 60, rewardMax: 80, metric: 'games_won' },
  { key: 'weekly_play_15', type: 'weekly', title: 'Hardcore', description: 'Play 15 games', icon: '🔥', target: 15, rewardMin: 50, rewardMax: 70, metric: 'games_played' },
  { key: 'weekly_play_10', type: 'weekly', title: 'Committed', description: 'Play 10 games', icon: '📅', target: 10, rewardMin: 50, rewardMax: 60, metric: 'games_played' },
  { key: 'weekly_total_3000', type: 'weekly', title: 'Score Master', description: 'Earn 3000 total score', icon: '🌟', target: 3000, rewardMin: 60, rewardMax: 90, metric: 'total_score' },
  { key: 'weekly_win_3', type: 'weekly', title: 'Winner', description: 'Win 3 games', icon: '🥇', target: 3, rewardMin: 50, rewardMax: 65, metric: 'games_won' },
];

const QUEST_DEFS = new Map<string, QuestDefinition>();
for (const q of [...DAILY_QUESTS, ...WEEKLY_QUESTS]) {
  QUEST_DEFS.set(q.key, q);
}

// ── Period Helpers (UTC) ──

export function getDailyPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function getWeeklyPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

// ── Random Selection ──

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomReward(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Core Functions ──

export interface EnrichedQuest {
  id: number;
  key: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
  periodEnd: string;
}

export interface QuestData {
  quests: EnrichedQuest[];
  balance: number;
  totalEarned: number;
  dailyResetAt: string;
  weeklyResetAt: string;
}

function enrichQuest(row: UserQuestRow): EnrichedQuest {
  const def = QUEST_DEFS.get(row.quest_key);
  return {
    id: row.id,
    key: row.quest_key,
    type: row.quest_type,
    title: def?.title ?? row.quest_key,
    description: def?.description ?? '',
    icon: def?.icon ?? '❓',
    progress: row.progress,
    target: row.target,
    reward: row.reward,
    completed: row.completed,
    claimed: row.claimed,
    periodEnd: row.period_end.toISOString(),
  };
}

export async function getOrAssignQuests(userId: number): Promise<QuestData> {
  const daily = getDailyPeriod();
  const weekly = getWeeklyPeriod();

  let rows = await db.getActiveQuests(userId);

  const hasDailyForPeriod = rows.some(r => r.quest_type === 'daily' && new Date(r.period_end).getTime() >= daily.end.getTime());
  const hasWeeklyForPeriod = rows.some(r => r.quest_type === 'weekly' && new Date(r.period_end).getTime() >= weekly.end.getTime());

  const toAssign: { questKey: string; questType: string; target: number; reward: number; periodStart: Date; periodEnd: Date }[] = [];

  if (!hasDailyForPeriod) {
    const picked = pickRandom(DAILY_QUESTS, 3);
    for (const q of picked) {
      toAssign.push({
        questKey: q.key,
        questType: 'daily',
        target: q.target,
        reward: randomReward(q.rewardMin, q.rewardMax),
        periodStart: daily.start,
        periodEnd: daily.end,
      });
    }
  }

  if (!hasWeeklyForPeriod) {
    const picked = pickRandom(WEEKLY_QUESTS, 2);
    for (const q of picked) {
      toAssign.push({
        questKey: q.key,
        questType: 'weekly',
        target: q.target,
        reward: randomReward(q.rewardMin, q.rewardMax),
        periodStart: weekly.start,
        periodEnd: weekly.end,
      });
    }
  }

  if (toAssign.length > 0) {
    const newRows = await db.assignQuests(userId, toAssign);
    rows = [...rows.filter(r => {
      if (r.quest_type === 'daily' && !hasDailyForPeriod) return false;
      if (r.quest_type === 'weekly' && !hasWeeklyForPeriod) return false;
      return true;
    }), ...newRows];
  }

  // Only return current-period quests
  const activeRows = rows.filter(r => {
    const end = new Date(r.period_end);
    if (r.quest_type === 'daily') return end.getTime() >= daily.end.getTime();
    return end.getTime() >= weekly.end.getTime();
  });

  const currency = await db.getCurrencyBalance(userId);

  return {
    quests: activeRows.map(enrichQuest),
    balance: currency.balance,
    totalEarned: currency.totalEarned,
    dailyResetAt: daily.end.toISOString(),
    weeklyResetAt: weekly.end.toISOString(),
  };
}

export interface QuestProgressUpdate {
  questId: number;
  key: string;
  title: string;
  icon: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: number;
  newBalance: number | null;
}

export async function processQuestProgress(
  userId: number,
  gameResult: { score: number; won: boolean; bugsSquashed: number }
): Promise<QuestProgressUpdate[]> {
  const rows = await db.getActiveQuests(userId);
  const updates: QuestProgressUpdate[] = [];

  for (const row of rows) {
    if (row.completed) continue;

    const def = QUEST_DEFS.get(row.quest_key);
    if (!def) continue;

    let increment = 0;
    switch (def.metric) {
      case 'bugs_squashed':
        increment = gameResult.bugsSquashed;
        break;
      case 'games_played':
        increment = 1;
        break;
      case 'games_won':
        increment = gameResult.won ? 1 : 0;
        break;
      case 'single_game_score':
        // For single_game_score, progress is the max score seen
        increment = 0; // handled specially below
        break;
      case 'total_score':
        increment = gameResult.score;
        break;
    }

    let newProgress: number;
    if (def.metric === 'single_game_score') {
      newProgress = Math.max(row.progress, gameResult.score);
    } else {
      newProgress = row.progress + increment;
    }

    if (newProgress === row.progress) continue;

    const completed = newProgress >= row.target;
    await db.updateQuestProgress(row.id, newProgress, completed);

    let newBalance: number | null = null;
    if (completed && !row.claimed) {
      await db.markQuestClaimed(row.id);
      newBalance = await db.addCurrency(userId, row.reward);
    }

    updates.push({
      questId: row.id,
      key: row.quest_key,
      title: def.title,
      icon: def.icon,
      progress: newProgress,
      target: row.target,
      completed,
      reward: row.reward,
      newBalance,
    });
  }

  return updates;
}
