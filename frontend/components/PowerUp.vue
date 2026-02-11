<script setup lang="ts">
import { computed } from 'vue';
import type { PowerUpData } from '../composables/useGameState';
import { sendMessage } from '../composables/useWebSocket';
import { logicalToPixel } from '../composables/useCoordinates';

const props = defineProps<{
  type: 'duck' | 'hammer';
  data: PowerUpData;
}>();

const pos = computed(() => logicalToPixel(props.data.x, props.data.y));

const style = computed(() => {
  const s: Record<string, string> = {
    left: pos.value.x + 'px',
    top: pos.value.y + 'px',
  };
  if (props.data.transition) {
    s.transition = props.data.transition;
  }
  return s;
});

function handleClick(e: MouseEvent) {
  e.stopPropagation();
  sendMessage({ type: props.type === 'duck' ? 'click-duck' : 'click-hammer' });
}
</script>

<template>
  <div
    :class="type === 'duck' ? 'rubber-duck' : 'hotfix-hammer'"
    :style="style"
    @click="handleClick"
  ></div>
</template>
