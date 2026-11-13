/**
 * Who may be invited to speak (docs/SPEAKER_INVITATIONS.md §9b).
 *
 * In this community only brethren (baptized males) exhort, speak at Bible Class or
 * lecture. Both facts are RECORDED, never inferred: `gender` and `baptized`
 * are unset until a person (themselves, an admin, or an inviter vouching) sets
 * them. Nothing here reads the role: role is how an ecclesia treats someone
 * (access); `baptized` is a recorded fact used only where it matters (the
 * speaker picker). They are independent by design.
 *
 * Pure: shared by the API and the screens.
 */

export type Gender = 'male' | 'female'

/** The recorded facts. `null` (as well as absent) means "not set". */
export interface SpeakerFacts {
  gender?: Gender | null
  baptized?: boolean | null
}

/** The ONE predicate the picker uses: not known to be unbaptized, and not a sister. */
export function isInvitableSpeaker(p: SpeakerFacts | null | undefined): boolean {
  if (!p) return false
  return p.baptized !== false && p.gender !== 'female'
}

/** Both facts recorded: a baptized brother (the picker's first group). */
export function isConfirmedBrother(p: SpeakerFacts | null | undefined): boolean {
  return !!p && p.baptized === true && p.gender === 'male'
}

/**
 * "Confirm: baptized brother" sets ONLY the unset facts and never overwrites.
 * `conflict`: a fact is already recorded to the contrary. `nothing`: already confirmed.
 */
export function confirmBrotherChanges(
  p: SpeakerFacts
): { gender?: 'male'; baptized?: true } | 'conflict' | 'nothing' {
  if (p.gender === 'female' || p.baptized === false) return 'conflict'
  const changes: { gender?: 'male'; baptized?: true } = {}
  if (p.gender == null) changes.gender = 'male'
  if (p.baptized == null) changes.baptized = true
  return Object.keys(changes).length > 0 ? changes : 'nothing'
}

export type SpeakerTitle = 'Brother' | 'Sister'

/**
 * "Brother" / "Sister" only when BOTH facts are recorded: baptized === true and
 * a gender. An unbaptized person is never titled, and nothing is guessed (§9b).
 * Servers compute this and send the title, never the raw gender, to pages.
 */
export function titleFor(p: SpeakerFacts | null | undefined): SpeakerTitle | undefined {
  if (!p || p.baptized !== true) return undefined
  return p.gender === 'male' ? 'Brother' : p.gender === 'female' ? 'Sister' : undefined
}

/**
 * How a page addresses someone: "{title} {Surname}" when the server sent a
 * title (see `titleFor`), else the first name, else `fallback`. Never guessed.
 */
export function titledName(
  p: { firstName?: string; lastName?: string; title?: SpeakerTitle | null } | null | undefined,
  fallback = 'the invited speaker'
): string {
  const title = p?.title ?? undefined
  const last = p?.lastName?.trim()
  if (title && last) return `${title} ${last}`
  return p?.firstName?.trim() || fallback
}

export function isGender(v: unknown): v is Gender {
  return v === 'male' || v === 'female'
}

export interface SpeakerFactsEdit {
  gender?: Gender | null
  baptized?: boolean | null
  baptismDate?: string | null
}

/**
 * Read the recorded-facts part of an edit body (profile / admin person form).
 * Each key is optional; `null` means "Not set". Unknown values are refused.
 */
export function parseSpeakerFactsEdit(
  body: Record<string, unknown> | null | undefined
): { ok: true; facts: SpeakerFactsEdit } | { ok: false; error: string } {
  const facts: SpeakerFactsEdit = {}
  if (!body) return { ok: true, facts }
  if ('gender' in body) {
    if (body.gender !== null && !isGender(body.gender)) return { ok: false, error: 'Gender must be Brother, Sister or Not set.' }
    facts.gender = body.gender as Gender | null
  }
  if ('baptized' in body) {
    if (body.baptized !== null && typeof body.baptized !== 'boolean') return { ok: false, error: 'Baptized must be Yes, No or Not set.' }
    facts.baptized = body.baptized as boolean | null
  }
  if ('baptismDate' in body) {
    const d = typeof body.baptismDate === 'string' ? body.baptismDate.trim() : body.baptismDate
    if (d === null || d === '') facts.baptismDate = null
    else if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) {
      return { ok: false, error: 'The baptism date must be YYYY-MM-DD.' }
    } else facts.baptismDate = d
  }
  return { ok: true, facts }
}

export const hasSpeakerFacts = (f: SpeakerFactsEdit) =>
  f.gender !== undefined || f.baptized !== undefined || f.baptismDate !== undefined
