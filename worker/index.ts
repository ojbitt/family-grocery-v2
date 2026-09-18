// Cloudflare Worker entry. Handles /api/*; everything else is served by [assets].
// See docs/specs.md §6–§8.

import type { AuthResponse, SyncRequest } from '../shared/types';
import {
  isAuthed,
  issueToken,
  getPasswordHash,
  logAuthEvent,
  readAuthLog,
  revokeAllTokens,
  setPassword,
  verifyPassword,
} from './auth';
import { runSync, SyncError } from './sync';

export interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
  /** Optional: if set, /api/setup also requires this value in the body as `key`. */
  SETUP_KEY?: string;
  /** Rate limiters (see wrangler.toml). Optional so tests/dev without them still run. */
  AUTH_RL?: RateLimit;
  API_RL?: RateLimit;
}

/** Largest request body we'll read, in bytes. Real syncs are a few KB. */
const MAX_BODY_BYTES = 512 * 1024;

const json = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const tooMany = () =>
  json({ error: 'rate limited — slow down' }, 429, { 'Retry-After': '60' });

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

/** True if the limiter says this key is over budget. Absent binding => allowed. */
async function limited(rl: RateLimit | undefined, key: string): Promise<boolean> {
  if (!rl) return false;
  try {
    const { success } = await rl.limit({ key });
    return !success;
  } catch {
    return false; // never let the limiter itself break the API
  }
}

function oversize(req: Request): boolean {
  const len = Number(req.headers.get('content-length') ?? '0');
  return Number.isFinite(len) && len > MAX_BODY_BYTES;
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handleSetup(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ password?: string; key?: string }>(req);
  const password = body?.password?.trim();
  if (!password || password.length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400);
  }
  if (env.SETUP_KEY && body?.key !== env.SETUP_KEY) {
    await logAuthEvent(env, req, 'setup', false);
    return json({ error: 'setup key required' }, 403);
  }
  if (await getPasswordHash(env)) {
    await logAuthEvent(env, req, 'setup', false);
    return json({ error: 'already configured' }, 409);
  }
  await setPassword(env, password);
  const token = await issueToken(env);
  await logAuthEvent(env, req, 'setup', true);
  return json({ token } satisfies AuthResponse);
}

async function handleAuth(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ password?: string }>(req);
  const password = body?.password ?? '';
  if (!(await getPasswordHash(env))) {
    return json({ error: 'not configured' }, 409);
  }
  if (!(await verifyPassword(env, password))) {
    await logAuthEvent(env, req, 'unlock', false);
    // small fixed-ish delay: makes guessing slower without burning CPU
    await sleep(400 + Math.floor(Math.random() * 200));
    return json({ error: 'invalid password' }, 403);
  }
  const token = await issueToken(env);
  await logAuthEvent(env, req, 'unlock', true);
  return json({ token } satisfies AuthResponse);
}

async function handleLogoutAll(req: Request, env: Env): Promise<Response> {
  await req.text().catch(() => undefined); // drain the body before responding
  if (!(await isAuthed(req, env))) return json({ error: 'unauthorized' }, 401);
  const count = await revokeAllTokens(env);
  await logAuthEvent(env, req, 'logout-all', true);
  return json({ ok: true, count });
}

async function handleAuthLog(req: Request, env: Env): Promise<Response> {
  if (!(await isAuthed(req, env))) return json({ error: 'unauthorized' }, 401);
  return json({ entries: await readAuthLog(env, 100) });
}

async function handleSync(req: Request, env: Env): Promise<Response> {
  if (!(await isAuthed(req, env))) return json({ error: 'unauthorized' }, 401);
  const body = await readJson<SyncRequest>(req);
  if (!body || typeof body !== 'object') return json({ error: 'bad request' }, 400);
  try {
    const result = await runSync(env, body);
    return json(result);
  } catch (err) {
    if (err instanceof SyncError) return json({ error: err.message }, 400);
    throw err;
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (!pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    if (oversize(req)) return json({ error: 'payload too large' }, 413);

    const ip = clientIp(req);
    const isAuthRoute = pathname === '/api/auth' || pathname === '/api/setup';

    try {
      // every /api/* call counts against the per-IP budget…
      if (await limited(env.API_RL, ip)) return tooMany();
      // …and the auth routes get a much tighter one on top.
      if (isAuthRoute && (await limited(env.AUTH_RL, `auth:${ip}`))) return tooMany();

      if (pathname === '/api/health') {
        return json({ ok: true, ts: Date.now(), configured: Boolean(await getPasswordHash(env)) });
      }
      if (pathname === '/api/setup' && req.method === 'POST') {
        return await handleSetup(req, env);
      }
      if (pathname === '/api/auth' && req.method === 'POST') {
        return await handleAuth(req, env);
      }
      if (pathname === '/api/logout-all' && req.method === 'POST') {
        return await handleLogoutAll(req, env);
      }
      if (pathname === '/api/auth-log' && req.method === 'GET') {
        return await handleAuthLog(req, env);
      }
      if (pathname === '/api/sync' && req.method === 'POST') {
        return await handleSync(req, env);
      }
      return json({ error: 'not found' }, 404);
    } catch (err) {
      console.error('worker error', err);
      return json({ error: 'internal error' }, 500);
    }
  },
};
