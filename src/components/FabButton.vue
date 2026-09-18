<script setup lang="ts">
defineProps<{ label: string }>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button class="fab" :aria-label="label" @click="emit('click')">
    <!-- SVG fills the button; the "+" is centred by the viewBox (no box-in-box
         maths, so it can't drift on fractional-DPR / Display-Zoom screens) -->
    <svg viewBox="-10 -10 44 44" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.fab {
  position: fixed;
  right: calc(var(--app-edge) + var(--s-4));
  bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-4));
  z-index: 15;
  width: var(--control-h);
  height: var(--control-h);
  padding: 0;
  border: none;
  border-radius: var(--r-full);
  background: var(--c-accent);
  color: var(--c-accent-contrast);
  box-shadow: var(--e-2);
}
.fab svg {
  width: 100%;
  height: 100%;
}
.fab:active {
  transform: scale(0.92);
}
</style>
