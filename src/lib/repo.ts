import type { EntityTable, TableRowMap } from '@shared/types';
import { db } from './idb';

export interface RowRef<K extends EntityTable = EntityTable> {
  table: K;
  row: TableRowMap[K];
}

/** Write rows to their object stores in one transaction; optionally queue them for push. */
export async function writeRows(refs: RowRef[], markPending: boolean): Promise<void> {
  if (refs.length === 0) return;
  const conn = await db();
  const stores = Array.from(new Set(refs.map((r) => r.table)));
  const tx = conn.transaction([...stores, 'pending'], 'readwrite');
  for (const { table, row } of refs) {
    void tx.objectStore(table).put(row);
    if (markPending) {
      void tx.objectStore('pending').put({ table, id: row.id });
    }
  }
  await tx.done;
}

export async function readPending(): Promise<{ table: EntityTable; id: string }[]> {
  const conn = await db();
  return conn.getAll('pending');
}

export async function removePending(
  entries: { table: EntityTable; id: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  const conn = await db();
  const tx = conn.transaction('pending', 'readwrite');
  for (const e of entries) void tx.objectStore('pending').delete([e.table, e.id]);
  await tx.done;
}
