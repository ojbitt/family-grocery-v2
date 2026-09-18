// Domain mutations — thin helpers over the data store that keep entity
// invariants (deterministic ids, cascade tombstones, position bookkeeping).
// See docs/specs.md §3.

import type {
  Area,
  BaseRow,
  EntityTable,
  Need,
  NeedStatus,
  Placement,
  Product,
  Store,
} from '@shared/types';
import { useDataStore } from '@/stores/data';
import type { RowRef } from './repo';
import { newId, placementId, needId } from './ids';

function data() {
  return useDataStore();
}

type Ref = { table: EntityTable; row: BaseRow & Record<string, unknown> };

/** Persist a heterogeneous batch of row changes in one local transaction. */
function commit(refs: Ref[]): Promise<void> {
  return data().applyLocal(refs as unknown as RowRef[]);
}

function nextPosition(rows: { position: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.position), 0) + 1;
}

/* ---------- products ---------- */

export async function createProduct(fields: {
  name: string;
  default_qty?: string | null;
  note?: string | null;
}): Promise<string> {
  const id = newId();
  await data().upsert('products', {
    id,
    name: fields.name.trim(),
    default_qty: fields.default_qty?.trim() || null,
    note: fields.note?.trim() || null,
    deleted: 0,
  });
  return id;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const cur = data().get('products', id);
  if (!cur) return;
  await data().upsert('products', { ...cur, ...patch });
}

export async function deleteProduct(id: string): Promise<RestorePoint> {
  const d = data();
  const product = d.get('products', id);
  if (!product) return [];
  const before: Ref[] = [{ table: 'products', row: { ...product } }];
  const refs: Ref[] = [{ table: 'products', row: { ...product, deleted: 1 } }];
  const need = d.get('needs', needId(id));
  if (need && !need.deleted) {
    before.push({ table: 'needs', row: { ...need } });
    refs.push({ table: 'needs', row: { ...need, deleted: 1 } });
  }
  for (const p of d.active('placements')) {
    if (p.product_id === id) {
      before.push({ table: 'placements', row: { ...p } });
      refs.push({ table: 'placements', row: { ...p, deleted: 1 } });
    }
  }
  await commit(refs);
  return before;
}

/* ---------- needs ---------- */

export async function setNeeded(productId: string, needed: boolean): Promise<void> {
  const d = data();
  const id = needId(productId);
  const cur = d.get('needs', id);
  if (needed) {
    await d.upsert('needs', {
      id,
      product_id: productId,
      qty: cur?.qty ?? null,
      note: cur?.note ?? null,
      status: 'needed',
      deleted: 0,
    });
  } else if (cur && !cur.deleted) {
    await d.upsert('needs', { ...cur, deleted: 1 });
  }
}

export async function setNeedStatus(productId: string, status: NeedStatus): Promise<void> {
  const cur = data().get('needs', needId(productId));
  if (!cur) return;
  await data().upsert('needs', { ...cur, status });
}

/**
 * The needs "Finish shopping" would clear for a store: everything on that store's
 * list — bought and not — but not items the store doesn't carry. In "Any store"
 * mode (storeId ''), every active need.
 */
export function needsClearedByFinish(storeId: string): Need[] {
  const d = data();
  const needs = d.active('needs');
  if (!storeId) return needs;
  const placedHere = new Set(
    placementsForStore(storeId).map((p) => p.product_id),
  );
  return needs.filter((n) => n.status === 'in_cart' || placedHere.has(n.product_id));
}

/** Clear the store's list. Returns the pre-delete rows so the caller can offer Undo. */
export async function finishShopping(storeId: string): Promise<RestorePoint> {
  const cleared = needsClearedByFinish(storeId);
  if (cleared.length === 0) return [];
  const before: Ref[] = cleared.map((n) => ({ table: 'needs', row: { ...n } }));
  await commit(cleared.map((n) => ({ table: 'needs', row: { ...n, deleted: 1 } })));
  return before;
}

/* ---------- stores ---------- */

export async function createStore(name: string): Promise<string> {
  const id = newId();
  await data().upsert('stores', { id, name: name.trim(), deleted: 0 });
  return id;
}

export async function updateStore(id: string, patch: Partial<Store>): Promise<void> {
  const cur = data().get('stores', id);
  if (!cur) return;
  await data().upsert('stores', { ...cur, ...patch });
}

