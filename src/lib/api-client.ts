'use client';

// Typed API client for the browser. Wraps fetch with:
//   - JSON content-type by default
//   - automatic 401 -> redirect to /login
//   - typed responses
//   - error extraction

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin', // send the httpOnly session cookie
  });

  if (res.status === 401) {
    // Session expired or absent -> go to login (only if we're not already there).
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, '未登录或会话已过期');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data ? (data as { error: string }).error : null) ?? `请求失败 (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return data as T;
}
