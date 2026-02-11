<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { CURSOR_THROTTLE_MS, LOGICAL_W, LOGICAL_H } from '../config';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import { setArenaElement, pixelToLogical, refreshArenaRect, logicalToPixel, getArenaRect } from '../composables/useCoordinates';
import { setVfxArena } from '../composables/useVfx';
import BugEntity from './BugEntity.vue';
import BossEntity from './BossEntity.vue';
import PowerUp from './PowerUp.vue';
import RemoteCursor from './RemoteCursor.vue';
import ScreenOverlay from './ScreenOverlay.vue';
import LiveDashboard from './LiveDashboard.vue';

const arenaRef = ref<HTMLElement | null>(null);
let lastCursorSend = 0;

onMounted(() => {
  setArenaElement(arenaRef.value);
  setVfxArena(arenaRef.value);
  refreshArenaRect();
});

onUnmounted(() => {
  setArenaElement(null);
  setVfxArena(null);
});

function handleMouseMove(e: MouseEvent) {
  const now = Date.now();
  if (now - lastCursorSend < CURSOR_THROTTLE_MS) return;
  lastCursorSend = now;

  if (!arenaRef.value) return;
  const rect = arenaRef.value.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const logical = pixelToLogical(px, py);

  sendMessage({
    type: 'cursor-move',
    x: Math.round(logical.x * 10) / 10,
    y: Math.round(logical.y * 10) / 10,
  });
}

// Compute tether lines for SVG rendering
const mergeTetherLines = computed(() => {
  const lines: { id: string; bug1: string; bug2: string }[] = [];
  for (const [cid, t] of Object.entries(gameState.mergeTethers)) {
    if (gameState.bugs[t.bug1] && gameState.bugs[t.bug2]) {
      lines.push({ id: cid, bug1: t.bug1, bug2: t.bug2 });
    }
  }
  return lines;
});

const pipelineTetherLines = computed(() => {
  const result: { chainId: string; segments: { from: string; to: string }[] }[] = [];
  for (const [chainId, bugIds] of Object.entries(gameState.pipelineTethers)) {
    const segments: { from: string; to: string }[] = [];
    for (let i = 0; i < bugIds.length - 1; i++) {
      if (gameState.bugs[bugIds[i]] && gameState.bugs[bugIds[i + 1]]) {
        segments.push({ from: bugIds[i], to: bugIds[i + 1] });
      }
    }
    if (segments.length > 0) {
      result.push({ chainId, segments });
    }
  }
  return result;
});

// Compute pixel positions for tethers
function bugPixelCenter(bugId: string): { x: number; y: number } | null {
  const bug = gameState.bugs[bugId];
  if (!bug) return null;
  const pos = logicalToPixel(bug.x, bug.y);
  return { x: pos.x, y: pos.y };
}

// Remote cursors (exclude self)
const remoteCursorEntries = computed(() => {
  const entries: { id: string; x: number; y: number; player: any }[] = [];
  for (const [pid, pos] of Object.entries(gameState.remoteCursors)) {
    if (pid === gameState.myId) continue;
    const player = gameState.players[pid];
    if (player) {
      entries.push({ id: pid, ...pos, player });
    }
  }
  return entries;
});

const bugEntries = computed(() => Object.entries(gameState.bugs));
</script>

<template>
  <div class="arena-wrap">
    <div class="arena" id="arena" ref="arenaRef" @mousemove="handleMouseMove">

      <!-- SVG tether layer -->
      <svg
        v-if="mergeTetherLines.length > 0 || pipelineTetherLines.length > 0"
        style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;"
      >
        <!-- Merge tethers -->
        <line
          v-for="t in mergeTetherLines"
          :key="'merge-' + t.id"
          :x1="bugPixelCenter(t.bug1)?.x ?? 0"
          :y1="bugPixelCenter(t.bug1)?.y ?? 0"
          :x2="bugPixelCenter(t.bug2)?.x ?? 0"
          :y2="bugPixelCenter(t.bug2)?.y ?? 0"
          stroke="#ffe66d"
          stroke-width="2"
          stroke-dasharray="6 4"
          opacity="0.7"
        />
        <!-- Pipeline tethers -->
        <template v-for="chain in pipelineTetherLines" :key="'chain-' + chain.chainId">
          <line
            v-for="(seg, i) in chain.segments"
            :key="'pipe-' + chain.chainId + '-' + i"
            :x1="bugPixelCenter(seg.from)?.x ?? 0"
            :y1="bugPixelCenter(seg.from)?.y ?? 0"
            :x2="bugPixelCenter(seg.to)?.x ?? 0"
            :y2="bugPixelCenter(seg.to)?.y ?? 0"
            stroke="#a855f7"
            stroke-width="2"
            stroke-dasharray="4 6"
            opacity="0.6"
          />
        </template>
      </svg>

      <!-- Bugs -->
      <BugEntity
        v-for="[bugId, bug] in bugEntries"
        :key="bugId"
        :bug-id="bugId"
        :bug="bug"
      />

      <!-- Boss -->
      <BossEntity v-if="gameState.boss" />

      <!-- Powerups -->
      <PowerUp v-if="gameState.duck" type="duck" :data="gameState.duck" />
      <PowerUp v-if="gameState.hammer" type="hammer" :data="gameState.hammer" />

      <!-- Remote cursors -->
      <RemoteCursor
        v-for="cursor in remoteCursorEntries"
        :key="cursor.id"
        :player-id="cursor.id"
        :x="cursor.x"
        :y="cursor.y"
        :name="cursor.player.name"
        :color="cursor.player.color"
        :icon="cursor.player.icon"
      />

      <!-- Screen overlays -->
      <ScreenOverlay />

      <!-- Live dashboard -->
      <LiveDashboard />
    </div>
  </div>
</template>
