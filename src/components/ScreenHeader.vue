<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSyncStore } from '@/stores/sync';
import { syncNow } from '@/lib/sync';

const props = defineProps<{ title: string; back?: string }>();

const sync = useSyncStore();
const router = useRouter();

const syncBadge = computed(() => {
  if (sync.status === 'syncing') return { text: 'Syncing…', kind: 'busy' };
  if (sync.status === 'offline') return { text: 'Offline', kind: 'warn' };
  if (sync.status === 'error') return { text: 'Sync failed', kind: 'warn' };
  if (sync.pendingCount > 0) return { text: `${sync.pendingCount} to sync`, kind: 'busy' };
  return null;
});

function goBack() {
  if (props.back) router.push(props.back);
  else router.back();
}
</script>

<template>
  <header class="hdr">
    <button v-if="back !== undefined" class="hdr__back hit" aria-label="Back" @click="goBack">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <h1 class="hdr__title">{{ title }}</h1>
    <div class="hdr__actions">
      <button
        v-if="syncBadge"
        class="hdr__sync"
        :data-kind="syncBadge.kind"
        @click="syncNow()"
      >
        {{ syncBadge.text }}
      </button>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.hdr {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  /* one fixed height on every screen — no scroll-collapse, nothing moves */
  min-height: calc(var(--safe-t) + var(--header-h));
  padding: var(--safe-t) var(--s-4) 0;
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-hairline);
}
.hdr__back {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-left: -6px;
  margin-right: var(--s-1);
  border: none;
  border-radius: var(--r-full);
  background: none;
  color: var(--c-text);
}
.hdr__back:active {
  background: var(--c-surface-2);
}
.hdr__title {
  margin: 0;
  margin-right: auto;
  font-size: var(--t-screen);
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hdr__actions {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
/* same chip metrics as .pill (the store picker), so header chips match */
.hdr__sync {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-h-sm);
  max-width: 40vw;
  padding: 0 var(--s-3);
  border: none;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hdr__sync[data-kind='warn'] {
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
</style>
