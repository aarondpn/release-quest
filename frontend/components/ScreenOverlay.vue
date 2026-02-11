<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import LobbyRoster from './LobbyRoster.vue';

const { t } = useI18n();
const activeScreen = computed(() => gameState.activeScreen);
const screenData = computed(() => gameState.screenData);

function startGame() {
  sendMessage({ type: 'start-game' });
}

function leaveLobby() {
  sendMessage({ type: 'leave-lobby' });
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

const sortedPlayers = computed(() => {
  const players = screenData.value.players || [];
  return players.slice().sort((a: any, b: any) => b.score - a.score);
});
</script>

<template>
  <!-- Start / Lobby screen -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'start' }" id="start-screen">
    <div class="lobby-bg-bugs" id="lobby-bg-bugs"></div>

    <div class="lobby-title-wrap">
      <div class="lobby-title" :data-text="t('screens.startTitle')">{{ t('screens.startTitle') }}</div>
      <div class="lobby-subtitle">{{ t('screens.startSubtitle') }}</div>
    </div>

    <LobbyRoster />

    <div class="lobby-actions">
      <button class="btn lobby-start-btn" @click="startGame">
        <span class="lobby-start-icon">&#9654;</span> {{ t('screens.startHunt') }}
      </button>
      <button class="btn btn-leave" @click="leaveLobby">{{ t('lobby.leave') }}</button>
    </div>

    <div class="lobby-tips" id="lobby-tips">
      <span class="lobby-tips-label">{{ t('roster.tip') }}:</span>
      <span class="lobby-tips-text" id="lobby-tips-text"></span>
    </div>
  </div>

  <!-- Game Over screen -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'gameover' }">
    <div class="screen-title fail">{{ t('screens.gameOverTitle') }}</div>
    <div class="screen-sub">
      {{ t('screens.gameOverSubtitle') }}<br>
      {{ t('screens.gameOverMessage') }}
    </div>
    <div class="screen-stats">
      {{ t('screens.score') }}: <span>{{ screenData.score || 0 }}</span> &nbsp;|&nbsp;
      {{ t('screens.level') }}: <span>{{ screenData.level || 1 }}</span>
    </div>
    <div class="scoreboard">
      <div v-for="p in sortedPlayers" :key="p.id" class="scoreboard-row">
        <span class="scoreboard-name">
          <span style="font-size:14px;margin-right:4px">{{ p.icon || '' }}</span>
          <span v-html="escapeHtml(p.name)"></span>
          <template v-if="p.id === gameState.myId"> {{ t('screens.youLabel') }}</template>
        </span>
        <span class="scoreboard-points">{{ p.score }}</span>
      </div>
    </div>
    <button class="btn" @click="startGame">{{ t('screens.playAgain') }}</button>
    <button class="btn btn-leave" @click="leaveLobby">{{ t('lobby.leave') }}</button>
  </div>

  <!-- Win screen -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'win' }">
    <div class="screen-title win">{{ t('screens.winTitle') }}</div>
    <div class="screen-sub">
      {{ t('screens.winSubtitle') }}<br><br>
      {{ t('screens.winMessage') }}<br><br>
      <em style="color:var(--yellow)">{{ t('screens.winBonus') }}</em>
    </div>
    <div class="screen-stats">
      {{ t('screens.score') }}: <span>{{ screenData.score || 0 }}</span>
    </div>
    <div class="scoreboard">
      <div v-for="p in sortedPlayers" :key="p.id" class="scoreboard-row">
        <span class="scoreboard-name">
          <span style="font-size:14px;margin-right:4px">{{ p.icon || '' }}</span>
          <span v-html="escapeHtml(p.name)"></span>
          <template v-if="p.id === gameState.myId"> {{ t('screens.youLabel') }}</template>
        </span>
        <span class="scoreboard-points">{{ p.score }}</span>
      </div>
    </div>
    <button class="btn" @click="startGame">{{ t('screens.continue') }}</button>
    <button class="btn btn-leave" @click="leaveLobby">{{ t('lobby.leave') }}</button>
  </div>

  <!-- Level transition -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'level' }">
    <div class="screen-title">{{ t('screens.levelTitle') }} <span>{{ screenData.levelNum || 2 }}</span></div>
    <div class="screen-sub">{{ t('screens.levelSubtitle') }}</div>
  </div>

  <!-- Boss warning -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'boss' }">
    <div class="screen-title boss-title">{{ t('screens.bossWarning') }}</div>
    <div class="screen-sub">{{ t('screens.bossSubtitle') }}</div>
  </div>
</template>
