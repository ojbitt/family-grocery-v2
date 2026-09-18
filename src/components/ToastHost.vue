<script setup lang="ts">
import { useToasts, dismissToast, type Toast } from '@/lib/toast';

const toasts = useToasts();

async function runAction(t: Toast) {
  dismissToast(t.id);
  await t.action?.run();
}
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts.items" :key="t.id" class="toast">
        <span class="toast__msg">{{ t.message }}</span>
        <button v-if="t.action" class="toast__action hit" @click="runAction(t)">
          {{ t.action.label }}
        </button>
        <button class="toast__x hit" aria-label="Dismiss" @click="dismissToast(t.id)">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: var(--app-edge);
  right: var(--app-edge);
  bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-3));
  z-index: 35; /* below bottom sheets (40/41) so a dialog covers pending toasts */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  padding: 0 var(--s-4);
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  max-width: 480px;
  padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
  background: var(--c-toast-bg);
  color: var(--c-toast-fg);
  border-radius: var(--r-md);
  box-shadow: var(--e-2);
  font-size: var(--t-body-sm);
}
.toast__msg {
  flex: 1;
  min-width: 0;
}
.toast__action {
  border: none;
  background: none;
  color: #5eead4; /* bright mint — readable on the dark toast in both themes */
  font-weight: 700;
  padding: var(--s-1) var(--s-2);
}
.toast__x {
  border: none;
  background: none;
  color: inherit;
  opacity: 0.6;
  display: grid;
  place-items: center;
  padding: var(--s-1);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
