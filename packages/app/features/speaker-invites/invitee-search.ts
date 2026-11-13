import { isConfirmedBrother, isInvitableSpeaker, type Gender } from '../../utils/speaker-eligibility'

/**
 * Pure helpers for the composer's "Start typing a name" field and the home
 * ecclesia autocomplete (docs/SPEAKER_INVITATIONS.md §9a, §9b).
 */

/** One directory match, as `GET /api/speaker-invites/candidates` returns it. Never contact details. */
export interface InviteCandidate {
  personId: string
  displayName: string
  ecclesia?: string
  gender?: Gender | null
  baptized?: boolean | null
}

/**
 * §9b grouping. Brethren = both facts recorded. Everyone else the predicate
 * allows (either fact unset) is "Not yet confirmed as a baptized brother".
 * Sisters and people recorded as unbaptized are never shown.
 */
export function groupInviteCandidates<T extends InviteCandidate>(list: T[]): { brethren: T[]; unconfirmed: T[] } {
  const invitable = list.filter(isInvitableSpeaker)
  return {
    brethren: invitable.filter(isConfirmedBrother),
    unconfirmed: invitable.filter((c) => !isConfirmedBrother(c)),
  }
}

/** "Add them" prefill: two+ words → first word is the first name, the rest the last; one word → first name. */
export function splitTypedName(typed: string): { firstName: string; lastName: string } {
  const words = typed.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { firstName: '', lastName: '' }
  if (words.length === 1) return { firstName: words[0], lastName: '' }
  return { firstName: words[0], lastName: words.slice(1).join(' ') }
}

/**
 * Ecclesia autocomplete: case-insensitive substring match over the list.
 *  - `one`: exactly one match (shown filled in, accepted with one tap / Enter)
 *  - `many`: several, listed to pick from
 *  - `none`: offer "Use '{typed}' (not in our list)"
 *  - `exact`: the typed text already is a listed name (nothing to suggest)
 */
export type EcclesiaMatch =
  | { kind: 'empty' }
  | { kind: 'exact'; name: string }
  | { kind: 'one'; name: string }
  | { kind: 'many'; names: string[] }
  | { kind: 'none'; typed: string }

export function matchEcclesias(typed: string, names: string[], limit = 8): EcclesiaMatch {
  const q = typed.trim().toLowerCase()
  if (!q) return { kind: 'empty' }
  const exact = names.find((n) => n.toLowerCase() === q)
  if (exact) return { kind: 'exact', name: exact }
  const hits = names.filter((n) => n.toLowerCase().includes(q))
  if (hits.length === 0) return { kind: 'none', typed: typed.trim() }
  if (hits.length === 1) return { kind: 'one', name: hits[0] }
  // Names that START with the text first, then alphabetical.
  const sorted = [...hits].sort((a, b) => {
    const as = a.toLowerCase().startsWith(q) ? 0 : 1
    const bs = b.toLowerCase().startsWith(q) ? 0 : 1
    return as - bs || a.localeCompare(b)
  })
  return { kind: 'many', names: sorted.slice(0, limit) }
}
