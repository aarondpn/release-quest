<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PLAYER_ICONS } from '../config';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';

const nameInput = ref('');
const visible = computed(() => gameState.showNameEntry);
const nameInputEl = ref<HTMLInputElement | null>(null);

const selectedIcon = computed(() => gameState.selectedIcon);

function selectIcon(icon: string) {
  gameState.selectedIcon = icon;
}

function submitJoin() {
  if (!gameState.connected) return;
  let name: string;
  let icon: string | undefined;
  if (gameState.isLoggedIn && gameState.authUser) {
    name = nameInput.value.trim().slice(0, 16) || gameState.authUser.displayName;
    icon = gameState.selectedIcon || gameState.authUser.icon;
  } else {
    name = nameInput.value.trim().slice(0, 16) || gameState.myName || 'Anon';
    icon = gameState.selectedIcon || undefined;
  }
  gameState.myName = name;
  gameState.myIcon = icon || null;
  sendMessage({ type: 'set-name', name, icon });
  gameState.hasJoined = true;
  gameState.showNameEntry = false;
  gameState.showLobbyBrowser = true;
}

function showAuthOverlay() {
  gameState.showAuthOverlay = true;
}

function submitLogout() {
  const token = gameState.authToken;
  sendMessage({ type: 'logout', token });
}

// Initialize default selection
onMounted(() => {
  if (!gameState.selectedIcon) {
    gameState.selectedIcon = PLAYER_ICONS[0];
  }
  if (nameInputEl.value && visible.value) {
    nameInputEl.value.focus();
  }
});

// Sync name input from auth changes
import { watch } from 'vue';
watch(() => gameState.myName, (val) => {
  if (val && !nameInput.value) nameInput.value = val;
});
</script>

<template>
  <div class="name-entry" :class="{ hidden: !visible }">
    <div class="name-entry-title">BUG HUNTER</div>
    <div class="name-entry-sub">Choose your name &amp; icon</div>
    <input
      ref="nameInputEl"
      class="name-input"
      v-model="nameInput"
      type="text"
      placeholder="Your name..."
      maxlength="16"
      autocomplete="off"
      spellcheck="false"
      @keydown.enter="submitJoin"
    >
    <div class="icon-picker">
      <div class="icon-picker-label">Pick your hunter</div>
      <div
        v-for="icon in PLAYER_ICONS"
        :key="icon"
        class="icon-option"
        :class="{ selected: selectedIcon === icon }"
        @click="selectIcon(icon)"
      >{{ icon }}</div>
    </div>
    <button class="btn btn-play" @click="submitJoin">PLAY</button>
    <div class="auth-status">
      <span class="auth-guest-view" v-if="!gameState.isLoggedIn">
        <span class="auth-or">Have an account?</span>
        <button class="btn btn-link" @click="showAuthOverlay">LOG IN</button>
      </span>
      <span class="auth-logged-in-view" v-else>
        Logged in as <span class="auth-username">{{ gameState.authUser?.username }}</span>
        <button class="btn btn-link" @click="submitLogout">LOG OUT</button>
      </span>
    </div>
  </div>
</template>
