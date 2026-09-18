<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ShopItem } from '@/lib/shopping';
import CheckCircle from './CheckCircle.vue';

const props = defineProps<{
  item: ShopItem;
  checked: boolean;
  /** play a collapse-out animation when checked (bought items are hidden) */
  collapseOnCheck?: boolean;
}>();
const emit = defineEmits<{ toggle: []; remove: []; open: [] }>();

const qty = computed(() => props.item.product.default_qty || '');
const note = computed(() => props.item.product.note || '');

// check-off animation: fill + strike, then (optionally) collapse away
type Phase = 'idle' | 'checking' | 'leaving';
const phase = ref<Phase>('idle');
const shownChecked = computed(() => props.checked || phase.value !== 'idle');

watch(
  () => props.item.need.id,
  () => {
    phase.value = 'idle';
  },
);

function onCheck() {
  if (props.checked || phase.value !== 'idle') {
    emit('toggle'); // un-checking is immediate
    return;
  }
  phase.value = 'checking';
  setTimeout(() => {
    if (props.collapseOnCheck) {
      phase.value = 'leaving';
      setTimeout(() => emit('toggle'), 240);
    } else {
      emit('toggle');
      phase.value = 'idle';
    }
  }, 220);
}

const dx = ref(0);
const swiping = ref(false);
let startX = 0;
let startY = 0;
let decided: 'h' | 'v' | null = null;

function onStart(e: TouchEvent) {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  decided = null;
  swiping.value = true;
}
function onMove(e: TouchEvent) {
  if (!swiping.value) return;
  const mx = e.touches[0].clientX - startX;
  const my = e.touches[0].clientY - startY;
  if (!decided) {
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) decided = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
  }
  if (decided === 'h') dx.value = Math.min(0, mx);
}
function onEnd() {
  swiping.value = false;
  if (dx.value < -96) emit('remove');
  dx.value = 0;
  decided = null;
}

let pressTimer: ReturnType<typeof setTimeout> | null = null;
function onPressStart() {
  pressTimer = setTimeout(() => emit('open'), 500);
}
function onPressEnd() {
  if (pressTimer) clearTimeout(pressTimer);
}
</script>

<template>
  <div class="wrap" @touchstart.passive="onStart" @touchmove.passive="onMove" @touchend="onEnd">
    <div v-if="dx < 0" class="wrap__bg"><span>Remove</span></div>
    <div
      class="row"
      :class="{ 'is-leaving': phase === 'leaving' }"
      :style="{ transform: dx ? `translateX(${dx}px)` : undefined, transition: swiping ? 'none' : undefined }"
      @touchstart.passive="onPressStart"
      @touchend="onPressEnd"
      @touchmove.passive="onPressEnd"
    >
      <CheckCircle
        class="row__check"
        :checked="shownChecked"
        :label="checked ? `Move ${item.product.name} back to list` : `Put ${item.product.name} in cart`"
        @toggle="onCheck"
      />

      <button class="row__body" @click="emit('open')">
        <span class="row__head">
          <span class="row__name" :class="{ 'is-done': shownChecked }">{{ item.product.name }}</span>
          <span v-if="qty" class="row__qty" :class="{ 'is-dim': shownChecked }">×&nbsp;{{ qty }}</span>
        </span>
        <span v-if="note" class="row__note">{{ note }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  overflow: hidden;
}
.wrap__bg {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--s-4);
  background: var(--c-danger);
  color: #fff;
  font-weight: 700;
  font-size: var(--t-body-sm);
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-3) var(--s-4);
  min-height: var(--row-h);
  background: var(--c-bg);
  overflow: hidden;
  transition:
    min-height 0.24s var(--ease),
    padding 0.24s var(--ease),
    opacity 0.24s var(--ease),
    transform 0.24s var(--ease);
}
.row.is-leaving {
  min-height: 0;
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  transform: translateX(-16px);
  pointer-events: none;
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: none;
  background: none;
  text-align: left;
  padding: 0;
}
.row__head {
  display: flex;
  align-items: baseline;
  gap: var(--s-3);
}
.row__name {
  flex: 1;
  min-width: 0;
  font-size: var(--t-body);
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__name.is-done {
  color: var(--c-text-faint);
  font-weight: 500;
  text-decoration: line-through;
}
.row__qty {
  flex: none;
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-text);
  white-space: nowrap;
}
.row__qty.is-dim {
  color: var(--c-text-faint);
}
.row__note {
  min-width: 0;
  font-size: var(--t-body-sm);
  line-height: 1.35;
  color: var(--c-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
