<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import LeaderboardPanel from './LeaderboardPanel.vue';

const visible = computed(() => gameState.showLobbyBrowser);
const lobbyNameInput = ref('');
const maxPlayers = ref(4);
const selectOpen = ref(false);
const lobbyError = ref('');
let errorTimer: ReturnType<typeof setTimeout> | null = null;
const activeTab = ref<'lobbies' | 'leaderboard'>('lobbies');

const playerOptions = [
  { value: 2, label: '2 players' },
  { value: 4, label: '4 players' },
  { value: 6, label: '6 players' },
  { value: 8, label: '8 players' },
];

const selectedLabel = computed(() => {
  const opt = playerOptions.find(o => o.value === maxPlayers.value);
  return (opt?.label || '4 players') + ' \u25BE';
});

function selectOption(value: number) {
  maxPlayers.value = value;
  selectOpen.value = false;
}

function createLobby() {
  const name = lobbyNameInput.value.trim().slice(0, 32) || 'Game Lobby';
  sendMessage({ type: 'create-lobby', name, maxPlayers: maxPlayers.value });
  lobbyNameInput.value = '';
}

function joinLobby(lobbyId: number) {
  sendMessage({ type: 'join-lobby', lobbyId });
}

function showLobbyError(message: string) {
  lobbyError.value = message;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { lobbyError.value = ''; }, 4000);
}

function switchToLeaderboard() {
  activeTab.value = 'leaderboard';
  sendMessage({ type: 'get-leaderboard' });
}

function switchToLobbies() {
  activeTab.value = 'lobbies';
}

// Close dropdown on outside click
function closeSelect() {
  selectOpen.value = false;
}

// Request lobby list when becoming visible
watch(visible, (val) => {
  if (val) {
    activeTab.value = 'lobbies';
    sendMessage({ type: 'list-lobbies' });
  }
});

// Listen for lobby-error VFX events
watch(() => gameState.vfxEvents.length, () => {
  for (const evt of gameState.vfxEvents) {
    if (evt.type === 'lobby-error') {
      showLobbyError(evt.message);
    }
  }
});

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>

<template>
  <div class="lobby-browser" :class="{ hidden: !visible }" @click="closeSelect">
    <div class="lobby-browser-title">GAME LOBBIES</div>
    <div class="lobby-browser-sub">Join or create a lobby</div>

    <div class="lobby-tabs">
      <button class="lobby-tab" :class="{ active: activeTab === 'lobbies' }" @click="switchToLobbies">LOBBIES</button>
      <button class="lobby-tab" :class="{ active: activeTab === 'leaderboard' }" @click="switchToLeaderboard">LEADERBOARD</button>
      <a href="/overview.html" class="lobby-tab lobby-tab-link" target="_blank">&#x1F4DA; WIKI</a>
    </div>

    <div v-if="activeTab === 'lobbies'" id="lobby-list-panel">
      <div class="lobby-create-form">
        <input
          class="lobby-name-input"
          v-model="lobbyNameInput"
          type="text"
          placeholder="Lobby name..."
          maxlength="32"
          autocomplete="off"
          spellcheck="false"
          @keydown.enter="createLobby"
        >
        <div class="custom-select" :class="{ open: selectOpen }" @click.stop>
          <div class="custom-select-trigger" @click="selectOpen = !selectOpen">{{ selectedLabel }}</div>
          <div class="custom-select-options">
            <div
              v-for="opt in playerOptions"
              :key="opt.value"
              class="custom-select-option"
              :class="{ selected: maxPlayers === opt.value }"
              @click="selectOption(opt.value)"
            >{{ opt.label }}</div>
          </div>
        </div>
        <button class="btn btn-small" @click="createLobby">CREATE</button>
      </div>

      <div class="lobby-list">
        <div v-if="!gameState.lobbies.length" class="lobby-list-empty">No lobbies yet. Create one!</div>
        <div v-for="lobby in gameState.lobbies" :key="lobby.id" class="lobby-list-item">
          <div class="lobby-list-info">
            <span class="lobby-list-name" v-html="escapeHtml(lobby.name)"></span>
            <span class="lobby-list-code">{{ lobby.code }}</span>
            <span class="lobby-list-players">{{ lobby.player_count }}/{{ lobby.max_players }}</span>
          </div>
          <button
            class="btn btn-small lobby-join-btn"
            :disabled="lobby.player_count >= lobby.max_players"
            @click="joinLobby(lobby.id)"
          >{{ lobby.player_count >= lobby.max_players ? 'FULL' : 'JOIN' }}</button>
        </div>
      </div>
    </div>

    <LeaderboardPanel v-if="activeTab === 'leaderboard'" />

    <div class="lobby-error" :class="{ hidden: !lobbyError }">{{ lobbyError }}</div>
  </div>
</template>
