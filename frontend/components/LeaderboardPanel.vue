<script setup lang="ts">
import { computed } from 'vue';
import { gameState } from '../composables/useGameState';

const entries = computed(() => gameState.leaderboardEntries);

const rankClasses = ['leaderboard-rank-gold', 'leaderboard-rank-silver', 'leaderboard-rank-bronze'];

function winRate(e: { games_played: number; games_won: number }): number {
  return e.games_played > 0 ? Math.round((e.games_won / e.games_played) * 100) : 0;
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>

<template>
  <div class="leaderboard-panel">
    <div class="leaderboard-header">{{ $t('leaderboard.title') }}</div>
    <div class="leaderboard-list">
      <div v-if="!entries.length" class="leaderboard-empty">{{ $t('leaderboard.noData') }}</div>
      <div
        v-for="(e, i) in entries"
        :key="i"
        class="leaderboard-row"
        :class="i < 3 ? rankClasses[i] : ''"
      >
        <span class="leaderboard-rank">{{ i + 1 }}</span>
        <span class="leaderboard-icon" v-html="escapeHtml(e.icon)"></span>
        <span class="leaderboard-name" v-html="escapeHtml(e.display_name)"></span>
        <span class="leaderboard-score">{{ Number(e.total_score).toLocaleString() }}</span>
        <span class="leaderboard-wins">{{ e.games_won }}W</span>
        <span class="leaderboard-winrate">{{ winRate(e) }}%</span>
      </div>
    </div>
  </div>
</template>
