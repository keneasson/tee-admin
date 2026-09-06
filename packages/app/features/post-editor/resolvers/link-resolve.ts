/**
 * Pure URL helpers for the {@link LinkEditor} (Consolidated CMS 2R-2). A LinkBlock
 * stores `url` + optional `label`; the published view links to `url` with
 * `label || url` as the text. These keep the "type a bare domain, get a valid
 * link" ergonomics deterministic and unit-testable.
 */

/** True when the string looks like a URL/domain worth linking (scheme optional). */
export function looksLikeUrl(s: string): boolean {
  const t = (s ?? '').trim()
  if (!t) return false
  if (/^(https?:\/\/|mailto:)/i.test(t)) return true
  // bare domain like "example.com" or "example.com/path" (needs a dot, no spaces)
  return /^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(t)
}

/**
 * Normalize a user-typed URL: leave http(s)/mailto as-is, prepend `https://` to a
 * bare domain, and return '' for blank input. Does NOT validate beyond scheme —
 * the point is a forgiving author experience, not strict parsing.
 */
export function normalizeUrl(s: string): string {
  const t = (s ?? '').trim()
  if (!t) return ''
  if (/^(https?:\/\/|mailto:)/i.test(t)) return t
  return `https://${t}`
}
