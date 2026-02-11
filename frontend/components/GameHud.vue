<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';

const { t } = useI18n();
const score = computed(() => gameState.score);
const level = computed(() => {
  if (gameState.level === -1 || gameState.currentPhase === 'boss') return t('hud.boss');
  return gameState.level;
});
const hp = computed(() => gameState.hp);
const hpLow = computed(() => gameState.hp <= 25);
const playerCount = computed(() => Object.keys(gameState.players).length);
const showLeaveBtn = computed(() => gameState.currentLobbyId !== null);

function leaveLobby() {
  sendMessage({ type: 'leave-lobby' });
}
</script>

<template>
  <div class="hud">
    <div class="hud-item">
      <span class="hud-label">{{ $t('hud.score') }}</span>
      <span class="hud-value">{{ score }}</span>
    </div>
    <div class="hud-item">
      <span class="hud-label">{{ $t('hud.level') }}</span>
      <span class="hud-value">{{ level }}</span>
    </div>
    <div class="hud-item">
      <span class="hud-label">{{ $t('hud.hp') }}</span>
      <div class="hp-bar-track">
        <div class="hp-bar-fill" :class="{ low: hpLow }" :style="{ width: hp + '%' }"></div>
      </div>
    </div>
    <div class="hud-item">
      <span class="hud-label">{{ $t('hud.players') }}</span>
      <span class="hud-value">{{ playerCount }}</span>
    </div>
    <button class="hud-leave-btn" :class="{ hidden: !showLeaveBtn }" @click="leaveLobby">{{ $t('common.exit') }}</button>
  </div>
</template>
