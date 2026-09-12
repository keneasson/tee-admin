/**
 * Tidy a contact value that a person typed or pasted.
 *
 * People paste addresses out of emails, and what arrives carries the
 * punctuation of the line it was cut from: `460 Rymal Road West, Suite 351,`
 * kept its trailing comma, and was then stored and displayed that way with no
 * means of correcting it. Trimming a stray separator is not "guessing at the
 * data" — the comma was a joiner in the source text, and there is nothing after
 * it to join.
 *
 * Deliberately minimal. It removes surrounding whitespace, collapses runs of
 * spaces, and drops separators that sit at either end with nothing beyond
 * them. It does NOT reorder, re-case, expand abbreviations, or touch
 * punctuation inside the value — `RR#1`, `St.`, `Unit 3-B` and
 * `O'Connor` must all survive untouched.
 *
 * Pure + I/O-free. Cross-platform.
 */

/** Separators that are meaningless at the start or end of a field. */
const EDGE_SEPARATORS = /^[\s,;]+|[\s,;]+$/g

/** Trim a single typed field. Returns undefined when nothing is left. */
export function cleanContactField(value?: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(EDGE_SEPARATORS, '').replace(/\s{2,}/g, ' ')
  return cleaned.length > 0 ? cleaned : undefined
}

/** A postal code is stored upper-case with single internal spacing. */
export function cleanPostalCode(value?: unknown): string | undefined {
  const cleaned = cleanContactField(value)
  return cleaned ? cleaned.toUpperCase() : undefined
}

/** A province is stored as typed, except a 2-letter code which is upper-cased. */
export function cleanProvince(value?: unknown): string | undefined {
  const cleaned = cleanContactField(value)
  if (!cleaned) return undefined
  return cleaned.length === 2 ? cleaned.toUpperCase() : cleaned
}
