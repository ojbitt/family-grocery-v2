<script setup lang="ts">
import { ref, watch } from 'vue';
import { dragAndDrop } from '@formkit/drag-and-drop/vue';
import type { ArrangeItem } from '@/lib/arrange';
import CheckCircle from './CheckCircle.vue';

const props = defineProps<{ items: ArrangeItem[] }>();
const emit = defineEmits<{
  reorder: [productIds: string[]];
  toggle: [productId: string, needed: boolean];
  open: [productId: string];
}>();

const parent = ref<HTMLElement>();
const list = ref<ArrangeItem[]>([...props.items]);

dragAndDrop<ArrangeItem>({
  parent,
  values: list,
  dragHandle: '.arr__grip',
});

// signature covers order AND the fields a row shows, so an edit to a product's
// qty / note / name (same id, same order) still refreshes the local list
const sig = (items: ArrangeItem[]) =>
  items
    .map(
      (x) =>
        `${x.product.id}~${x.product.default_qty ?? ''}~${x.product.note ?? ''}~${x.product.name}~${x.needed ? 1 : 0}`,
    )
    .join('|');

watch(
  () => props.items,
  (fresh) => {
    if (sig(fresh) !== sig(list.value)) list.value = [...fresh];
  },
);

watch(list, (l) => {
  const dragged = l.map((x) => x.product.id).join(',');
  const persisted = props.items.map((x) => x.product.id).join(',');
  if (dragged !== persisted && l.length === props.items.length) {
    emit(
      'reorder',
      l.map((x) => x.product.id),
    );
  }
});
</script>

<template>
  <div ref="parent">
    <div v-for="it in list" :key="it.product.id" class="arr">
      <CheckCircle
        variant="add"
        :checked="it.needed"
        :label="it.needed ? `Remove ${it.product.name} from the list` : `Add ${it.product.name} to the list`"
        @toggle="emit('toggle', it.product.id, !it.needed)"
      />
      <button class="arr__body" @click="emit('open', it.product.id)">
        <span class="arr__head">
          <span class="arr__name">{{ it.product.name }}</span>
          <span v-if="it.product.default_qty" class="arr__qty">×&nbsp;{{ it.product.default_qty }}</span>
        </span>
        <span v-if="it.product.note" class="arr__note">{{ it.product.note }}</span>
      </button>
      <!-- a real <button> here suppresses native HTML5 drag in Chrome/Firefox
           (desktop's only drag path), so this handle is a plain span -->
      <span class="arr__grip" role="button" aria-label="Reorder">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </span>
    </div>
  </div>
</template>

<style scoped>
.arr {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-3) 0;
  min-height: var(--row-h);
  background: var(--c-bg);
}
.arr__body {
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
.arr__head {
  display: flex;
  align-items: baseline;
  gap: var(--s-3);
}
.arr__name {
  flex: 1;
  min-width: 0;
  font-size: var(--t-body);
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arr__qty {
  flex: none;
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-text);
  white-space: nowrap;
}
.arr__note {
  min-width: 0;
  font-size: var(--t-body-sm);
  line-height: 1.35;
  color: var(--c-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arr__grip {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--c-text-faint);
  cursor: grab;
  touch-action: none;
}
.arr__grip:active {
  cursor: grabbing;
}
.arr__grip svg {
  pointer-events: none;
}
</style>
