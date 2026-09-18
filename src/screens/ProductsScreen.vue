<script setup lang="ts">
import { computed, ref } from 'vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import FabButton from '@/components/FabButton.vue';
import CheckCircle from '@/components/CheckCircle.vue';
import ProductSheet from '@/components/ProductSheet.vue';
import StorePicker from '@/components/StorePicker.vue';
import DraggableAisle from '@/components/DraggableAisle.vue';
import { useDataStore } from '@/stores/data';
import { useShopStore } from '@/stores/shop';
import { useArrangeView } from '@/lib/arrange';
import { needId } from '@/lib/ids';
import { placementsForStore, reorderPlacements, setNeeded } from '@/lib/domain';
import { fold } from '@/lib/text';

const data = useDataStore();
const shop = useShopStore();

const query = ref('');
const sheetOpen = ref(false);
const editingId = ref<string | null>(null);

const storeId = computed(() =>
  shop.storeId && data.get('stores', shop.storeId) ? shop.storeId : '',
);
const storeLabel = computed(() =>
  storeId.value ? (data.get('stores', storeId.value)?.name ?? 'Store') : 'All stores',
);
const pillLabel = computed(() => (storeId.value ? storeLabel.value : 'All'));
const arranging = computed(() => storeId.value !== '' && !query.value.trim());
const aisles = useArrangeView(storeId);

const products = computed(() => {
  const q = fold(query.value.trim()); // accent-insensitive: "cekla" finds "Cékla"
  let list = data.active('products');
  // a store is selected → only that store's products (matches the aisle view's scope)
  if (storeId.value) {
    const atStore = new Set(placementsForStore(storeId.value).map((p) => p.product_id));
    list = list.filter((p) => atStore.has(p.id));
  }
  return list
    .filter((p) => !q || fold(p.name).includes(q) || (!!p.note && fold(p.note).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
});

function isNeeded(productId: string): boolean {
  const n = data.get('needs', needId(productId));
  return Boolean(n && !n.deleted);
}

function openNew() {
  editingId.value = null;
  sheetOpen.value = true;
}
function openEdit(id: string) {
  editingId.value = id;
  sheetOpen.value = true;
}
</script>

<template>
  <div class="screen">
    <ScreenHeader title="Products">
      <template #actions>
        <StorePicker :selected="storeId" :label="pillLabel" @pick="shop.selectStore($event)" />
      </template>
    </ScreenHeader>

    <div class="search">
      <input v-model="query" class="input" type="search" placeholder="Search products" />
    </div>

    <!-- store selected: arrange that store's products by aisle -->
    <div v-if="arranging" class="list">
      <p v-if="aisles.length === 0" class="empty">
        No products assigned to {{ storeLabel }} yet.<br />
        Open a product and turn on “Buy at {{ storeLabel }}”.
      </p>
      <section v-for="g in aisles" :key="g.key" class="group">
        <div class="group__head u-eyebrow">{{ g.title }}</div>
        <div class="group__items">
          <DraggableAisle
            :items="g.items"
            @reorder="reorderPlacements(storeId, g.key === 'unsorted' ? null : g.key, $event)"
            @toggle="(id, needed) => setNeeded(id, needed)"
            @open="openEdit($event)"
          />
        </div>
      </section>
    </div>

    <!-- default: flat catalog -->
    <div v-else class="list">
      <p v-if="products.length === 0" class="empty">
        <template v-if="query">
          No matches{{ storeId ? ` at ${storeLabel}` : '' }}.
        </template>
        <template v-else>No products yet. Tap + to add one.</template>
      </p>

      <div class="group__items">
        <div v-for="p in products" :key="p.id" class="row">
          <CheckCircle
            class="row__check"
            variant="add"
            :checked="isNeeded(p.id)"
            :label="isNeeded(p.id) ? `Remove ${p.name} from the list` : `Add ${p.name} to the list`"
            @toggle="setNeeded(p.id, !isNeeded(p.id))"
          />
          <button class="row__body" @click="openEdit(p.id)">
            <span class="row__head">
              <span class="row__name">{{ p.name }}</span>
              <span v-if="p.default_qty" class="row__qty">×&nbsp;{{ p.default_qty }}</span>
            </span>
            <span v-if="p.note" class="row__note">{{ p.note }}</span>
          </button>
        </div>
      </div>
    </div>

    <FabButton label="New product" @click="openNew" />

    <ProductSheet
      v-model:open="sheetOpen"
      :product-id="editingId"
      :default-store-id="storeId"
    />
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.search {
  padding: var(--s-2) var(--s-4);
  position: sticky;
  top: calc(var(--header-h) + var(--safe-t));
  background: var(--c-bg);
  z-index: 5;
}
.search .input {
  min-height: var(--control-h-sm);
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
.group__head {
  padding: var(--s-3) 0 var(--s-1);
}
.group__items {
  padding-left: var(--s-3);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-3) 0;
  min-height: var(--row-h);
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
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
.row__qty {
  flex: none;
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-text);
  white-space: nowrap;
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
