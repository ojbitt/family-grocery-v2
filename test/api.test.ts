import { SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Product, SyncResponse } from '@shared/types';

const PASSWORD = 'family-secret';
let token = '';

// All functional tests share one client IP so the rate-limit buckets are
// predictable. Budget on this IP: <10 auth-route calls, <200 total (see the
// limits in vitest.config.ts). Tests that probe rate limiting use their own IP.
const FN_IP = '203.0.113.7';

async function api(
  path: string,
  body: unknown,
  auth = true,
  ip: string = FN_IP,
): Promise<Response> {
  return SELF.fetch(`https://t.local${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function sync(cursor: number, changes: Record<string, unknown[]>): Promise<SyncResponse> {
  const res = await api('/api/sync', { cursor, changes });
  expect(res.status).toBe(200);
  return (await res.json()) as SyncResponse;
}

function product(over: Partial<Product> & Pick<Product, 'id' | 'name' | 'updated_at'>): Product {
  return { default_qty: null, note: null, deleted: 0, ...over };
}

beforeAll(async () => {
  const setup = await api('/api/setup', { password: PASSWORD }, false);
  expect(setup.status).toBe(200);
  token = ((await setup.json()) as { token: string }).token;
  expect(token).toHaveLength(64);
});

describe('auth', () => {
  it('rejects a second setup', async () => {
    const res = await api('/api/setup', { password: 'another-valid-password' }, false);
    expect(res.status).toBe(409);
  });

  it('rejects a wrong password', async () => {
    const res = await api('/api/auth', { password: 'nope' }, false);
    expect(res.status).toBe(403);
  });

  it('issues a token for the right password', async () => {
    const res = await api('/api/auth', { password: PASSWORD }, false);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { token: string }).token).toHaveLength(64);
  });

  it('rejects sync without a token', async () => {
    const res = await SELF.fetch('https://t.local/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: 0, changes: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('logout-all revokes every token', async () => {
    // a second device signs in
    const other = ((await (await api('/api/auth', { password: PASSWORD }, false)).json()) as {
      token: string;
    }).token;

    const res = await api('/api/logout-all', {});
    expect(res.status).toBe(200);
    expect(((await res.json()) as { count: number }).count).toBeGreaterThanOrEqual(2);

    // both the other device's token and our own are now dead
    for (const dead of [other, token]) {
      const stale = await SELF.fetch('https://t.local/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dead}` },
        body: JSON.stringify({ cursor: 0, changes: {} }),
      });
      expect(stale.status).toBe(401);
    }
  });

  it('rejects logout-all without a token', async () => {
    const res = await SELF.fetch('https://t.local/api/logout-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('records sign-in attempts in the log', async () => {
    await api('/api/auth', { password: 'wrong' }, false); // failure
    await api('/api/auth', { password: PASSWORD }, false); // success

    const res = await SELF.fetch('https://t.local/api/auth-log', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const { entries } = (await res.json()) as {
      entries: { kind: string; ok: 0 | 1 }[];
    };
    // newest first: the successful unlock, then the failed one
    expect(entries[0]).toMatchObject({ kind: 'unlock', ok: 1 });
    expect(entries[1]).toMatchObject({ kind: 'unlock', ok: 0 });
    // the initial setup is in there too
    expect(entries.some((e) => e.kind === 'setup' && e.ok === 1)).toBe(true);
  });

  it('rejects the auth log without a token', async () => {
    const res = await SELF.fetch('https://t.local/api/auth-log');
    expect(res.status).toBe(401);
  });
});

describe('sync merge semantics', () => {
  const now = Date.now();

  it('pushes a row and returns it with a server cursor', async () => {
    const res = await sync(0, {
      products: [product({ id: 'p1', name: 'Milk', updated_at: now })],
    });
    expect(res.cursor).toBeGreaterThan(0);
    expect(res.changes.products).toHaveLength(1);
    expect(res.changes.products?.[0].name).toBe('Milk');
    // server stamps its own clock
    expect(res.changes.products?.[0].updated_at).toBeGreaterThanOrEqual(now - 5000);
  });

  it('last-write-wins: newer client timestamp overwrites', async () => {
    await sync(0, { products: [product({ id: 'p2', name: 'Bread', updated_at: now })] });
    const res = await sync(0, {
      products: [product({ id: 'p2', name: 'Sourdough', updated_at: now + 10_000 })],
    });
    const row = res.changes.products?.find((p) => p.id === 'p2');
    expect(row?.name).toBe('Sourdough');
  });

  it('last-write-wins: older client timestamp is ignored', async () => {
    await sync(0, {
      products: [product({ id: 'p3', name: 'Eggs', updated_at: now + 10_000 })],
    });
    const res = await sync(0, {
      products: [product({ id: 'p3', name: 'STALE', updated_at: now - 10_000 })],
    });
    const row = res.changes.products?.find((p) => p.id === 'p3');
    expect(row?.name).toBe('Eggs');
  });

  it('delta pull: a later cursor excludes earlier rows', async () => {
    const first = await sync(0, {
      products: [product({ id: 'p4', name: 'Apples', updated_at: now })],
    });
    const second = await sync(first.cursor, {
      products: [product({ id: 'p5', name: 'Pears', updated_at: now })],
    });
    const ids = (second.changes.products ?? []).map((p) => p.id);
    expect(ids).toContain('p5');
    expect(ids).not.toContain('p4');
  });

  it('tombstones propagate', async () => {
    await sync(0, { products: [product({ id: 'p6', name: 'Butter', updated_at: now })] });
    const res = await sync(0, {
      // comfortably ahead of the server-stamped time so LWW accepts the delete
      products: [product({ id: 'p6', name: 'Butter', updated_at: now + 60_000, deleted: 1 })],
    });
    const row = res.changes.products?.find((p) => p.id === 'p6');
    expect(row?.deleted).toBe(1);
  });

  it('ignores malformed rows without failing the batch', async () => {
    const res = await sync(0, {
      products: [
        { id: 'p7', updated_at: now }, // missing name
        product({ id: 'p8', name: 'Yogurt', updated_at: now }),
      ] as unknown[],
    });
    const ids = (res.changes.products ?? []).map((p) => p.id);
    expect(ids).toContain('p8');
    expect(ids).not.toContain('p7');
  });
});

describe('abuse protection', () => {
  it('rate-limits repeated auth attempts from one IP', async () => {
    const ip = '198.51.100.42';
    let limitedRes: Response | undefined;
    // AUTH_RL is 10/60s in the test config; a burst blows past it.
    for (let i = 0; i < 20; i++) {
      const res = await api('/api/auth', { password: PASSWORD }, false, ip);
      if (res.status === 429) {
        limitedRes = res;
        break;
      }
    }
    expect(limitedRes).toBeDefined();
    expect(limitedRes?.headers.get('Retry-After')).toBe('60');
  });

  it('rejects an oversized request body', async () => {
    const res = await SELF.fetch('https://t.local/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024),
        'CF-Connecting-IP': '198.51.100.99',
      },
      body: 'x'.repeat(2 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it('setup demands an 8+ character password', async () => {
    const res = await api('/api/setup', { password: 'short' }, false, '198.51.100.7');
    expect(res.status).toBe(400);
  });
});
