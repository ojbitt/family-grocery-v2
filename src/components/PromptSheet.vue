<script setup lang="ts">
import { ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';

const props = defineProps<{
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  submitLabel?: string;
}>();
const emit = defineEmits<{ 'update:open': [value: boolean]; submit: [value: string] }>();

const value = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) value.value = props.initial ?? '';
  },
  { immediate: true },
);

function submit() {
  const v = value.value.trim();
  if (!v) return;
  emit('submit', v);
  emit('update:open', false);
}
</script>

<template>
  <BottomSheet :open="open" :title="title" @update:open="emit('update:open', $event)">
    <label v-if="label" class="lbl">{{ label }}</label>
    <input
      ref="input"
      v-model="value"
      class="input"
      :placeholder="placeholder"
      enterkeyhint="done"
      autofocus
      @keydown.enter="submit"
    />
    <button class="btn-primary" :disabled="value.trim().length === 0" @click="submit">
      {{ submitLabel ?? 'Save' }}
    </button>
  </BottomSheet>
</template>

<style scoped>
.lbl {
  display: block;
  margin-bottom: var(--s-1);
  font-size: var(--t-caption);
  font-weight: 600;
  color: var(--c-text-dim);
}
.input {
  margin-bottom: var(--s-3);
}
</style>
