<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dragAndDrop } from '@formkit/drag-and-drop/vue';
import type { Area } from '@shared/types';
import ScreenHeader from '@/components/ScreenHeader.vue';
import PromptSheet from '@/components/PromptSheet.vue';
import ConfirmSheet from '@/components/ConfirmSheet.vue';
import { useDataStore } from '@/stores/data';
import {
  areasForStore,
  createArea,
  deleteArea,
  deleteStore,
  reorderAreas,
  restore,
  updateArea,
  updateStore,
} from '@/lib/domain';
import { showToast } from '@/lib/toast';

const route = useRoute();
const router = useRouter();
const data = useDataStore();

const storeId = computed(() => String(route.params.id));
const store = computed(() => data.get('stores', storeId.value));
const sortedAreas = computed(() => areasForStore(storeId.value));

const dragParent = ref<HTMLElement>();
const dragAreas = ref<Area[]>([...sortedAreas.value]);

dragAndDrop<Area>({
  parent: dragParent,
  values: dragAreas,
  dragHandle: '.area__grip',
});

// keep the drag list in step with external changes (add / delete / rename / sync)
const sig = (list: Area[]) => list.map((x) => `${x.id}:${x.name}:${x.position}`).join('|');
watch(sortedAreas, (fresh) => {
  if (sig(fresh) !== sig(dragAreas.value)) dragAreas.value = [...fresh];
});

// persist a user reorder
watch(dragAreas, (list) => {
  const dragged = list.map((x) => x.id).join(',');
  const persisted = sortedAreas.value.map((x) => x.id).join(',');
  if (dragged !== persisted && list.length === sortedAreas.value.length) {
    void reorderAreas(storeId.value, list.map((x) => x.id));
  }
});

const addOpen = ref(false);
const renameStoreOpen = ref(false);
const renameArea = ref<Area | null>(null);
const confirmDeleteOpen = ref(false);

async function onAddArea(name: string) {
  await createArea(storeId.value, name);
}
async function onRenameStore(name: string) {
  await updateStore(storeId.value, { name });
}
async function onRenameArea(name: string) {
  if (renameArea.value) await updateArea(renameArea.value.id, { name });
  renameArea.value = null;
}
async function onDeleteArea(area: Area) {
  const point = await deleteArea(area.id);
  showToast(`Removed “${area.name}”`, {
    action: { label: 'Undo', run: () => restore(point) },
  });
}
async function onDeleteStore() {
  const name = store.value?.name ?? 'store';
  const point = await deleteStore(storeId.value);
  router.push('/stores');
  showToast(`Deleted ${name}`, {
    action: { label: 'Undo', run: () => restore(point) },
    duration: 8000,
  });
}
</script>

<template>
  <div class="screen">
    <ScreenHeader :title="store?.name ?? 'Store'" back="/stores">
      <template #actions>
        <button class="txt" @click="renameStoreOpen = true">Rename</button>
      </template>
    </ScreenHeader>

    <div v-if="store" class="body">
      <p class="hint">Drag aisles into the order you walk them. Items follow this path when you shop here.</p>

      <div ref="dragParent" class="areas">
        <div v-for="area in dragAreas" :key="area.id" class="area">
          <button class="area__del" aria-label="Delete area" @click="onDeleteArea(area)">
            <!-- SVG fills the button; the glyph is centred by the viewBox so it
                 can't drift a sub-pixel off centre on fractional-DPR / Display-Zoom
                 screens (see CheckCircle.vue / BottomSheet.vue). -->
            <svg viewBox="-12 -12 44 44" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <button class="area__name" @click="renameArea = area">{{ area.name }}</button>
          <!-- span, not <button>: a button blocks native HTML5 drag in Chrome -->
          <span class="area__grip" role="button" aria-label="Reorder">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </span>
        </div>
      </div>

      <button class="add-area" @click="addOpen = true">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        Add aisle
      </button>

      <button class="btn-danger" @click="confirmDeleteOpen = true">Delete store</button>
    </div>

    <ConfirmSheet
      v-model:open="confirmDeleteOpen"
      :title="`Delete ${store?.name ?? 'store'}?`"
      :message="`This also removes its ${dragAreas.length} ${dragAreas.length === 1 ? 'aisle' : 'aisles'} and every product's placement here. You can undo right after.`"
      confirm-label="Delete"
      danger
      @confirm="onDeleteStore"
    />

    <PromptSheet
      v-model:open="addOpen"
      title="Add aisle"
      label="Aisle name"
      placeholder="e.g. Produce"
      submit-label="Add"
      @submit="onAddArea"
    />
    <PromptSheet
      v-model:open="renameStoreOpen"
      title="Rename store"
      :initial="store?.name"
      submit-label="Save"
      @submit="onRenameStore"
    />
    <PromptSheet
      :open="renameArea !== null"
      title="Rename aisle"
      :initial="renameArea?.name"
      submit-label="Save"
      @update:open="(v) => { if (!v) renameArea = null; }"
      @submit="onRenameArea"
    />
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.txt {
  display: grid;
  place-items: center;
  min-height: var(--control-h);
  border: none;
  background: none;
  color: var(--c-accent);
  font-weight: 600;
  padding: 0 var(--s-2);
}
.body {
  padding: var(--s-2) var(--s-4) var(--s-6);
}
.hint {
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
  line-height: 1.5;
  margin: 0 0 var(--s-4);
}
.areas {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.area {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
}
.area__grip {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--c-text-faint);
  cursor: grab;
  touch-action: none;
}
.area__grip:active {
  cursor: grabbing;
}
.area__grip svg {
  pointer-events: none;
}
.area__name {
  flex: 1;
  min-height: var(--control-h);
  text-align: left;
  border: none;
  background: none;
  padding: 0;
  font-size: var(--t-body);
}
.area__del {
  display: block;
  width: var(--control-h);
  height: var(--control-h);
  border: none;
  border-radius: var(--r-full);
  background: none;
  color: var(--c-text-faint);
}
.area__del svg {
  width: 100%;
  height: 100%;
}
.area__del:active {
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
.add-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  width: 100%;
  min-height: var(--control-h);
  margin-top: var(--s-3);
  padding: 0 var(--s-3);
  border: 1px dashed var(--c-border);
  border-radius: var(--r-md);
  background: none;
  color: var(--c-accent);
  font-weight: 600;
}
.btn-danger {
  margin-top: var(--s-6);
}
:deep(.dnd-dragging) {
  opacity: 0.4;
}
</style>
