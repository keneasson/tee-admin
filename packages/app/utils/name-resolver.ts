/**
 * Deterministic schedule-name → member resolver (keystone — see
 * project_name_member_resolver). Schedule data arrives from Google Sheets as
 * FREE-TEXT names ("Brad Stephens", the odd typo "kent easson", honorifics like
 * "Bro. Alan Markwith"). This maps such a name to a directory PersonRecord, or
 * flags it so an admin can fix it:
 *
 *   matched   — exactly one confident match
 *   typo      — no exact match but ≥1 close candidate (edit distance ≤ 2)
 *   ambiguous — multiple people share the (normalized) name
 *   not-found — nothing close (likely a visitor to add, or a placeholder)
 *
 * PURE + I/O-free: callers pass the candidate people (e.g. from
 * personRepository.listAll() / listByEcclesia()), so this unit-tests cleanly and
 * runs anywhere (sync hook, admin review, cron). Matching across ALL people is
 * intentional — visiting exhorters live in the directory under their OWN ecclesia.
 */

/** Minimal shape the resolver needs from a PersonRecord. */
export interface DirectoryPerson {
  personId: string
  firstName: string
  lastName: string
  ecclesia?: string
  displayName?: string
}

export type NameMatch =
  | { status: 'matched'; person: DirectoryPerson; confidence: 'exact' }
  | { status: 'typo'; input: NormalizedName; suggestions: Array<{ person: DirectoryPerson; distance: number }> }
  | { status: 'ambiguous'; input: NormalizedName; candidates: DirectoryPerson[] }
  | { status: 'not-found'; input: NormalizedName }

export interface NormalizedName {
  /** The full normalized name, e.g. "ken easson". */
  full: string
  first: string
  last: string
  tokens: string[]
}

const HONORIFIC_RE = /^(bro\.?|brother|bre\.?|sis\.?|sister|mr\.?|mrs\.?|ms\.?|dr\.?)$/i

/** Free-text tokens that aren't people — a name-only "not a real person" guard. */
const PLACEHOLDER_TOKENS = new Set([
  'tbd', 'tba', 'open', 'none', 'various', 'attendees', 'all', 'n/a', 'na', 'vacant', 'visitor', 'speaker',
])

/**
 * Normalize a free-text name: lowercase, strip honorifics + punctuation, collapse
 * whitespace, split into tokens. First token → first name, last token → last name
 * (single-token names have first === last === the token; middles are dropped for
 * matching but kept in `tokens`).
 */
export function normalizeName(raw: string): NormalizedName {
  const cleaned = (raw ?? '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ') // keep letters/digits/space/'/-
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned.split(' ').filter((t) => t && !HONORIFIC_RE.test(t))
  const first = tokens[0] ?? ''
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : first
  return { full: tokens.join(' '), first, last, tokens }
}

/** True when the raw value is a known non-person placeholder ("TBD", "attendees", …). */
export function isPlaceholderName(raw: string): boolean {
  const n = normalizeName(raw)
  if (!n.full) return true
  return n.tokens.every((t) => PLACEHOLDER_TOKENS.has(t))
}

/** Levenshtein edit distance (bounded is unnecessary at directory scale). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

const TYPO_MAX_DISTANCE = 2

function personName(p: DirectoryPerson): NormalizedName {
  return normalizeName(`${p.firstName} ${p.lastName}`)
}

/**
 * Resolve a free-text schedule name against directory candidates.
 * Placeholder inputs ("TBD"/"attendees"/blank) resolve to `not-found` — the caller
 * should skip them rather than treat them as a person to add.
 */
export function resolveScheduleName(raw: string, candidates: DirectoryPerson[]): NameMatch {
  const input = normalizeName(raw)
  if (!input.full || isPlaceholderName(raw)) {
    return { status: 'not-found', input }
  }

  const scored = candidates.map((person) => ({ person, name: personName(person) }))

  // 1. Exact match on normalized first + last.
  const exact = scored.filter((c) => c.name.first === input.first && c.name.last === input.last)
  if (exact.length === 1) {
    return { status: 'matched', person: exact[0].person, confidence: 'exact' }
  }
  if (exact.length > 1) {
    return { status: 'ambiguous', input, candidates: exact.map((c) => c.person) }
  }

  // 2. No exact — look for close matches (typo). Distance on the full "first last".
  const near = scored
    .map((c) => ({ person: c.person, distance: editDistance(input.full, c.name.full) }))
    .filter((c) => c.distance > 0 && c.distance <= TYPO_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance)

  if (near.length > 0) {
    return { status: 'typo', input, suggestions: near }
  }

  return { status: 'not-found', input }
}
