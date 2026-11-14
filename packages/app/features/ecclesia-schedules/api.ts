import type { ApiResult } from './types'

/** Same-origin JSON calls; every result is `{ ok, status, data | error }`, never a throw. */
export async function callApi<T>(
  url: string,
  init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      cache: 'no-store',
      ...(init?.body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }
        : {}),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, status: res.status, data: json as T }
    return { ok: false, status: res.status, error: json ?? {} }
  } catch {
    return {
      ok: false,
      status: 0,
      error: { error: 'We could not reach the server. Check your connection and try again.', code: 'NETWORK' },
    }
  }
}

/** `path` with `?ecclesia=` when the owner is looking at another ecclesia. */
export function scoped(path: string, ecclesia: string | null, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams(extra)
  if (ecclesia) q.set('ecclesia', ecclesia)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

export const NOT_A_MANAGER = 'Only the Recording Brother or a Rep of your ecclesia can set up its schedules.'
