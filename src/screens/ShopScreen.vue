<script setup lang="ts">
import { computed, ref } from 'vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import GroceriesGlyph from '@/components/GroceriesGlyph.vue';
import ShopRow from '@/components/ShopRow.vue';
import StorePicker from '@/components/StorePicker.vue';
import ItemSheet from '@/components/ItemSheet.vue';
import ConfirmSheet from '@/components/ConfirmSheet.vue';
import { useDataStore } from '@/stores/data';
import { useShopStore } from '@/stores/shop';
import { useShoppingView } from '@/lib/shopping';
import { usePullToRefresh } from '@/lib/usePullToRefresh';
import { syncNow } from '@/lib/sync';
import {
  finishShopping,
  needsClearedByFinish,
  restore,
  setNeedStatus,
  setNeeded,
} from '@/lib/domain';
import { showToast } from '@/lib/toast';

const data = useDataStore();
const shop = useShopStore();

// fall back to "Any store" if the selected store was deleted
const storeId = computed(() =>
  shop.storeId && data.get('stores', shop.storeId) ? shop.storeId : '',
);
const showBought = computed(() => shop.showBought);
const view = useShoppingView(storeId, showBought);

const hasStores = computed(() => data.active('stores').length > 0);
const currentStoreName = computed(() =>
  storeId.value ? (data.get('stores', storeId.value)?.name ?? 'Store') : 'Any store',
);

const itemOpen = ref(false);
const itemProductId = ref<string | null>(null);
const notSoldOpen = ref(false);
const finishOpen = ref(false);

const finishSummary = computed(() => {
  const cleared = needsClearedByFinish(storeId.value);
  const bought = cleared.filter((n) => n.status === 'in_cart').length;
  const notBought = cleared.length - bought;
  return { total: cleared.length, bought, notBought };
});

const finishMessage = computed(() => {
  const { total, bought, notBought } = finishSummary.value;
  if (notBought === 0) {
    return `Clears ${total} item${total > 1 ? 's' : ''} from the cart.`;
  }
  const scope = storeId.value ? ' for this store' : '';
  const keep = storeId.value
    ? " Items this store doesn't sell stay on the list."
    : '';
  return `Clears all ${total} items${scope} — ${bought} in cart and ${notBought} not bought.${keep} Undo is available right after.`;
});

const { distance, refreshing } = usePullToRefresh(() => syncNow());
/** height (px) the pull-to-refresh spinner strip reaches at full pull */
const PTR_HEIGHT = 44;

function openItem(productId: string) {
  itemProductId.value = productId;
  itemOpen.value = true;
}

async function toggle(productId: string, checked: boolean) {
  // No toast: a bought item stays in place (struck through / hidden), and
  // tapping it again puts it straight back — so an Undo prompt is just noise.
  await setNeedStatus(productId, checked ? 'in_cart' : 'needed');
}

async function removeItem(productId: string, name: string) {
  await setNeeded(productId, false);
  showToast(`Removed ${name}`, { action: { label: 'Undo', run: () => setNeeded(productId, true) } });
}

async function finish() {
  finishOpen.value = false;
  const point = await finishShopping(storeId.value);
  if (point.length) {
    showToast(`${point.length} item${point.length > 1 ? 's' : ''} cleared`, {
      action: { label: 'Undo', run: () => restore(point) },
      duration: 8000,
    });
  }
}

const empty = computed(
  () =>
    view.value.groups.length === 0 &&
    view.value.notSoldHere.length === 0 &&
    view.value.boughtCount === 0,
);
</script>

