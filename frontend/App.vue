<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { gameState } from './composables/useGameState';
import { connect, disconnect } from './composables/useWebSocket';
import AuthOverlay from './components/AuthOverlay.vue';
import NameEntry from './components/NameEntry.vue';
import LobbyBrowser from './components/LobbyBrowser.vue';
import GameHud from './components/GameHud.vue';
import GameArena from './components/GameArena.vue';

const showHud = computed(() => gameState.currentLobbyId !== null);

onMounted(() => {
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<template>
  <div class="conn-status" :class="gameState.connected ? 'connected' : 'disconnected'" id="conn-status">
    {{ gameState.connected ? 'CONNECTED' : 'DISCONNECTED' }}
  </div>

  <NameEntry />
  <AuthOverlay />
  <LobbyBrowser />

  <div class="wrapper">
    <header>
      <h1>RELEASE QUEST</h1>
      <p>Multiplayer Bug Hunt</p>
      <a href="/overview.html" target="_blank" class="header-encyclopedia-link">&#x1F4DA; Wiki</a>
    </header>

    <GameHud v-if="showHud" />
    <GameArena />

    <div class="message-bar">
      Wir sind Menschen. Wir machen Fehler. Wir werden besser.
      &nbsp;&middot;&nbsp;
      <em>MULTIPLAYER</em>
    </div>
  </div>
</template>
