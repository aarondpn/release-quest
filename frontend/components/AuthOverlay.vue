<script setup lang="ts">
import { ref, computed } from 'vue';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';

const activeTab = ref<'login' | 'register'>('login');
const authError = ref('');
let errorTimer: ReturnType<typeof setTimeout> | null = null;

// Login fields
const loginUsername = ref('');
const loginPassword = ref('');

// Register fields
const regUsername = ref('');
const regDisplayName = ref('');
const regPassword = ref('');
const regConfirm = ref('');

const visible = computed(() => gameState.showAuthOverlay);

function showError(msg: string) {
  authError.value = msg;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { authError.value = ''; }, 4000);
}

function switchTab(tab: 'login' | 'register') {
  activeTab.value = tab;
  authError.value = '';
}

function submitLogin() {
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if (!username || !password) {
    showError('Please enter username and password');
    return;
  }
  sendMessage({ type: 'login', username, password });
}

function submitRegister() {
  const username = regUsername.value.trim();
  const displayName = regDisplayName.value.trim();
  const password = regPassword.value;
  const confirm = regConfirm.value;

  if (!username) { showError('Please enter a username'); return; }
  if (!password) { showError('Please enter a password'); return; }
  if (password.length < 6) { showError('Password must be at least 6 characters'); return; }
  if (password !== confirm) { showError('Passwords do not match'); return; }

  const icon = gameState.selectedIcon || undefined;
  sendMessage({ type: 'register', username, password, displayName: displayName || username, icon });
}

function close() {
  gameState.showAuthOverlay = false;
  clearForms();
}

function clearForms() {
  loginUsername.value = '';
  loginPassword.value = '';
  regUsername.value = '';
  regDisplayName.value = '';
  regPassword.value = '';
  regConfirm.value = '';
  authError.value = '';
}

// Listen for auth-error VFX events
import { watch } from 'vue';
watch(() => gameState.vfxEvents.length, () => {
  for (const evt of gameState.vfxEvents) {
    if (evt.type === 'auth-error') {
      showError(evt.error);
    }
  }
});
</script>

<template>
  <div class="auth-overlay" :class="{ hidden: !visible }" id="auth-overlay">
    <div class="auth-overlay-title">{{ $t('auth.loginTitle') }}</div>
    <div class="auth-tabs" id="auth-tabs">
      <button class="auth-tab" :class="{ active: activeTab === 'login' }" @click="switchTab('login')">{{ $t('auth.loginTitle') }}</button>
      <button class="auth-tab" :class="{ active: activeTab === 'register' }" @click="switchTab('register')">{{ $t('auth.registerTitle') }}</button>
    </div>

    <div class="auth-form" v-if="activeTab === 'login'">
      <input class="auth-input" v-model="loginUsername" type="text" :placeholder="$t('auth.username')" maxlength="16" autocomplete="off" spellcheck="false">
      <input class="auth-input" v-model="loginPassword" type="password" :placeholder="$t('auth.password')" maxlength="64" autocomplete="off" @keydown.enter="submitLogin">
      <button class="btn" @click="submitLogin">{{ $t('auth.loginButton') }}</button>
    </div>

    <div class="auth-form" v-if="activeTab === 'register'">
      <input class="auth-input" v-model="regUsername" type="text" :placeholder="$t('auth.username')" maxlength="16" autocomplete="off" spellcheck="false">
      <input class="auth-input" v-model="regDisplayName" type="text" :placeholder="$t('auth.displayName')" maxlength="16" autocomplete="off" spellcheck="false">
      <input class="auth-input" v-model="regPassword" type="password" :placeholder="$t('auth.password')" maxlength="64" autocomplete="off">
      <input class="auth-input" v-model="regConfirm" type="password" :placeholder="$t('auth.password')" maxlength="64" autocomplete="off" @keydown.enter="submitRegister">
      <button class="btn" @click="submitRegister">{{ $t('auth.registerButton') }}</button>
    </div>

    <div class="auth-error" :class="{ hidden: !authError }">{{ authError }}</div>
    <button class="btn btn-link auth-back-btn" @click="close">{{ $t('common.cancel') }}</button>
  </div>
</template>
