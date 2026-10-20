/**
 * Rows for the owner/admin Recording Brother quick assignment. Pure.
 *
 * One row per ecclesia: its current RB (if any) and the people who could be
 * set — its inter-ecclesia contacts, plus whoever holds the RB email still on
 * the ecclesia record. A suggestion is made only when it is unambiguous: the
 * holder of the RB email on file, else the ecclesia's only contact.
 */

interface PersonLike {
  personId: string
  ecclesia?: string
  displayName?: string
  firstName?: string
  lastName?: string
}

interface EcclesiaLike {
  name: string
  city?: string
  province?: string
}

export interface RecordingBrotherCandidate {
  personId: string
  name: string
  /** Why they are offered. */
  source: 'inter-ecclesia contact' | 'RB email on file'
}

export interface RecordingBrotherRow {
  ecclesiaName: string
  place: string
  current: { personId: string; name: string } | null
  candidates: RecordingBrotherCandidate[]
  /** Set only when there is no RB yet and exactly one obvious choice. */
  suggestedPersonId: string | null
}

export interface RecordingBrotherRows {
  rows: RecordingBrotherRow[]
  /** Inter-ecclesia contacts whose ecclesia matches no ecclesia record. */
  unmatched: Array<{ personId: string; name: string; ecclesia: string }>
}

export function personName(p: PersonLike): string {
  return p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed'
}

export function buildRecordingBrotherRows(
  ecclesias: EcclesiaLike[],
  interEcclesiaContacts: PersonLike[],
  recordingBrothers: PersonLike[],
  /** Holder of each ecclesia's RB email on file, aligned with `ecclesias`. */
  rbEmailHolders: Array<PersonLike | null>
): RecordingBrotherRows {
  const names = new Set(ecclesias.map((e) => e.name))

  const rows = ecclesias.map((e, i): RecordingBrotherRow => {
    const rb = recordingBrothers.find((p) => p.ecclesia === e.name)
    const candidates: RecordingBrotherCandidate[] = []
    const holder = rbEmailHolders[i]
    if (holder && holder.ecclesia === e.name) {
      candidates.push({ personId: holder.personId, name: personName(holder), source: 'RB email on file' })
    }
    for (const p of interEcclesiaContacts) {
      if (p.ecclesia !== e.name || candidates.some((c) => c.personId === p.personId)) continue
      candidates.push({ personId: p.personId, name: personName(p), source: 'inter-ecclesia contact' })
    }
    const suggested = rb
      ? null
      : candidates.find((c) => c.source === 'RB email on file') ?? (candidates.length === 1 ? candidates[0] : null)
    return {
      ecclesiaName: e.name,
      place: [e.city, e.province].filter(Boolean).join(', '),
      current: rb ? { personId: rb.personId, name: personName(rb) } : null,
      candidates,
      suggestedPersonId: suggested?.personId ?? null,
    }
  })
  rows.sort((a, b) => a.ecclesiaName.localeCompare(b.ecclesiaName))

  const unmatched = interEcclesiaContacts
    .filter((p) => !p.ecclesia || !names.has(p.ecclesia))
    .map((p) => ({ personId: p.personId, name: personName(p), ecclesia: p.ecclesia || '' }))

  return { rows, unmatched }
}
