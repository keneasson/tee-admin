/**
 * Validate an owner/admin "close / reopen this ecclesia" request into the
 * fields `updateEcclesiaFields` stores. Pure.
 *
 * - `status: 'closed'` needs nothing else; `closedYear` (4 digits, not in the
 *   future) and a short `closedNote` are optional.
 * - `status: 'active'` reopens: the year and note are cleared.
 */
export type ClosureInput = {
  status?: unknown
  closedYear?: unknown
  closedNote?: unknown
}

export type ClosureUpdates = {
  status: 'active' | 'closed'
  closedYear: number | null
  closedNote: string | null
}

export const CLOSED_NOTE_MAX = 280

export function parseClosure(
  input: ClosureInput,
  now: Date = new Date()
): { ok: true; updates: ClosureUpdates } | { ok: false; error: string } {
  const status = input.status
  if (status !== 'active' && status !== 'closed') {
    return { ok: false, error: "status must be 'active' or 'closed'" }
  }
  if (status === 'active') {
    return { ok: true, updates: { status: 'active', closedYear: null, closedNote: null } }
  }

  let closedYear: number | null = null
  const rawYear = input.closedYear
  if (rawYear !== undefined && rawYear !== null && String(rawYear).trim() !== '') {
    const n = Number(String(rawYear).trim())
    if (!Number.isInteger(n) || n < 1800 || n > now.getFullYear()) {
      return { ok: false, error: `closedYear must be a year between 1800 and ${now.getFullYear()}` }
    }
    closedYear = n
  }

  const note = typeof input.closedNote === 'string' ? input.closedNote.trim() : ''
  if (note.length > CLOSED_NOTE_MAX) {
    return { ok: false, error: `closedNote must be ${CLOSED_NOTE_MAX} characters or fewer` }
  }

  return { ok: true, updates: { status: 'closed', closedYear, closedNote: note || null } }
}
