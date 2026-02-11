<script setup lang="ts">
import { computed } from 'vue';
import { logicalToPixel } from '../composables/useCoordinates';

const props = defineProps<{
  playerId: string;
  x: number;
  y: number;
  name: string;
  color: string;
  icon: string;
}>();

const pos = computed(() => logicalToPixel(props.x, props.y));

const style = computed(() => ({
  color: props.color,
  transform: `translate(${pos.value.x}px, ${pos.value.y}px)`,
}));

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>

<template>
  <div class="remote-cursor" :style="style">
    <span class="remote-cursor-icon">{{ icon || '\u{1F431}' }}</span>
    <span class="remote-cursor-name" v-html="escapeHtml(name)"></span>
  </div>
</template>
