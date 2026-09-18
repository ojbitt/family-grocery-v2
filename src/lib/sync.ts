import type { EntityTable } from '@shared/types';
import { api, ApiError, getToken } from './api';
import { readPending, removePending } from './repo';

const DEBOUNCE_MS = 3000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let runAgain = false;
let listenersAttached = false;

async function refreshPendingCount(): Promise<void> {
  const { useSyncStore } = await import('@/stores/sync');
  useSyncStore().setPending((await readPending()).length);
}

/** Push queued local changes, then pull everything changed since our cursor. */
export async function syncNow(): Promise<void> {
  if (!getToken()) return;
  if (running) {
    runAgain = true;
    return;
  }
  running = true;

  const { useDataStore } = await import('@/stores/data');
  const { useSyncStore } = await import('@/stores/sync');
  const data = useDataStore();
  const sync = useSyncStore();

  try {
    if (!data.loaded) await data.load();
    sync.setStatus('syncing');

    const pending = await readPending();
    const changes = data.collectChanges(pending);
    const forceIds = new Set(pending.map((p) => p.id));

    const res = await api.sync({ cursor: data.cursor, changes });

    // Server timestamp for every row it just returned, keyed table:id.
    const serverTs = new Map<string, number>();
    for (const table of Object.keys(res.changes) as EntityTable[]) {
      for (const row of res.changes[table] ?? []) {
        serverTs.set(`${table}:${row.id}`, row.updated_at);
      }
    }

    await data.applyRemote(res.changes, res.cursor, forceIds);

    // A pending row is settled once its local copy matches what the server
    // stored; if a local edit landed during the round trip the timestamps
    // differ and it stays queued for the next push.
    const settled = pending.filter(({ table, id }) => {
      const row = data.get(table as EntityTable, id);
      const ts = serverTs.get(`${table}:${id}`);
      return row !== undefined && ts !== undefined && row.updated_at === ts;
    });
    await removePending(settled);

    await refreshPendingCount();
    sync.setStatus('idle');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const { useAuthStore } = await import('@/stores/auth');
      useAuthStore().signOut();
      sync.setStatus('error', 'signed out');
    } else if (!navigator.onLine) {
      sync.setStatus('offline');
    } else {
      sync.setStatus('error', err instanceof Error ? err.message : 'sync failed');
    }
  } finally {
    running = false;
    if (runAgain) {
      runAgain = false;
      void syncNow();
    }
  }
}

/** Debounced sync — call after any local mutation. */
export function scheduleSync(): void {
  void refreshPendingCount();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

/** Attach lifecycle triggers and run an initial sync. */
export function initSync(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  window.addEventListener('online', () => void syncNow());

  void refreshPendingCount();
  void syncNow();
}
