// Import / export the catalog as plain JSON. Everything created here syncs like
// any other local change.

import { ENTITY_TABLES } from '@shared/types';
import { useDataStore } from '@/stores/data';
import type { RowRef } from './repo';
import { needId, placementId } from './ids';
import {
  areasForStore,
  createArea,
  createProduct,
  createStore,
  setNeeded,
  setPlacement,
  updateProduct,
} from './domain';

export interface PortableProduct {
  name: string;
  qty?: string | null;
  note?: string | null;
  needed?: boolean;
  /** store names this product is bought at; optionally "Store: Aisle" */
  stores?: string[];
}

export interface PortableStore {
  name: string;
  aisles?: string[];
}

export interface PortableData {
  stores?: PortableStore[];
  products?: PortableProduct[];
}

export interface ImportSummary {
  storesAdded: number;
  aislesAdded: number;
  productsAdded: number;
  productsUpdated: number;
  placementsAdded: number;
  errors: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

export type ReadResult =
  | { ok: true; data: PortableData; warnings: string[] }
  | { ok: false; errors: string[] };

const isStr = (v: unknown): v is string => typeof v === 'string';
const looksLikeJson = (t: string) => /^[[{]/.test(t);

/**
 * Parse + validate import text. Returns typed errors instead of throwing so the
 * UI can show them and import nothing on a bad file.
 *
 * Accepts: a JSON object `{ stores?, products? }`, a JSON array of product
 * names/objects, or plain text (one product per line, `name, qty, note`).
 */
export function readImport(input: string): ReadResult {
  const text = input.trim();
  if (!text) return { ok: false, errors: ['Nothing to import — paste some data first.'] };

  // plain text (only when it clearly isn't JSON)
  if (!looksLikeJson(text)) {
    const products: PortableProduct[] = [];
    text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [name, qty, note] = line.split(',').map((p) => p.trim());
        if (name) products.push({ name, qty: qty || null, note: note || null });
      });
    if (!products.length) return { ok: false, errors: ['No product names found.'] };
    return { ok: true, data: { products }, warnings: [] };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const readProduct = (p: unknown, where: string): PortableProduct | null => {
    if (isStr(p)) return p.trim() ? { name: p.trim() } : null;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push(`${where}: expected a name or an object`);
      return null;
    }
    const o = p as Record<string, unknown>;
    if (!isStr(o.name) || !o.name.trim()) {
      errors.push(`${where}: missing "name"`);
      return null;
    }
    for (const k of ['qty', 'note'] as const) {
      if (o[k] !== undefined && o[k] !== null && !isStr(o[k])) {
        errors.push(`${where} "${o.name}": "${k}" must be text or null`);
      }
    }
    if (o.needed !== undefined && typeof o.needed !== 'boolean') {
      errors.push(`${where} "${o.name}": "needed" must be true/false`);
    }
    if (o.stores !== undefined && (!Array.isArray(o.stores) || !o.stores.every(isStr))) {
      errors.push(`${where} "${o.name}": "stores" must be a list of store names`);
    }
    return {
      name: o.name.trim(),
      qty: isStr(o.qty) ? o.qty : o.qty === null ? null : undefined,
      note: isStr(o.note) ? o.note : o.note === null ? null : undefined,
      needed: typeof o.needed === 'boolean' ? o.needed : undefined,
      stores: Array.isArray(o.stores) ? o.stores.filter(isStr) : undefined,
    };
  };

  const data: PortableData = {};

  if (Array.isArray(value)) {
    data.products = value
      .map((p, i) => readProduct(p, `products[${i}]`))
      .filter((p): p is PortableProduct => p !== null);
  } else if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    for (const key of Object.keys(v)) {
      if (key !== 'stores' && key !== 'products') warnings.push(`ignored unknown field "${key}"`);
    }
    if (v.stores !== undefined) {
      if (!Array.isArray(v.stores)) {
        errors.push('"stores" must be a list');
      } else {
        data.stores = [];
        v.stores.forEach((s, i) => {
          if (!s || typeof s !== 'object' || !isStr((s as PortableStore).name) || !(s as PortableStore).name.trim()) {
            errors.push(`stores[${i}]: missing "name"`);
            return;
          }
          const so = s as Record<string, unknown>;
          if (so.aisles !== undefined && (!Array.isArray(so.aisles) || !so.aisles.every(isStr))) {
            errors.push(`store "${so.name}": "aisles" must be a list of names`);
          }
          data.stores!.push({
            name: (so.name as string).trim(),
            aisles: Array.isArray(so.aisles) ? so.aisles.filter(isStr) : undefined,
          });
        });
      }
    }
    if (v.products !== undefined) {
      if (!Array.isArray(v.products)) {
        errors.push('"products" must be a list');
      } else {
        data.products = v.products
          .map((p, i) => readProduct(p, `products[${i}]`))
          .filter((p): p is PortableProduct => p !== null);
      }
    }
  } else {
    return { ok: false, errors: ['Expected a JSON object or array.'] };
  }