<template>
  <div class="screen">
    <ScreenHeader :title="currentStoreName">
      <template #actions>
        <StorePicker
          :selected="storeId"
          :label="`${view.coverage.covered}/${view.coverage.total}`"
          @pick="shop.selectStore($event)"
        />
      </template>
    </ScreenHeader>

    <div
      v-if="distance > 0 || refreshing"
      class="ptr"
      :style="{ height: `${Math.min(distance, 1) * PTR_HEIGHT}px`, opacity: Math.min(distance, 1) }"
    >
      <span class="ptr__spin" :class="{ 'is-active': refreshing }">↻</span>
    </div>

    <div v-if="finishSummary.total > 0" class="statusbar">
      <div class="progress">
        <div
          class="progress__fill"
          :style="{
            width: `${(view.boughtCount / Math.max(1, view.boughtCount + view.totalToBuy)) * 100}%`,
          }"
        />
        <span class="progress__label">
          {{ view.boughtCount }} of {{ view.boughtCount + view.totalToBuy }} in cart
        </span>
      </div>
      <button
        v-if="view.boughtCount > 0"
        class="eye hit"
        :aria-pressed="shop.showBought"
        :aria-label="shop.showBought ? 'Hide bought items' : 'Show bought items'"
        @click="shop.setShowBought(!shop.showBought)"
      >
        <!-- SVG fills the button; icon centred by the viewBox (see FabButton) -->
        <svg viewBox="-10 -10 44 44" aria-hidden="true">
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
          <path
            v-if="!shop.showBought"
            d="M4 4l16 16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button class="finish hit" @click="finishOpen = true">Finish</button>
    </div>

    <div class="body">
      <div v-if="empty" class="empty">
        <GroceriesGlyph class="empty__icon" />
        <p class="empty__text">
          <template v-if="!hasStores">
            Add the stores you shop at on the Stores tab to get an aisle-by-aisle
            list.
          </template>
          <template v-else>
            Nothing to buy{{ storeId ? ' here' : '' }} yet.<br />
            Add items from the Products tab.
          </template>
        </p>
      </div>

      <section v-for="g in view.groups" :key="g.key" class="group">
        <button class="group__head" @click="shop.toggleGroup(g.key)">
          <svg
            class="group__chev"
            :class="{ 'is-collapsed': shop.collapsed.has(g.key) }"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="group__label">
            <span class="group__title u-eyebrow">{{ g.title }}</span>
            <span class="group__count">{{ g.items.length }}</span>
          </span>
        </button>
        <div v-if="!shop.collapsed.has(g.key)" class="group__items">
          <ShopRow
            v-for="it in g.items"
            :key="it.need.id"
            :item="it"
            :checked="it.bought"
            :collapse-on-check="!shop.showBought"
            @toggle="toggle(it.product.id, !it.bought)"
            @remove="removeItem(it.product.id, it.product.name)"
            @open="openItem(it.product.id)"
          />
        </div>
      </section>

      <section v-if="view.notSoldHere.length" class="group">
        <button class="group__head" @click="notSoldOpen = !notSoldOpen">
          <svg class="group__chev" :class="{ 'is-collapsed': !notSoldOpen }" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="group__label">
            <span class="group__title u-eyebrow">Not sold here</span>
            <span class="group__count">{{ view.notSoldHere.length }}</span>
          </span>
        </button>
        <div v-if="notSoldOpen" class="group__items">
          <ShopRow
            v-for="it in view.notSoldHere"
            :key="it.need.id"
            :item="it"
            :checked="it.bought"
            :collapse-on-check="!shop.showBought"
            @toggle="toggle(it.product.id, !it.bought)"
            @remove="removeItem(it.product.id, it.product.name)"
            @open="openItem(it.product.id)"
          />
        </div>
      </section>
    </div>

    <ItemSheet
      v-model:open="itemOpen"
      :product-id="itemProductId"
      :store-id="storeId"
    />
    <ConfirmSheet
      v-model:open="finishOpen"
      :title="storeId ? `Finish shopping at ${currentStoreName}?` : 'Clear the whole list?'"
      :message="finishMessage"
      confirm-label="Finish"
      @confirm="finish"
    />
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.ptr {
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--c-text-faint);
}
.ptr__spin.is-active {
  animation: spin 0.8s linear infinite;
}
.statusbar {
  position: sticky;
  top: calc(var(--header-h) + var(--safe-t));
  z-index: 6;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-2) var(--s-4);
  background: var(--c-bg);
}
.eye {
  flex: none;
  width: var(--control-h-sm);
  height: var(--control-h-sm);
  padding: 0;
  border: none;
  border-radius: var(--r-full);
  background: var(--c-surface-2);
  color: var(--c-text-dim);
}
.eye svg {
  width: 100%;
  height: 100%;
}
.eye[aria-pressed='true'] {
  background: var(--c-accent-soft);
  color: var(--c-accent);
}
.eye:active {
  transform: scale(0.92);
}
.progress {
  position: relative;
  flex: 1;
  height: var(--control-h-sm);
  background: var(--c-surface-2);
  border-radius: var(--r-full);
  overflow: hidden;
}
.progress__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--c-accent-soft);
  transition: width var(--dur) var(--ease);
}
.progress__label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: var(--t-body-sm);
  font-weight: 600;
  color: var(--c-text-dim);
}
.body {
  flex: 1;
  padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-4));
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-4);
  color: var(--c-text-dim);
  text-align: center;
  padding: var(--s-6) var(--s-4);
  line-height: 1.5;
}
.empty__icon {
  width: 72px;
  height: 72px;
  color: var(--c-text-faint);
}
.empty__text {
  margin: 0;
}
.group {
  margin-bottom: var(--s-2);
}
.group__head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  padding: var(--s-3) var(--s-4) var(--s-2);
  border: none;
  background: none;
  color: var(--c-text-dim);
}
.group__items {
  padding-left: var(--s-2);
}
.group__chev {
  transition: transform var(--dur) var(--ease);
}
.group__chev.is-collapsed {
  transform: rotate(0);
}
.group__chev:not(.is-collapsed) {
  transform: rotate(90deg);
}
.group__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.group__count {
  font-size: var(--t-caption);
  color: var(--c-text-faint);
}
.group__count::before {
  content: '×\00a0';
}
.finish {
  flex: none;
  display: grid;
  place-items: center;
  min-height: var(--control-h-sm);
  padding: 0 var(--s-4);
  border: none;
  border-radius: var(--r-full);
  background: var(--c-accent);
  color: var(--c-accent-contrast);
  font-weight: 700;
  font-size: var(--t-body-sm);
}
.finish:active {
  transform: scale(0.96);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
