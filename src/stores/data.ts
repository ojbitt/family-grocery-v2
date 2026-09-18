import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { BaseRow, ChangeSet, EntityTable, TableRowMap } from '@shared/types';
import { ENTITY_TABLES } from '@shared/types';
import { getMeta, loadTable, setMeta, clearAll } from '@/lib/idb';
import { writeRows, type RowRef } from '@/lib/repo';
import { scheduleSync } from '@/lib/sync';

type AnyMap = Map<string, BaseRow>;

export const useDataStore = defineStore('data', () => {
  const products = reactive(new Map<string, TableRowMap['products']>());
  const stores = reactive(new Map<string, TableRowMap['stores']>());
  const areas = reactive(new Map<string, TableRowMap['areas']>());
  const placements = reactive(new Map<string, TableRowMap['placements']>());
  const needs = reactive(new Map<string, TableRowMap['needs']>());

  const byTable: Record<EntityTable, AnyMap> = {
    products: products as unknown as AnyMap,
    stores: stores as unknown as AnyMap,
    areas: areas as unknown as AnyMap,
    placements: placements as unknown as AnyMap,
    needs: needs as unknown as AnyMap,
  };

  const cursor = ref(0);
  const loaded = ref(false);

  async function load(): Promise<void> {
    if (loaded.value) return;
    for (const table of ENTITY_TABLES) {
      const rows = await loadTable(table);
      const map = byTable[table];
      map.clear();
      for (const row of rows) map.set(row.id, row);
    }
    cursor.value = (await getMeta<number>('cursor')) ?? 0;
    loaded.value = true;
  }

  /** All non-tombstoned rows of a table. */
  function active<K extends EntityTable>(table: K): TableRowMap[K][] {
    return [...byTable[table].values()].filter((r) => !r.deleted) as TableRowMap[K][];
  }

  function get<K extends EntityTable>(table: K, id: string): TableRowMap[K] | undefined {
    return byTable[table].get(id) as TableRowMap[K] | undefined;
  }

  /** Apply a local edit: stamp the clock, persist, queue for push, nudge sync. */
  async function applyLocal(refs: RowRef[]): Promise<void> {
    const now = Date.now();
    for (const { table, row } of refs) {
      (row as BaseRow).updated_at = now;
      byTable[table].set(row.id, row as BaseRow);
    }
    await writeRows(refs, true);
    scheduleSync();
  }

  function upsert<K extends EntityTable>(
    table: K,
    row: Omit<TableRowMap[K], 'updated_at'> & { updated_at?: number },
  ): Promise<void> {
    return applyLocal([{ table, row: { ...row, updated_at: 0 } as TableRowMap[K] }]);
  }

  function remove<K extends EntityTable>(table: K, id: string): Promise<void> {
    const existing = byTable[table].get(id);
    if (!existing) return Promise.resolve();
    return applyLocal([{ table, row: { ...existing, deleted: 1 } as BaseRow as TableRowMap[K] }]);
  }

  /** Merge server rows in (last-write-wins; our own just-pushed rows are forced). */
  async function applyRemote(
    changes: ChangeSet,
    newCursor: number,
    forceIds: Set<string>,
  ): Promise<void> {
    const toWrite: RowRef[] = [];
    for (const table of ENTITY_TABLES) {
      const rows = (changes as Record<string, BaseRow[]>)[table];
      if (!rows) continue;
      const map = byTable[table];
      for (const row of rows) {
        const local = map.get(row.id);
        const take = !local || forceIds.has(row.id) || row.updated_at >= local.updated_at;
        if (take) {
          map.set(row.id, row);
          toWrite.push({ table, row } as RowRef);
        }
      }
    }
    cursor.value = newCursor;
    await writeRows(toWrite, false);
    await setMeta('cursor', newCursor);
  }

  /** Gather the full current rows for the queued (table,id) pairs. */
  function collectChanges(pending: { table: EntityTable; id: string }[]): ChangeSet {
    const changes: ChangeSet = {};
    for (const { table, id } of pending) {
      const row = byTable[table].get(id);
      if (!row) continue;
      ((changes as Record<string, BaseRow[]>)[table] ??= []).push(row);
    }
    return changes;
  }

  async function reset(): Promise<void> {
    await clearAll();
    for (const table of ENTITY_TABLES) byTable[table].clear();
    cursor.value = 0;
    loaded.value = false;
  }

  return {
    products,
    stores,
    areas,
    placements,
    needs,
    cursor,
    loaded,
    load,
    active,
    get,
    applyLocal,
    upsert,
    remove,
    applyRemote,
    collectChanges,
    reset,
  };
});