/** Snapshot of rows changed by a delete, so the caller can offer Undo. */
export type RestorePoint = Ref[];

export async function restore(point: RestorePoint): Promise<void> {
  if (point.length) await commit(point.map((r) => ({ ...r, row: { ...r.row } })));
}

export async function deleteStore(id: string): Promise<RestorePoint> {
  const d = data();
  const store = d.get('stores', id);
  if (!store) return [];
  const before: Ref[] = [{ table: 'stores', row: { ...store } }];
  const refs: Ref[] = [{ table: 'stores', row: { ...store, deleted: 1 } }];
  for (const a of d.active('areas')) {
    if (a.store_id === id) {
      before.push({ table: 'areas', row: { ...a } });
      refs.push({ table: 'areas', row: { ...a, deleted: 1 } });
    }
  }
  for (const p of d.active('placements')) {
    if (p.store_id === id) {
      before.push({ table: 'placements', row: { ...p } });
      refs.push({ table: 'placements', row: { ...p, deleted: 1 } });
    }
  }
  await commit(refs);
  return before;
}

/* ---------- areas ---------- */

export function areasForStore(storeId: string): Area[] {
  return data()
    .active('areas')
    .filter((a) => a.store_id === storeId)
    .sort((a, b) => a.position - b.position);
}

export async function createArea(storeId: string, name: string): Promise<string> {
  const id = newId();
  await data().upsert('areas', {
    id,
    store_id: storeId,
    name: name.trim(),
    position: nextPosition(areasForStore(storeId)),
    deleted: 0,
  });
  return id;
}

export async function updateArea(id: string, patch: Partial<Area>): Promise<void> {
  const cur = data().get('areas', id);
  if (!cur) return;
  await data().upsert('areas', { ...cur, ...patch });
}

export async function deleteArea(id: string): Promise<RestorePoint> {
  const d = data();
  const area = d.get('areas', id);
  if (!area) return [];
  const before: Ref[] = [{ table: 'areas', row: { ...area } }];
  const refs: Ref[] = [{ table: 'areas', row: { ...area, deleted: 1 } }];
  for (const p of d.active('placements')) {
    if (p.area_id === id) {
      before.push({ table: 'placements', row: { ...p } });
      refs.push({ table: 'placements', row: { ...p, area_id: null } });
    }
  }
  await commit(refs);
  return before;
}

export async function reorderAreas(_storeId: string, orderedIds: string[]): Promise<void> {
  const d = data();
  const refs: Ref[] = [];
  orderedIds.forEach((id, i) => {
    const a = d.get('areas', id);
    if (a && a.position !== i + 1) refs.push({ table: 'areas', row: { ...a, position: i + 1 } });
  });
  if (refs.length) await commit(refs);
}

/* ---------- placements ---------- */

export function placementsForStore(storeId: string): Placement[] {
  return data()
    .active('placements')
    .filter((p) => p.store_id === storeId);
}

export function placement(productId: string, storeId: string): Placement | undefined {
  return data().get('placements', placementId(productId, storeId));
}

export async function setPlacement(
  productId: string,
  storeId: string,
  areaId: string | null,
): Promise<void> {
  const d = data();
  const id = placementId(productId, storeId);
  const cur = d.get('placements', id);
  const siblings = placementsForStore(storeId).filter((p) => p.area_id === areaId);
  await d.upsert('placements', {
    id,
    product_id: productId,
    store_id: storeId,
    area_id: areaId,
    position: cur && cur.area_id === areaId ? cur.position : nextPosition(siblings),
    deleted: 0,
  });
}

export async function removePlacement(productId: string, storeId: string): Promise<void> {
  const cur = data().get('placements', placementId(productId, storeId));
  if (cur && !cur.deleted) await data().upsert('placements', { ...cur, deleted: 1 });
}

/** Renumber the placements of one aisle (areaId null = Unsorted) to match `orderedProductIds`. */
export async function reorderPlacements(
  storeId: string,
  areaId: string | null,
  orderedProductIds: string[],
): Promise<void> {
  const d = data();
  const refs: Ref[] = [];
  orderedProductIds.forEach((pid, i) => {
    const p = d.get('placements', placementId(pid, storeId));
    if (p && !p.deleted && p.area_id === areaId && p.position !== i + 1) {
      refs.push({ table: 'placements', row: { ...p, position: i + 1 } });
    }
  });
  if (refs.length) await commit(refs);
}
