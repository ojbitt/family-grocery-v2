<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { exportData } from '@/lib/portable';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const json = ref('');
const copied = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) {
      json.value = JSON.stringify(exportData(), null, 2);
      copied.value = false;
    }
  },
  { immediate: true },
);

const counts = computed(() => {
  try {
    const d = JSON.parse(json.value);
    return `${d.stores?.length ?? 0} stores · ${d.products?.length ?? 0} products`;
  } catch {
    return '';
  }
});

async function copy() {
  try {
    await navigator.clipboard.writeText(json.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // clipboard blocked — select the text so the user can copy manually
    const ta = document.querySelector<HTMLTextAreaElement>('.export-ta');
    ta?.focus();
    ta?.select();
  }
}
</script>

<template>
  <BottomSheet :open="open" title="Export" @update:open="emit('update:open', $event)">
    <p class="hint">{{ counts }} — copy this and keep it as a backup, or edit it and re-import.</p>

    <textarea
      class="input export-ta"
      :value="json"
      readonly
      rows="12"
      spellcheck="false"
      @focus="($event.target as HTMLTextAreaElement).select()"
    />

    <button class="btn-primary" @click="copy">{{ copied ? 'Copied ✓' : 'Copy JSON' }}</button>
  </BottomSheet>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--s-3);
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
}
.export-ta {
  margin-bottom: var(--s-3);
  background: var(--c-surface-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--t-body-sm); /* 16px — also keeps iOS Safari from zooming on focus */
  resize: vertical;
}
</style>
