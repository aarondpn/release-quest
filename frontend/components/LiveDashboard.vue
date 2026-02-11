<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted } from 'vue';
import { gameState } from '../composables/useGameState';

const containerRef = ref<HTMLElement | null>(null);

const visible = computed(() => {
  const phase = gameState.currentPhase;
  return gameState.currentLobbyId !== null && (phase === 'playing' || phase === 'boss');
});

const sortedPlayers = computed(() => {
  return Object.values(gameState.players)
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0));
});

// Track previous scores for delta display
const prevScores = ref<Record<string, number>>({});
const deltas = ref<Record<string, { amount: number; key: number }>>({});
let deltaKey = 0;

watch(sortedPlayers, (players) => {
  for (const p of players) {
    const prev = prevScores.value[p.id] || 0;
    const score = p.score || 0;
    if (score > prev && prev > 0) {
      deltas.value[p.id] = { amount: score - prev, key: ++deltaKey };
      // Auto-remove delta
      const k = deltaKey;
      setTimeout(() => {
        if (deltas.value[p.id]?.key === k) {
          delete deltas.value[p.id];
        }
      }, 800);
    }
    prevScores.value[p.id] = score;
  }
}, { deep: true });

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>

<template>
  <div ref="containerRef" class="live-dashboard" :class="{ hidden: !visible }">
    <div
      v-for="(p, i) in sortedPlayers"
      :key="p.id"
      class="live-dash-row"
      :class="{ 'is-me': p.id === gameState.myId }"
      :data-player-id="p.id"
    >
      <span class="live-dash-rank">{{ i + 1 }}</span>
      <span class="live-dash-name">
        <span class="live-dash-icon">{{ p.icon || '' }}</span>
        <span class="live-dash-name-text" v-html="escapeHtml(p.name)"></span>
      </span>
      <span class="live-dash-score">{{ p.score || 0 }}</span>
      <span v-if="deltas[p.id]" :key="deltas[p.id].key" class="live-dash-delta">+{{ deltas[p.id].amount }}</span>
    </div>
  </div>
</template>
