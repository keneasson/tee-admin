/**
 * Rows for the owner/admin Recording Brother assignment. Pure.
 *
 * One row per ecclesia: its current RB (if any), the NAMED people recorded at
 * it, and its addresses on file. Nothing is suggested: being an ecclesia's
 * only member or contact on file doesn't make someone its Recording Brother.
 *
 * The inter-ecclesia contacts came from a 2024 mailing list; most have no
 * name and many are ecclesia mailboxes (e.g. "<town>christadelphians@…").
 * A nameless contact is therefore an ADDRESS on file, never offered as a
 * person. Ecclesia mail can keep going to it after an RB is set.
 *
 * Where an ecclesia has a Recording Brother OFFICE (R3), the office decides:
 * its holder is the current RB and its own address is where ecclesia mail goes
 * (an office with no address → the holder's primary email). Ecclesias with no
 * office yet show the older copies (person flag, the ecclesia's RB email).
 */

interface PersonLike {
  personId: string
  ecclesia?: string
  displayName?: string
  firstName?: string
  lastName?: string
  primaryEmail?: string
}

interface EcclesiaLike {
  name: string
  city?: string
  province?: string
  recordingBrotherEmail?: string
}

/** An ecclesia's Recording Brother office, as the page needs it. */
export interface RecordingBrotherOfficeLike {
  holderPersonId?: string
  holderName?: string
  /** The office's own address (absent → mail goes to the holder's primary). */
  officeEmail?: string
  /** The holder's primary email, used when the office has no address. */
  holderEmail?: string
}

export interface RecordingBrotherPerson {
  personId: string
  name: string
  /** Their own email, if any. */
  email: string
  /** On the inter-ecclesia contact list. */
  isContact: boolean
}

export interface RecordingBrotherAddress {
  email: string
  note: string
}

export interface RecordingBrotherRow {
  ecclesiaName: string
  place: string
  current: { personId: string; name: string } | null
  /** Where ecclesia mail goes now ('' = nowhere). */
  mailTo: string
  /** True when `mailTo` is the ecclesia's own address (it stays when the RB changes). */
  mailToIsOffice: boolean
  people: RecordingBrotherPerson[]
  addresses: RecordingBrotherAddress[]
}

export interface RecordingBrotherRows {
  rows: RecordingBrotherRow[]
  /** Inter-ecclesia contacts whose ecclesia matches no ecclesia record. */
  unmatched: Array<{ personId: string; name: string; email: string; ecclesia: string }>
}

export function personName(p: PersonLike): string {
  return p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim()
}

const lower = (e?: string) => (e || '').toLowerCase().trim()

export function buildRecordingBrotherRows(
  ecclesias: EcclesiaLike[],
  interEcclesiaContacts: PersonLike[],
  recordingBrothers: PersonLike[],
  /** Everyone recorded at each ecclesia, aligned with `ecclesias`. */
  peopleByEcclesia: PersonLike[][],
  /** Each ecclesia's RB office, aligned with `ecclesias`; null/absent = no office yet. */
  rbOffices: Array<RecordingBrotherOfficeLike | null> = []
): RecordingBrotherRows {
  const names = new Set(ecclesias.map((e) => e.name))
  const contactIds = new Set(interEcclesiaContacts.map((p) => p.personId))

  const rows = ecclesias.map((e, i): RecordingBrotherRow => {
    const office = rbOffices[i] || null
    const flagged = recordingBrothers.find((p) => p.ecclesia === e.name)
    const everyone = peopleByEcclesia[i] || []

    const people = everyone
      .filter((p) => personName(p))
      .map((p) => ({
        personId: p.personId,
        name: personName(p),
        email: lower(p.primaryEmail),
        isContact: contactIds.has(p.personId),
      }))
      .sort((a, b) => Number(b.isContact) - Number(a.isContact) || a.name.localeCompare(b.name))

    const addresses: RecordingBrotherAddress[] = []
    const add = (email: string, note: string) => {
      if (email && !addresses.some((a) => a.email === email)) addresses.push({ email, note })
    }
    const officeEmail = lower(office?.officeEmail)
    if (officeEmail) add(officeEmail, "the ecclesia's address")
    for (const p of everyone) {
      if (!personName(p) && p.primaryEmail) add(lower(p.primaryEmail), 'inter-ecclesia contact (no name)')
    }
    const onFile = lower(e.recordingBrotherEmail)
    if (!office && onFile && !people.some((p) => p.email === onFile)) add(onFile, 'RB email on file')

    let current: RecordingBrotherRow['current'] = null
    let mailTo: string
    if (office) {
      current = office.holderPersonId
        ? { personId: office.holderPersonId, name: office.holderName || 'Unnamed' }
        : null
      mailTo = officeEmail || lower(office.holderEmail)
    } else {
      // A nameless RB record is an address, not a person: show the address.
      current = flagged
        ? { personId: flagged.personId, name: personName(flagged) || `${lower(flagged.primaryEmail) || 'Unnamed'} (no name on file)` }
        : null
      mailTo = onFile
    }

    return {
      ecclesiaName: e.name,
      place: [e.city, e.province].filter(Boolean).join(', '),
      current,
      mailTo,
      mailToIsOffice: !!mailTo && addresses.some((a) => a.email === mailTo),
      people,
      addresses,
    }
  })
  rows.sort((a, b) => a.ecclesiaName.localeCompare(b.ecclesiaName))

  const unmatched = interEcclesiaContacts
    .filter((p) => !p.ecclesia || !names.has(p.ecclesia))
    .map((p) => ({
      personId: p.personId,
      name: personName(p),
      email: lower(p.primaryEmail),
      ecclesia: p.ecclesia || '',
    }))

  return { rows, unmatched }
}
