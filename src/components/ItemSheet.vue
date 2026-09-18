<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { useDataStore } from '@/stores/data';
import { needId } from '@/lib/ids';
import { areasForStore, placement, setNeeded, setPlacement, updateProduct } from '@/lib/domain';
import { showToast } from '@/lib/toast';

const props = defineProps<{ open: boolean; productId: string | null; storeId: string }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const data = useDataStore();

const product = computed(() =>
  props.productId ? data.get('products', props.productId) : undefined,
);
const need = computed(() =>
  props.productId ? data.get('needs', needId(props.productId)) : undefined,
);
const currentArea = computed(() => {
  if (!props.productId || !props.storeId) return undefined;
  return placement(props.productId, props.storeId)?.area_id ?? null;
});

const form = reactive({ qty: '', note: '' });
const hydrating = ref(false);
watch(
  () => [props.open, props.productId] as const,
  async ([open]) => {
    if (!open) return;
    hydrating.value = true;
    form.qty = product.value?.default_qty ?? '';
    form.note = product.value?.note ?? '';
    await nextTick();
    hydrating.value = false;
  },
  { immediate: true },
);

let t: ReturnType<typeof setTimeout> | null = null;
watch(
  () => ({ ...form }),
  (f) => {
    if (!props.open || !props.productId || hydrating.value) return;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      void updateProduct(props.productId!, {
        default_qty: f.qty.trim() || null,
        note: f.note.trim() || null,
      });
    }, 350);
  },
);

const areas = computed(() => (props.storeId ? areasForStore(props.storeId) : []));

async function moveTo(areaId: string) {
  if (props.productId && props.storeId) await setPlacement(props.productId, props.storeId, areaId || null);
}

async function removeFromList() {
  if (!props.productId) return;
  const id = props.productId;
  const name = product.value?.name ?? 'Item';
  emit('update:open', false);
  await setNeeded(id, false);
  showToast(`Removed ${name}`, {
    action: { label: 'Undo', run: () => setNeeded(id, true) },
  });
}
</script>

<template>
  <BottomSheet
    :open="open"
    :title="product?.name ?? 'Item'"
    @update:open="emit('update:open', $event)"
  >
    <div class="split">
      <div class="split__qty">
        <label class="lbl">Qty</label>
        <input v-model="form.qty" class="input" placeholder="1" />
      </div>
      <div class="split__grow">
        <label class="lbl">Note</label>
        <input v-model="form.note" class="input" placeholder="the big one, on offer, …" />
      </div>
    </div>

    <template v-if="storeId && need">
      <label class="lbl">Aisle at this store</label>
      <select class="input" :value="currentArea ?? ''" @change="moveTo(($event.target as HTMLSelectElement).value)">
        <option value="">Unsorted</option>
        <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </template>

    <button class="btn-danger" @click="removeFromList">Remove from list</button>
  </BottomSheet>
</template>

<style scoped>
.split {
  display: flex;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.split__qty {
  flex: none;
  width: 84px;
}
.split__grow {
  flex: 1;
  min-width: 0;
}
.lbl {
  display: block;
  margin-bottom: var(--s-1);
  font-size: var(--t-caption);
  font-weight: 600;
  color: var(--c-text-dim);
}
.input {
  margin-bottom: var(--s-4);
}
.split .input {
  margin-bottom: 0;
}
</style>
