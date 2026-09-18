import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Area,
  EntityTable,
  Need,
  Placement,
  Product,
  Store,
  TableRowMap,
} from '@shared/types';
import { ENTITY_TABLES } from '@shared/types';

interface GrocerySchema extends DBSchema {
  products: { key: string; value: Product };
  stores: { key: string; value: Store };
  areas: { key: string; value: Area };
  placements: { key: string; value: Placement };
  needs: { key: string; value: Need };
  /** ids of locally-changed rows not yet acknowledged by the server */
  pending: { key: [EntityTable, string]; value: { table: EntityTable; id: string } };
  /** singletons: sync cursor, etc. */
  meta: { key: string; value: unknown };
}

const DB_NAME = 'family-grocery';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GrocerySchema>> | null = null;

export function db(): Promise<IDBPDatabase<GrocerySchema>> {
  if (!dbPromise) {
    dbPromise = openDB<GrocerySchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        for (const table of ENTITY_TABLES) {
          if (!database.objectStoreNames.contains(table)) {
            database.createObjectStore(table, { keyPath: 'id' });
          }
        }
        database.createObjectStore('pending', { keyPath: ['table', 'id'] });
        database.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export async function loadTable<K extends EntityTable>(
  table: K,
): Promise<TableRowMap[K][]> {
  const conn = await db();
  return (await conn.getAll(table)) as TableRowMap[K][];
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const conn = await db();
  return (await conn.get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const conn = await db();
  await conn.put('meta', value, key);
}

export async function clearAll(): Promise<void> {
  const conn = await db();
  const tx = conn.transaction(
    [...ENTITY_TABLES, 'pending', 'meta'],
    'readwrite',
  );
  await Promise.all([
    ...ENTITY_TABLES.map((t) => tx.objectStore(t).clear()),
    tx.objectStore('pending').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
}

export type { GrocerySchema };
