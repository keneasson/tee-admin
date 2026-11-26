/**
 * Ecclesia names: ONE matching rule, declared once.
 *
 * An ecclesia's name is stored and SHOWN exactly as it styles itself
 * ("Mississauga West Ecclesia", "Richmond Chapel Christadelphians"). Nothing
 * here is for display: never add or strip a word before showing a name.
 *
 * Matching is different. People type "Brantford", a sheet says "Brantford
 * Ecclesia", an old record says "Brantford Christadelphian Ecclesia" — the same
 * ecclesia. `normalizeEcclesiaName` folds those to one comparison key by
 * dropping the generic trailing words ("ecclesia", "christadelphian(s)") and
 * nothing else. "Chapel" is NOT generic: it is part of a real name
 * ("Richmond Chapel"), so it is kept.
 *
 * Pure (no I/O) so both the server and the shared UI can use it.
 */

/** Trailing words that say "this is an ecclesia" rather than which one. */
const GENERIC_TRAILING_WORDS = new Set(['ecclesia', 'ecclesias', 'christadelphian', 'christadelphians'])

/**
 * The comparison key of an ecclesia name: lowercase, trimmed, single-spaced,
 * curly apostrophes straightened, generic trailing words removed. A name made
 * only of generic words keeps them (so "Ecclesia" never becomes "").
 */
export function normalizeEcclesiaName(name: string | null | undefined): string {
  const folded = String(name ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[\s ]+/g, ' ')
    .trim()
  if (!folded) return ''
  const words = folded.split(' ')
  let end = words.length
  while (end > 1 && GENERIC_TRAILING_WORDS.has(words[end - 1].replace(/[.,]+$/, ''))) end--
  return words.slice(0, end).join(' ').replace(/[.,]+$/, '')
}

/** Something that names an ecclesia: its name, or a record/reference carrying a name and/or stable id. */
export type EcclesiaLike = string | { ecclesiaId?: string | null; name?: string | null } | null | undefined

function parts(e: EcclesiaLike): { id?: string; name: string } {
  if (e == null) return { name: '' }
  if (typeof e === 'string') return { name: e }
  return { id: e.ecclesiaId || undefined, name: e.name || '' }
}

/**
 * Do `a` and `b` name the same ecclesia? Compares stable ids when BOTH sides
 * carry one; otherwise the normalized names. Blank never matches anything.
 * Use this for every permission / ownership check instead of `===` on names.
 */
export function isSameEcclesia(a: EcclesiaLike, b: EcclesiaLike): boolean {
  const pa = parts(a)
  const pb = parts(b)
  if (pa.id && pb.id) return pa.id === pb.id
  const na = normalizeEcclesiaName(pa.name)
  return na !== '' && na === normalizeEcclesiaName(pb.name)
}

// ---------------------------------------------------------------------------
// Closed ecclesias
// ---------------------------------------------------------------------------

export type EcclesiaStatus = 'active' | 'closed'

export interface EcclesiaClosure {
  status?: EcclesiaStatus | null
  closedYear?: number | null
  closedNote?: string | null
}

/** A closed ecclesia stays findable (directory, search, history) but is never chosen or sent to. */
export function isClosedEcclesia(e: EcclesiaClosure | null | undefined): boolean {
  return e?.status === 'closed'
}

/** Missing status = active. */
export function isActiveEcclesia(e: EcclesiaClosure | null | undefined): boolean {
  return !isClosedEcclesia(e)
}

/** "Closed 2019", or "Closed" with no year; '' for an active ecclesia. */
export function closedLabel(e: EcclesiaClosure | null | undefined): string {
  if (!isClosedEcclesia(e)) return ''
  return e?.closedYear ? `Closed ${e.closedYear}` : 'Closed'
}

/** Thrown by writes that would attach a person, office or content to a closed ecclesia. */
export class ClosedEcclesiaError extends Error {
  constructor(public readonly ecclesiaName: string) {
    super(`"${ecclesiaName}" is closed. People, offices and content can't be assigned to a closed ecclesia.`)
    this.name = 'ClosedEcclesiaError'
  }
}
