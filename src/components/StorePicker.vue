<script setup lang="ts">
import { computed, ref } from 'vue';
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui';
import { useDataStore } from '@/stores/data';
import { placementsForStore } from '@/lib/domain';

defineProps<{ selected: string; label: string }>();
const emit = defineEmits<{ pick: [id: string] }>();

const data = useDataStore();

const neededProductIds = computed(
  () => new Set(data.active('needs').filter((n) => n.status === 'needed').map((n) => n.product_id)),
);

const stores = computed(() =>
  data
    .active('stores')
    .map((s) => ({
      id: s.id,
      name: s.name,
      covers: placementsForStore(s.id).filter((p) => neededProductIds.value.has(p.product_id)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const open = ref(false);
function pick(id: string) {
  emit('pick', id);
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="pill hit" aria-label="Choose store">
      <span>{{ label }}</span>
      <svg class="store-menu__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="store-menu" align="end" :side-offset="6" :collision-padding="8">
        <button class="store-menu__opt" :class="{ 'is-on': selected === '' }" @click="pick('')">
          <span class="store-menu__name">Any store</span>
          <span class="store-menu__meta">all items</span>
        </button>
        <button
          v-for="s in stores"
          :key="s.id"
          class="store-menu__opt"
          :class="{ 'is-on': selected === s.id }"
          @click="pick(s.id)"
        >
          <span class="store-menu__name">{{ s.name }}</span>
          <span class="store-menu__meta">{{ s.covers }} to buy</span>
        </button>
        <p v-if="stores.length === 0" class="store-menu__empty">Add stores from the Stores tab.</p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<!-- not scoped: PopoverContent is portaled to <body>, outside this SFC's scope -->
<style>
.store-menu__chev {
  flex: none;
  margin-right: -2px;
}
.store-menu {
  z-index: 50;
  min-width: 12rem;
  max-width: min(16rem, calc(100vw - 2 * var(--s-4)));
  padding: var(--s-1);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  box-shadow: var(--e-2);
  transform-origin: var(--reka-popover-content-transform-origin);
  animation: store-menu-in 0.13s var(--ease);
}
@keyframes store-menu-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}
.store-menu__opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  width: 100%;
  min-height: var(--control-h);
  padding: 0 var(--s-3);
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--c-text);
  font: inherit;
  font-size: var(--t-body-sm);
  text-align: left;
  cursor: pointer;
}
.store-menu__opt:hover {
  background: var(--c-surface-2);
}
.store-menu__opt.is-on {
  color: var(--c-accent);
  font-weight: 700;
}
.store-menu__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.store-menu__meta {
  flex: none;
  font-size: var(--t-caption);
  color: var(--c-text-dim);
}
.store-menu__empty {
  margin: 0;
  padding: var(--s-2) var(--s-3);
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
}
</style>
