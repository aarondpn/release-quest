<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { gameState } from './composables/useGameState';
import { connect, disconnect } from './composables/useWebSocket';
import AuthOverlay from './components/AuthOverlay.vue';
import NameEntry from './components/NameEntry.vue';
import LobbyBrowser from './components/LobbyBrowser.vue';
import GameHud from './components/GameHud.vue';
import GameArena from './components/GameArena.vue';
import LanguageSelector from './components/LanguageSelector.vue';

const showHud = computed(() => gameState.currentLobbyId !== null);

onMounted(() => {
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<template>
  <LanguageSelector />
  
  <div class="conn-status" :class="gameState.connected ? 'connected' : 'disconnected'" id="conn-status">
    {{ gameState.connected ? $t('common.connected') : $t('common.disconnected') }}
  </div>

  <NameEntry />
  <AuthOverlay />
  <LobbyBrowser />

  <div class="wrapper">
    <header>
      <h1>{{ $t('header.title') }}</h1>
      <p>{{ $t('header.subtitle') }}</p>
      <a href="/overview.html" target="_blank" class="header-encyclopedia-link">&#x1F4DA; {{ $t('common.wiki') }}</a>
    </header>

    <GameHud v-if="showHud" />
    <GameArena />

    <div class="message-bar">
      {{ $t('header.tagline') }}
      &nbsp;&middot;&nbsp;
      <em>MULTIPLAYER</em>
    </div>
  </div>
</template>
