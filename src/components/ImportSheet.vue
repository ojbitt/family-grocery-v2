<script setup lang="ts">
import { ref } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { clearCatalog, importData, readImport, type ImportSummary } from '@/lib/portable';
import { showToast } from '@/lib/toast';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const text = ref('');
const replace = ref(false);
const busy = ref(false);
const result = ref<ImportSummary | null>(null);
const problems = ref<string[]>([]);

function reset() {
  result.value = null;
  problems.value = [];
  replace.value = false;
}

async function run() {
  if (busy.value || !text.value.trim()) return;
  busy.value = true;
  result.value = null;
  problems.value = [];
  try {
    const parsed = readImport(text.value);
    if (!parsed.ok) {
      problems.value = parsed.errors;
      return;
    }
    if (replace.value) await clearCatalog();
    result.value = await importData(parsed.data);
    problems.value = [...parsed.warnings, ...result.value.errors];
    const s = result.value;
    showToast(`Imported — ${s.productsAdded} new, ${s.productsUpdated} updated`);
    text.value = '';
  } catch (err) {
    problems.value = [err instanceof Error ? err.message : 'Import failed'];
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BottomSheet
    :open="open"
    title="Import"
    @update:open="
      (v) => {
        emit('update:open', v);
        if (!v) reset();
      }
    "
  >
    <p class="hint">
      Paste JSON, or a plain list of product names (one per line, optionally
      <code>name, qty, note</code>). Existing stores and products are matched by
      name, not duplicated.
    </p>
    <p class="hint hint--tip">
      Tip: Export first, edit that JSON, paste it back.
    </p>

    <details class="fmt">
      <summary>JSON format</summary>
      <pre>{
  "stores": [
    { "name": "Lidl", "aisles": ["Produce", "Dairy"] }
  ],
  "products": [
    { "name": "Milk", "qty": "2 L", "note": "semi-skimmed",
      "stores": ["Lidl: Dairy", "Costco"] }
  ]
}</pre>
    </details>

    <textarea
      v-model="text"
      class="input ta"
      rows="8"
      placeholder="Paste here…"
      spellcheck="false"
    />

    <div v-if="result" class="res">
      <span v-if="result.storesAdded">+{{ result.storesAdded }} stores</span>
      <span v-if="result.aislesAdded">+{{ result.aislesAdded }} aisles</span>
      <span v-if="result.productsAdded">+{{ result.productsAdded }} products</span>
      <span v-if="result.productsUpdated">{{ result.productsUpdated }} updated</span>
      <span v-if="result.placementsAdded">+{{ result.placementsAdded }} placements</span>
      <span v-if="!result.storesAdded && !result.aislesAdded && !result.productsAdded && !result.productsUpdated && !result.placementsAdded">
        No changes
      </span>
    </div>

    <ul v-if="problems.length" class="probs">
      <li v-for="(p, i) in problems" :key="i">{{ p }}</li>
    </ul>

    <label class="replace">
      <input type="checkbox" v-model="replace" />
      Clear all current stores &amp; products first (replace)
    </label>

    <button class="btn-primary" :class="{ 'go--danger': replace }" :disabled="busy || !text.trim()" @click="run">
      {{ busy ? 'Importing…' : replace ? 'Replace & import' : 'Import' }}
    </button>
  </BottomSheet>
</template>

<style scoped>
.hint {
  margin: 0 0 var(--s-3);
  color: var(--c-text-dim);
  font-size: var(--t-body-sm);
  line-height: 1.5;
}
.hint code {
  background: var(--c-surface-2);
  padding: 0 4px;
  border-radius: var(--r-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.fmt {
  margin-bottom: var(--s-3);
  font-size: var(--t-body-sm);
  color: var(--c-text-dim);
}
.fmt summary {
  cursor: pointer;
  font-weight: 600;
}
.fmt pre {
  margin: var(--s-2) 0 0;
  padding: var(--s-3);
  background: var(--c-surface-2);
  border-radius: var(--r-md);
  overflow-x: auto;
  font-size: var(--t-caption);
  line-height: 1.5;
}
.hint--tip {
  margin-top: calc(-1 * var(--s-2));
  color: var(--c-text-faint);
}
.ta {
  margin-bottom: var(--s-3);
  font-size: var(--t-body-sm); /* 16px — also keeps iOS Safari from zooming on focus */
  resize: vertical;
}
.res {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
  font-size: var(--t-caption);
  font-weight: 600;
  color: var(--c-accent);
}
.probs {
  margin: 0 0 var(--s-3);
  padding-left: var(--s-4);
  color: var(--c-danger);
  font-size: var(--t-body-sm);
  line-height: 1.5;
}
.replace {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
  font-size: var(--t-body-sm);
  color: var(--c-text-dim);
}
.replace input {
  width: 18px;
  height: 18px;
  accent-color: var(--c-danger);
  flex: none;
}
.go--danger {
  background: var(--c-danger);
  color: #fff;
}
</style>
