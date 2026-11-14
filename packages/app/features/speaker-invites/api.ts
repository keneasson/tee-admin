import type { ApiResult, InviteApiError } from './types'

/**
 * Same-origin JSON calls for the speaker-invite screens. Every result is
 * `{ ok, status, data | error }` so a screen can branch on the API's `code`
 * (SLOT_TAKEN, SESSION_MISMATCH, STEP_UP_REQUIRED, …) instead of throwing.
 */
export async function callApi<T>(url: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }): Promise<ApiResult<T>> {
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
    return { ok: false, status: res.status, error: (json ?? {}) as InviteApiError }
  } catch {
    return { ok: false, status: 0, error: { error: 'We could not reach the server. Check your connection and try again.', code: 'NETWORK' } }
  }
}

export function withToken(path: string, token: string | null | undefined): string {
  return token ? `${path}?token=${encodeURIComponent(token)}` : path
}
