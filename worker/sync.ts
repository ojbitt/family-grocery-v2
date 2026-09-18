import type { Env } from './index';
import type { EntityTable, SyncRequest, SyncResponse } from '../shared/types';
import { ENTITY_TABLES } from '../shared/types';
import { buildUpsert, normalizeRow, pullChanges } from './db';

const MAX_ROWS_PER_SYNC = 5000;

/**
 * Apply the client's changes (last-write-wins on the client-claimed timestamp,
 * stored with the server clock), then return everything changed since `cursor`.
 * See docs/specs.md §6.
 */
export async function runSync(env: Env, body: SyncRequest): Promise<SyncResponse> {
  const cursor = Number.isFinite(body?.cursor) ? Math.floor(body.cursor) : 0;
  const serverNow = Date.now();

  const statements: D1PreparedStatement[] = [];
  const incoming = body?.changes ?? {};

  for (const table of ENTITY_TABLES) {
    const rows = (incoming as Record<string, unknown>)[table];
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      const row = normalizeRow(table as EntityTable, raw);
      if (!row) continue;
      statements.push(buildUpsert(env.DB, table as EntityTable, row, serverNow));
      if (statements.length > MAX_ROWS_PER_SYNC) {
        throw new SyncError('too many rows in one sync');
      }
    }
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  const changes = await pullChanges(env.DB, cursor);
  return { cursor: serverNow, changes };
}

export class SyncError extends Error {}
