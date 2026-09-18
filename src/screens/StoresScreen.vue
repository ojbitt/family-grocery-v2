<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ScreenHeader from '@/components/ScreenHeader.vue';
import FabButton from '@/components/FabButton.vue';
import PromptSheet from '@/components/PromptSheet.vue';
import { useDataStore } from '@/stores/data';
import { createStore } from '@/lib/domain';

const data = useDataStore();
const router = useRouter();
const addOpen = ref(false);

const stores = computed(() =>
  data.active('stores').sort((a, b) => a.name.localeCompare(b.name)),
);

function areaCount(storeId: string): number {
  return data.active('areas').filter((a) => a.store_id === storeId).length;
}

async function add(name: string) {
  const id = await createStore(name);
  router.push(`/stores/${id}`);
}
</script>

<template>
  <div class="screen">
    <ScreenHeader title="Stores" />

    <div class="list">
      <p v-if="stores.length === 0" class="empty">
        No stores yet. Add the shops you visit, then arrange their aisles.
      </p>

      <RouterLink v-for="s in stores" :key="s.id" :to="`/stores/${s.id}`" class="row">
        <span class="row__body">
          <span class="row__name">{{ s.name }}</span>
          <span class="row__sub">
            {{ areaCount(s.id) }} {{ areaCount(s.id) === 1 ? 'aisle' : 'aisles' }}
          </span>
        </span>
        <svg class="row__edit" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </RouterLink>
    </div>

    <FabButton label="New store" @click="addOpen = true" />

    <PromptSheet
      v-model:open="addOpen"
      title="New store"
      label="Store name"
      placeholder="e.g. Lidl"
      submit-label="Create"
      @submit="add"
    />
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.list {
  padding: 0 var(--s-4);
  padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + 88px);
}
.empty {
  color: var(--c-text-dim);
  padding: var(--s-5) 0;
  text-align: center;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) 0;
  min-height: var(--row-h);
  text-decoration: none;
  color: var(--c-text);
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__name {
  min-width: 0;
  font-size: var(--t-body);
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__sub {
  font-size: var(--t-body-sm);
  line-height: 1.35;
  color: var(--c-text-dim);
}
.row__edit {
  flex: none;
  color: var(--c-text-faint);
}
</style>