  if (!data.stores?.length && !data.products?.length) {
    errors.push('Nothing to import — no "stores" or "products".');
  }
  // cap to keep a paste from blowing up the DB
  const total = (data.stores?.length ?? 0) + (data.products?.length ?? 0);
  if (total > 2000) errors.push(`Too many rows (${total}); import at most 2000 at a time.`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, data, warnings };
}

/** Tombstone every store, aisle, product, placement and need. Syncs like any delete. */
export async function clearCatalog(): Promise<number> {
  const store = useDataStore();
  const refs: RowRef[] = [];
  for (const table of ENTITY_TABLES) {
    for (const row of store.active(table)) {
      refs.push({ table, row: { ...row, deleted: 1 } } as RowRef);
    }
  }
  if (refs.length) await store.applyLocal(refs);
  return refs.length;
}

export async function importData(data: PortableData): Promise<ImportSummary> {
  const store = useDataStore();
  const summary: ImportSummary = {
    storesAdded: 0,
    aislesAdded: 0,
    productsAdded: 0,
    productsUpdated: 0,
    placementsAdded: 0,
    errors: [],
  };

  const storeIdByName = new Map<string, string>();
  for (const s of store.active('stores')) storeIdByName.set(norm(s.name), s.id);

  async function resolveStore(name: string): Promise<string> {
    const key = norm(name);
    const existing = storeIdByName.get(key);
    if (existing) return existing;
    const id = await createStore(name.trim());
    storeIdByName.set(key, id);
    summary.storesAdded++;
    return id;
  }

  async function resolveArea(storeId: string, name: string): Promise<string> {
    const found = areasForStore(storeId).find((a) => norm(a.name) === norm(name));
    if (found) return found.id;
    const id = await createArea(storeId, name.trim());
    summary.aislesAdded++;
    return id;
  }

  for (const s of data.stores ?? []) {
    try {
      const id = await resolveStore(s.name);
      for (const aisle of s.aisles ?? []) {
        if (aisle?.trim()) await resolveArea(id, aisle);
      }
    } catch (e) {
      summary.errors.push(`store "${s.name}": ${(e as Error).message}`);
    }
  }

  const productIdByName = new Map<string, string>();
  for (const p of store.active('products')) productIdByName.set(norm(p.name), p.id);

  for (const p of data.products ?? []) {
    try {
      const key = norm(p.name);
      let id = productIdByName.get(key);
      if (id) {
        const patch: Record<string, string | null> = {};
        if (p.qty !== undefined) patch.default_qty = p.qty?.trim() || null;
        if (p.note !== undefined) patch.note = p.note?.trim() || null;
        if (Object.keys(patch).length) {
          await updateProduct(id, patch);
          summary.productsUpdated++;
        }
      } else {
        id = await createProduct({
          name: p.name,
          default_qty: p.qty ?? null,
          note: p.note ?? null,
        });
        productIdByName.set(key, id);
        summary.productsAdded++;
      }

      for (const entry of p.stores ?? []) {
        const [storeName, aisleName] = String(entry).split(':').map((x) => x.trim());
        if (!storeName) continue;
        const storeId = await resolveStore(storeName);
        const areaId = aisleName ? await resolveArea(storeId, aisleName) : null;
        if (!store.get('placements', placementId(id, storeId))) summary.placementsAdded++;
        await setPlacement(id, storeId, areaId);
      }

      if (p.needed) await setNeeded(id, true);
    } catch (e) {
      summary.errors.push(`product "${p.name}": ${(e as Error).message}`);
    }
  }

  return summary;
}

/** Dump the current catalog to a PortableData object (round-trips with importData). */
export function exportData(): PortableData {
  const store = useDataStore();
  const storeName = (id: string) => store.get('stores', id)?.name ?? '';
  const areaName = (id: string | null) =>
    id ? (store.get('areas', id)?.name ?? '') : '';

  return {
    stores: store
      .active('stores')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        name: s.name,
        aisles: areasForStore(s.id).map((a) => a.name),
      })),
    products: store
      .active('products')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const need = store.get('needs', needId(p.id));
        const stores = store
          .active('placements')
          .filter((pl) => pl.product_id === p.id)
          .map((pl) => {
            const aisle = areaName(pl.area_id);
            return aisle ? `${storeName(pl.store_id)}: ${aisle}` : storeName(pl.store_id);
          })
          .filter(Boolean);
        return {
          name: p.name,
          ...(p.default_qty ? { qty: p.default_qty } : {}),
          ...(p.note ? { note: p.note } : {}),
          ...(need && !need.deleted ? { needed: true } : {}),
          ...(stores.length ? { stores } : {}),
        };
      }),
  };
}
