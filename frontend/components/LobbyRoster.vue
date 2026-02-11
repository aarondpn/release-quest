<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { gameState } from '../composables/useGameState';
import { LOBBY_TIPS } from '../config';

const players = computed(() => Object.values(gameState.players));

let tipTimer: ReturnType<typeof setInterval> | null = null;
let bugSpawner: ReturnType<typeof setInterval> | null = null;
let currentTipIndex = -1;
const tipText = ref('');
const tipAnim = ref('');

function rotateTip() {
  currentTipIndex = (currentTipIndex + 1) % LOBBY_TIPS.length;
  tipAnim.value = 'none';
  // Force reflow via timeout
  setTimeout(() => {
    tipText.value = LOBBY_TIPS[currentTipIndex];
    tipAnim.value = 'lobby-tip-slide 0.4s ease-out';
  }, 10);
}

function startAnimations() {
  rotateTip();
  tipTimer = setInterval(rotateTip, 5000);
  spawnLobbyBugs();
  bugSpawner = setInterval(spawnLobbyBugs, 3000);
}

function stopAnimations() {
  if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
  if (bugSpawner) { clearInterval(bugSpawner); bugSpawner = null; }
  const container = document.getElementById('lobby-bg-bugs');
  if (container) container.innerHTML = '';
}

let lobbyBugId = 0;

function spawnLobbyBugs() {
  const container = document.getElementById('lobby-bg-bugs');
  if (!container) return;

  container.style.setProperty('--arena-w', container.offsetWidth + 'px');
  container.style.setProperty('--arena-h', container.offsetHeight + 'px');

  if (container.children.length >= 8) return;

  const bug = document.createElement('div');
  const id = ++lobbyBugId;
  bug.dataset.id = String(id);

  const directions = ['crawl-right', 'crawl-left', 'crawl-down', 'crawl-up'];
  const dir = directions[Math.floor(Math.random() * directions.length)];
  const dur = 8 + Math.random() * 10;
  const delay = Math.random() * -dur;

  bug.className = 'lobby-bg-bug ' + dir;
  bug.style.setProperty('--crawl-dur', dur + 's');
  bug.style.setProperty('--crawl-delay', delay + 's');

  if (dir === 'crawl-right' || dir === 'crawl-left') {
    bug.style.top = (10 + Math.random() * 80) + '%';
  } else {
    bug.style.left = (10 + Math.random() * 80) + '%';
  }

  bug.innerHTML =
    '<div class="lobby-bg-bug-body">' +
      '<span class="lobby-bg-bug-eyes">oo</span>' +
    '</div>';

  bug.addEventListener('click', (e) => {
    e.stopPropagation();
    if (bug.classList.contains('squished')) return;
    bug.classList.add('squished');

    const rect = bug.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cx = rect.left - containerRect.left + rect.width / 2;
    const cy = rect.top - containerRect.top + rect.height / 2;

    const splat = document.createElement('div');
    splat.className = 'lobby-splat';
    splat.style.left = cx + 'px';
    splat.style.top = cy + 'px';

    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('div');
      dot.className = 'lobby-splat-dot';
      const angle = (Math.PI * 2 / 6) * i + Math.random() * 0.5;
      const dist = 8 + Math.random() * 14;
      dot.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
      dot.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
      splat.appendChild(dot);
    }
    container.appendChild(splat);

    setTimeout(() => {
      bug.remove();
      splat.remove();
    }, 400);
  });

  container.appendChild(bug);

  setTimeout(() => {
    if (bug.parentNode && !bug.classList.contains('squished')) {
      bug.remove();
    }
  }, dur * 1000);
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Start/stop animations based on start screen visibility
watch(() => gameState.activeScreen, (val, old) => {
  if (val === 'start') startAnimations();
  else if (old === 'start') stopAnimations();
}, { immediate: true });

onUnmounted(() => {
  stopAnimations();
});
</script>

<template>
  <div class="lobby-roster" id="lobby-roster">
    <div class="lobby-roster-label">{{ $t('roster.huntersInLobby') }}</div>
    <div class="lobby-roster-list" id="lobby-roster-list">
      <div
        v-for="(p, i) in players"
        :key="p.id"
        class="lobby-player-card"
        :class="{ 'is-me': p.id === gameState.myId }"
        :style="{ animationDelay: (i * 0.08) + 's' }"
      >
        <span class="lobby-player-icon">{{ p.icon || '' }}</span>
        <span class="lobby-player-name" v-html="escapeHtml(p.name)"></span>
        <span class="lobby-player-dot" :style="{ color: p.color || 'var(--teal)', background: p.color || 'var(--teal)' }"></span>
        <span v-if="p.id === gameState.myId" class="lobby-player-you">{{ $t('roster.you') }}</span>
      </div>
    </div>
  </div>

  <!-- Tips section is handled by parent ScreenOverlay which has the tip container -->
</template>

<script lang="ts">
// Export tip text for parent to use
</script>
