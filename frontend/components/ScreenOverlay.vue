<script setup lang="ts">
import { computed } from 'vue';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import LobbyRoster from './LobbyRoster.vue';

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
      <div class="lobby-title" data-text="BUG HUNTER">BUG HUNTER</div>
      <div class="lobby-subtitle">SQUASH THE INFESTATION</div>
    </div>

    <LobbyRoster />

    <div class="lobby-actions">
      <button class="btn lobby-start-btn" @click="startGame">
        <span class="lobby-start-icon">&#9654;</span> START HUNT
      </button>
      <button class="btn btn-leave" @click="leaveLobby">LEAVE LOBBY</button>
    </div>

    <div class="lobby-tips" id="lobby-tips">
      <span class="lobby-tips-label">TIP:</span>
      <span class="lobby-tips-text" id="lobby-tips-text"></span>
    </div>
  </div>

  <!-- Game Over screen -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'gameover' }">
    <div class="screen-title fail">GAME OVER</div>
    <div class="screen-sub">
      Die Bugs haben gewonnen...<br>
      Aber Menschen lernen aus Fehlern!
    </div>
    <div class="screen-stats">
      Score: <span>{{ screenData.score || 0 }}</span> &nbsp;|&nbsp;
      Level: <span>{{ screenData.level || 1 }}</span>
    </div>
    <div class="scoreboard">
      <div v-for="p in sortedPlayers" :key="p.id" class="scoreboard-row">
        <span class="scoreboard-name">
          <span style="font-size:14px;margin-right:4px">{{ p.icon || '' }}</span>
          <span v-html="escapeHtml(p.name)"></span>
          <template v-if="p.id === gameState.myId"> (you)</template>
        </span>
        <span class="scoreboard-points">{{ p.score }}</span>
      </div>
    </div>
    <button class="btn" @click="startGame">NOCHMAL</button>
    <button class="btn btn-leave" @click="leaveLobby">LEAVE LOBBY</button>
  </div>

  <!-- Win screen -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'win' }">
    <div class="screen-title win">LEVEL UP!</div>
    <div class="screen-sub">
      Alle Bugs gefixt!<br><br>
      Wir sind Menschen.<br>
      Wir machen Fehler.<br>
      Wir werden besser.<br><br>
      <em style="color:var(--yellow)">+100 XP Erfahrung</em>
    </div>
    <div class="screen-stats">
      Score: <span>{{ screenData.score || 0 }}</span>
    </div>
    <div class="scoreboard">
      <div v-for="p in sortedPlayers" :key="p.id" class="scoreboard-row">
        <span class="scoreboard-name">
          <span style="font-size:14px;margin-right:4px">{{ p.icon || '' }}</span>
          <span v-html="escapeHtml(p.name)"></span>
          <template v-if="p.id === gameState.myId"> (you)</template>
        </span>
        <span class="scoreboard-points">{{ p.score }}</span>
      </div>
    </div>
    <button class="btn" @click="startGame">CONTINUE</button>
    <button class="btn btn-leave" @click="leaveLobby">LEAVE LOBBY</button>
  </div>

  <!-- Level transition -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'level' }">
    <div class="screen-title">LEVEL <span>{{ screenData.levelNum || 2 }}</span></div>
    <div class="screen-sub">Get ready...</div>
  </div>

  <!-- Boss warning -->
  <div class="screen-overlay" :class="{ hidden: activeScreen !== 'boss' }">
    <div class="screen-title boss-title">WARNING</div>
    <div class="screen-sub">MEGA BUG incoming!</div>
  </div>
</template>
