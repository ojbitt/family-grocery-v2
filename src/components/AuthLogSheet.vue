<script setup lang="ts">
import { ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { api } from '@/lib/api';
import { deviceLabel } from '@/lib/ua';
import type { AuthLogEntry } from '@shared/types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const entries = ref<AuthLogEntry[]>([]);
const state = ref<'loading' | 'ready' | 'error'>('loading');

watch(
  () => props.open,
  (open) => {
    if (open) void load();
  },
);

async function load() {
  state.value = 'loading';
  try {
    entries.value = (await api.authLog()).entries;
    state.value = 'ready';
  } catch {
    state.value = 'error';
  }
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

function relative(at: number): string {
  let diff = (at - Date.now()) / 1000;
  for (const [unit, span] of STEPS) {
    if (Math.abs(diff) < span) return rtf.format(Math.round(diff), unit);
    diff /= span;
  }
  return rtf.format(Math.round(diff), 'year');
}

function absolute(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function label(e: AuthLogEntry): string {
  if (e.kind === 'unlock') return e.ok ? 'Signed in' : 'Wrong password';
  if (e.kind === 'setup') return e.ok ? 'Password set' : 'Setup blocked';
  return 'All devices logged out';
}

const LOCAL_IPS = new Set(['::1', '127.0.0.1', '0.0.0.0']);
function meta(e: AuthLogEntry): string {
  const parts = [deviceLabel(e.user_agent)];
  if (e.ip && !LOCAL_IPS.has(e.ip)) parts.push(e.ip);
  return parts.join(' · ');
}
</script>

<template>
  <BottomSheet :open="open" title="Sign-in log" @update:open="emit('update:open', $event)">
    <p class="hint">
      Every unlock attempt on the family password, newest first. The app has one
      shared password, so this shows the device, not a person.
    </p>

    <p v-if="state === 'loading'" class="msg">Loading…</p>
    <p v-else-if="state === 'error'" class="msg">
      Couldn't load the log — you may be offline.
      <button class="retry hit" @click="load">Retry</button>
    </p>
    <p v-else-if="!entries.length" class="msg">Nothing logged yet.</p>

    <ul v-else class="log">
      <li v-for="(e, i) in entries" :key="i" class="row" :class="{ 'row--bad': !e.ok }">
        <span class="row__dot" />
        <span class="row__body">
          <span class="row__top">
            <span class="row__what">{{ label(e) }}</span>
            <span class="row__when" :title="absolute(e.at)">{{ relative(e.at) }}</span>
          </span>
          <span class="row__dev">{{ meta(e) }}</span>
        </span>
      </li>
    </ul>
  </BottomSheet>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--s-3);
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
  line-height: 1.5;
}
.msg {
  margin: var(--s-4) 0;
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
}
.retry {
  margin-left: var(--s-2);
  border: none;
  background: none;
  color: var(--c-accent);
  font-weight: 600;
}
.log {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  gap: var(--s-3);
  padding: var(--s-3) 0;
  border-top: 1px solid var(--c-border);
}
.row:first-child {
  border-top: none;
}
.row__dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: var(--r-full);
  background: var(--c-success);
}
.row--bad .row__dot {
  background: var(--c-danger);
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__top {
  display: flex;
  justify-content: space-between;
  gap: var(--s-2);
}
.row__what {
  font-weight: 600;
  font-size: var(--t-body-sm);
}
.row--bad .row__what {
  color: var(--c-danger);
}
.row__when {
  flex: none;
  color: var(--c-text-faint);
  font-size: var(--t-caption);
}
.row__dev {
  color: var(--c-text-dim);
  font-size: var(--t-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
