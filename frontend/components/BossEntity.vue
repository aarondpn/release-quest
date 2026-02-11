<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import { logicalToPixel } from '../composables/useCoordinates';

const boss = computed(() => gameState.boss);

const pos = computed(() => {
  if (!boss.value) return { x: 0, y: 0 };
  return logicalToPixel(boss.value.x, boss.value.y);
});

const bossStyle = computed(() => {
  const style: Record<string, string> = {
    left: pos.value.x + 'px',
    top: pos.value.y + 'px',
  };
  if (boss.value?.transition) {
    style.transition = boss.value.transition;
  }
  return style;
});

const bossClasses = computed(() => ({
  boss: true,
  walking: true,
  enraged: boss.value?.enraged ?? false,
  stunned: boss.value?.stunned ?? false,
}));

const hpPercent = computed(() => {
  if (!boss.value) return 100;
  return (boss.value.hp / boss.value.maxHp) * 100;
});

const hpText = computed(() => {
  if (!boss.value) return '';
  return boss.value.hp + '/' + boss.value.maxHp;
});

const timerText = computed(() => {
  if (!boss.value) return '1:30';
  return formatTime(boss.value.timeRemaining);
});

const timerUrgent = computed(() => {
  if (!boss.value) return false;
  return boss.value.timeRemaining <= 20;
});

// Explode animation
const exploding = ref(false);
watch(() => gameState.vfxEvents.length, () => {
  for (const evt of gameState.vfxEvents) {
    if (evt.type === 'boss-explode') {
      exploding.value = true;
    }
  }
});

const bossAnimStyle = computed(() => {
  if (exploding.value) return { animation: 'boss-explode 0.8s ease-in forwards' };
  return {};
});

function handleClick(e: MouseEvent) {
  e.stopPropagation();
  sendMessage({ type: 'click-boss' });
}

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
</script>

<template>
  <template v-if="boss">
    <div
      :class="bossClasses"
      :style="{ ...bossStyle, ...bossAnimStyle }"
      @click="handleClick"
    >
      <div class="boss-crown"><span></span><span></span><span></span></div>
      <div class="boss-body">
        <div class="boss-eyes">&times;&times;</div>
        <div class="boss-legs">
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <div class="boss-hp-bar-container">
      <div class="boss-timer" :class="{ urgent: timerUrgent }">{{ timerText }}</div>
      <div class="boss-hp-bar-label">MEGA BUG &mdash; <span class="boss-hp-text">{{ hpText }}</span></div>
      <div class="boss-hp-bar-track">
        <div class="boss-hp-bar-fill" :class="{ enraged: boss.enraged }" :style="{ width: hpPercent + '%' }"></div>
      </div>
    </div>
  </template>
</template>
