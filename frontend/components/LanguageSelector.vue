<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();
const isOpen = ref(false);

const languages = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'de', label: '🇩🇪 Deutsch' },
];

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectLanguage(lang: string) {
  locale.value = lang;
  localStorage.setItem('release-quest-lang', lang);
  isOpen.value = false;
}

function closeOnOutsideClick() {
  isOpen.value = false;
}

const currentLabel = computed(() => {
  const current = languages.find(l => l.code === locale.value);
  return current?.label || '🇬🇧 English';
});
</script>

<template>
  <div class="language-selector" @click.stop>
    <button class="language-selector-btn" @click="toggleDropdown">
      🌐 {{ currentLabel }}
    </button>
    <div v-if="isOpen" class="language-dropdown">
      <div
        v-for="lang in languages"
        :key="lang.code"
        class="language-option"
        :class="{ active: locale === lang.code }"
        @click="selectLanguage(lang.code)"
      >
        {{ lang.label }}
      </div>
    </div>
    <div v-if="isOpen" class="language-backdrop" @click="closeOnOutsideClick"></div>
  </div>
</template>

<style scoped>
.language-selector {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10000;
}

.language-selector-btn {
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid #00ff00;
  color: #00ff00;
  padding: 8px 16px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.language-selector-btn:hover {
  background: rgba(0, 255, 0, 0.1);
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid #00ff00;
  border-radius: 4px;
  min-width: 160px;
  box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
  z-index: 10001;
}

.language-option {
  padding: 12px 16px;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid rgba(0, 255, 0, 0.2);
}

.language-option:last-child {
  border-bottom: none;
}

.language-option:hover {
  background: rgba(0, 255, 0, 0.1);
}

.language-option.active {
  background: rgba(0, 255, 0, 0.2);
  font-weight: bold;
}

.language-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: transparent;
}
</style>
