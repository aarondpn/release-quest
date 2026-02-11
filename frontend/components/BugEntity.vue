<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { BugData } from '../composables/useGameState';
import { gameState } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import { logicalToPixel } from '../composables/useCoordinates';

const props = defineProps<{
  bugId: string;
  bug: BugData;
}>();

const pos = computed(() => logicalToPixel(props.bug.x, props.bug.y));

const bugStyle = computed(() => {
  const style: Record<string, string> = {
    left: pos.value.x + 'px',
    top: pos.value.y + 'px',
  };
  if (props.bug.transition) {
    style.transition = props.bug.transition;
  }
  return style;
});

const bugClasses = computed(() => {
  const classes: Record<string, boolean> = {
    bug: true,
    walking: true,
    heisenbug: !!props.bug.isHeisenbug,
    'heisenbug-stabilized': !!props.bug.stabilized,
    'memory-leak': !!props.bug.isMemoryLeak,
    'feature-bug': !!props.bug.featureRevealed,
    'merge-left': props.bug.mergeSide === 'left',
    'merge-right': props.bug.mergeSide === 'right',
    'pipeline-bug': !!props.bug.isPipeline,
    popping: !!props.bug.popping,
    'being-held': !!props.bug.beingHeld,
    stunned: !!props.bug.stunned,
    'merge-halfclick': !!props.bug.mergeHalfclick,
    'pipeline-reset': !!props.bug.pipelineReset,
    'feature-leaving': !!props.bug.featureLeaving,
  };
  return classes;
});

// Memory leak hold progress animation
const holdProgressStyle = computed(() => {
  if (!props.bug.beingHeld || !props.bug.holdStartTime || !props.bug.requiredHoldTime) return { width: '0%' };
  // The progress is animated via CSS transition, so we just return the target
  return { width: '100%' };
});

const holdProgressTransition = computed(() => {
  if (!props.bug.beingHeld || !props.bug.holdStartTime || !props.bug.requiredHoldTime || !props.bug.holderCount) return 'none';
  const elapsed = Date.now() - props.bug.holdStartTime;
  const effectiveTime = props.bug.requiredHoldTime / props.bug.holderCount;
  const remaining = Math.max(0, effectiveTime - elapsed);
  return `width ${remaining}ms linear`;
});

// Click handlers
function handleClick(e: MouseEvent) {
  e.stopPropagation();
  if (props.bug.isMemoryLeak) return; // handled by mousedown/mouseup
  sendMessage({ type: 'click-bug', bugId: props.bugId });
}

function handleMouseDown(e: MouseEvent) {
  if (!props.bug.isMemoryLeak) return;
  e.stopPropagation();
  e.preventDefault();
  sendMessage({ type: 'click-memory-leak-start', bugId: props.bugId });
}

function handleMouseUp(e: MouseEvent) {
  if (!props.bug.isMemoryLeak) return;
  e.stopPropagation();
  sendMessage({ type: 'click-memory-leak-complete', bugId: props.bugId });
}

function handleMouseLeave(e: MouseEvent) {
  if (!props.bug.isMemoryLeak) return;
  // Only send complete if we were holding (beingHeld is set when server responds)
  sendMessage({ type: 'click-memory-leak-complete', bugId: props.bugId });
}
</script>

<template>
  <div
    :class="bugClasses"
    :style="bugStyle"
    :data-bug-id="bugId"
    :data-growth-stage="bug.growthStage ?? 0"
    :data-chain-id="bug.chainId"
    :data-chain-index="bug.chainIndex"
    :data-chain-length="bug.chainLength"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <div class="bug-body">
      <div class="bug-eyes">&middot;&middot;</div>
      <div class="bug-legs">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
      </div>
    </div>

    <!-- Memory leak hold progress -->
    <template v-if="bug.isMemoryLeak && bug.beingHeld">
      <div class="memory-leak-progress">
        <div
          class="memory-leak-progress-fill"
          :style="{ ...holdProgressStyle, transition: holdProgressTransition }"
        ></div>
      </div>
      <div v-if="(bug.holderCount ?? 0) > 1" class="memory-leak-holder-count">
        x{{ bug.holderCount }}
      </div>
    </template>
  </div>
</template>
