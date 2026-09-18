import type { AuthEventKind, AuthLogEntry } from '../shared/types';
import type { Env } from './index';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}

export function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

/** Constant-time-ish string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function getPasswordHash(env: Env): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM app_meta WHERE key = 'password_hash'`).first<{
    value: string;
  }>();
  return row?.value ?? null;
}

export async function issueToken(env: Env): Promise<string> {
  const token = randomToken();
  await env.DB.prepare(`INSERT INTO tokens (token, created_at) VALUES (?, ?)`)
    .bind(token, Date.now())
    .run();
  return token;
}

/** Delete every issued token. Returns how many sessions were revoked. */
export async function revokeAllTokens(env: Env): Promise<number> {
  const res = await env.DB.prepare(`DELETE FROM tokens`).run();
  return res.meta.changes ?? 0;
}

/** Record one sign-in attempt. Never throws — logging must not break auth. */
export async function logAuthEvent(
  env: Env,
  req: Request,
  kind: AuthEventKind,
  ok: boolean,
): Promise<void> {
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 400) || null;
  const ip = req.headers.get('cf-connecting-ip') ?? null;
  try {
    await env.DB.prepare(
      `INSERT INTO auth_log (at, kind, ok, user_agent, ip) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(Date.now(), kind, ok ? 1 : 0, ua, ip)
      .run();
    // trim to the most recent ~500 rows, but only occasionally — one extra write
    // per login is wasteful, and this table is already tiny.
    if (Math.random() < 0.1) {
      await env.DB.prepare(
        `DELETE FROM auth_log WHERE id <= (
           SELECT id FROM auth_log ORDER BY id DESC LIMIT 1 OFFSET 500
         )`,
      ).run();
    }
  } catch {
    /* ignore */
  }
}

export async function readAuthLog(env: Env, limit = 100): Promise<AuthLogEntry[]> {
  const res = await env.DB.prepare(
    `SELECT at, kind, ok, user_agent, ip FROM auth_log ORDER BY id DESC LIMIT ?`,
  )
    .bind(Math.min(Math.max(Math.floor(limit) || 0, 1), 500))
    .all<AuthLogEntry>();
  return res.results ?? [];
}

export async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const stored = await getPasswordHash(env);
  if (!stored) return false;
  const hash = await hmacHex(password, env.AUTH_SECRET);
  return safeEqual(hash, stored);
}

export async function setPassword(env: Env, password: string): Promise<void> {
  const hash = await hmacHex(password, env.AUTH_SECRET);
  await env.DB.prepare(`INSERT INTO app_meta (key, value) VALUES ('password_hash', ?)`)
    .bind(hash)
    .run();
}

export async function isAuthed(req: Request, env: Env): Promise<boolean> {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  if (!token) return false;
  const row = await env.DB.prepare(`SELECT created_at FROM tokens WHERE token = ?`)
    .bind(token)
    .first<{ created_at: number }>();
  if (!row) return false;
  if (Date.now() - row.created_at > TOKEN_TTL_MS) {
    await env.DB.prepare(`DELETE FROM tokens WHERE token = ?`).bind(token).run();
    return false;
  }
  return true;
}
