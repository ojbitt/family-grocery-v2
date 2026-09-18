import type { AuthLogResponse, AuthResponse, SyncRequest, SyncResponse } from '@shared/types';

const TOKEN_KEY = 'grocery:token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export interface HealthResponse {
  ok: boolean;
  ts: number;
  configured: boolean;
}

export const api = {
  health: () =>
    fetch('/api/health').then((r) => r.json() as Promise<HealthResponse>),
  setup: (password: string) => post<AuthResponse>('/api/setup', { password }, false),
  auth: (password: string) => post<AuthResponse>('/api/auth', { password }, false),
  logoutAll: () => post<{ ok: boolean; count: number }>('/api/logout-all', {}),
  authLog: () => get<AuthLogResponse>('/api/auth-log'),
  sync: (req: SyncRequest) => post<SyncResponse>('/api/sync', req),
};
