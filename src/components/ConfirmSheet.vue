<script setup lang="ts">
import BottomSheet from './BottomSheet.vue';

defineProps<{
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}>();
const emit = defineEmits<{ 'update:open': [value: boolean]; confirm: [] }>();

function confirm() {
  emit('confirm');
  emit('update:open', false);
}
</script>

<template>
  <BottomSheet :open="open" :title="title" @update:open="emit('update:open', $event)">
    <p v-if="message" class="msg">{{ message }}</p>
    <div class="actions">
      <button class="btn btn--cancel" @click="emit('update:open', false)">Cancel</button>
      <button class="btn" :class="danger ? 'btn--danger' : 'btn--confirm'" @click="confirm">
        {{ confirmLabel ?? 'Confirm' }}
      </button>
    </div>
  </BottomSheet>
</template>

<style scoped>
.msg {
  margin: 0 0 var(--s-4);
  color: var(--c-text-dim);
  line-height: 1.5;
}
.actions {
  display: flex;
  gap: var(--s-3);
}
.btn {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: var(--control-h);
  padding: 0 var(--s-4);
  border: none;
  border-radius: var(--r-md);
  font-weight: 700;
}
.btn--cancel {
  background: var(--c-surface-2);
  color: var(--c-text);
}
.btn--confirm {
  background: var(--c-accent);
  color: var(--c-accent-contrast);
}
.btn--danger {
  background: var(--c-danger);
  color: #fff;
}
.btn:active {
  transform: scale(0.98);
}
</style>
