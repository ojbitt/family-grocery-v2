import type { ChangeSet, EntityTable } from '../shared/types';
import { ENTITY_TABLES } from '../shared/types';

/** Column order per table. `id` first, `updated_at` and `deleted` last. */
export const TABLE_COLUMNS: Record<EntityTable, readonly string[]> = {
  products: ['id', 'name', 'default_qty', 'note', 'updated_at', 'deleted'],
  stores: ['id', 'name', 'updated_at', 'deleted'],
  areas: ['id', 'store_id', 'name', 'position', 'updated_at', 'deleted'],
  placements: ['id', 'product_id', 'store_id', 'area_id', 'position', 'updated_at', 'deleted'],
  needs: ['id', 'product_id', 'qty', 'note', 'status', 'updated_at', 'deleted'],
};

/** Columns that must never be null in a well-formed row (besides id). */
const REQUIRED: Record<EntityTable, readonly string[]> = {
  products: ['name'],
  stores: ['name'],
  areas: ['store_id', 'name', 'position'],
  placements: ['product_id', 'store_id', 'position'],
  needs: ['product_id', 'status'],
};

export interface IncomingRow {
  id: string;
  updated_at: number;
  deleted: 0 | 1;
  [k: string]: unknown;
}

/** Validate + normalize a row coming from a client. Returns null if unusable. */
export function normalizeRow(table: EntityTable, raw: unknown): IncomingRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 200) return null;
  if (typeof r.updated_at !== 'number' || !Number.isFinite(r.updated_at)) return null;

  const deleted = r.deleted === 1 || r.deleted === true ? 1 : 0;

  for (const col of REQUIRED[table]) {
    if (deleted === 0 && (r[col] === undefined || r[col] === null)) return null;
  }

  const out: IncomingRow = { id: r.id, updated_at: Math.floor(r.updated_at), deleted };
  for (const col of TABLE_COLUMNS[table]) {
    if (col === 'id' || col === 'updated_at' || col === 'deleted') continue;
    const v = r[col];
    if (v === undefined || v === null) {
      out[col] = null;
    } else if (col === 'position') {
      out[col] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    } else {
      out[col] = String(v);
    }
  }
  return out;
}

/**
 * Build a last-write-wins upsert for one row.
 * Stored `updated_at` becomes `serverNow`; the conflict is only applied when the
 * client-claimed timestamp is >= the currently stored one.
 */
export function buildUpsert(
  db: D1Database,
  table: EntityTable,
  row: IncomingRow,
  serverNow: number,
): D1PreparedStatement {
  const cols = TABLE_COLUMNS[table];
  const placeholders = cols.map(() => '?').join(', ');
  const setClause = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const sql = `INSERT INTO ${table} (${cols.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${setClause}
    WHERE ? >= ${table}.updated_at`;

  const values = cols.map((c) => {
    if (c === 'updated_at') return serverNow;
    if (c === 'id') return row.id;
    if (c === 'deleted') return row.deleted;
    return row[c] ?? null;
  });
  values.push(row.updated_at); // the LWW comparison uses the client-claimed timestamp

  return db.prepare(sql).bind(...values);
}

/** Pull every row changed after `cursor`, across all tables. */
export async function pullChanges(db: D1Database, cursor: number): Promise<ChangeSet> {
  const out: ChangeSet = {};
  for (const table of ENTITY_TABLES) {
    const cols = TABLE_COLUMNS[table].join(', ');
    const res = await db
      .prepare(`SELECT ${cols} FROM ${table} WHERE updated_at > ? ORDER BY updated_at ASC`)
      .bind(cursor)
      .all();
    // D1 returns deleted/position as numbers already.
    (out as Record<string, unknown>)[table] = res.results ?? [];
  }
  return out;
}
