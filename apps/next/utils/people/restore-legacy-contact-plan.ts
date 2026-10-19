/**
 * Pure planning logic for scripts/restore-legacy-contact.ts (R1, epic #270).
 *
 * Restores home addresses and phones that existed ONLY in the legacy directory
 * (`tee-schedules` PK=DIRECTORY#MEMBERS) and disappeared from view when Email
 * Lists started reading only PersonRecords (#279).
 *
 * Rules (docs/legacy-people-retirement-plan.md §0, R1):
 *  - MATCH each legacy row to exactly one person: by the row's email(s) when
 *    exactly one person holds them, else by exact normalized first + last name
 *    held by exactly one person. Anything else is listed, never written.
 *    When the email points at one person but the row's name points uniquely
 *    at a DIFFERENT person: same last name → a household inbox, the row goes to
 *    the NAMED person (the row is their entry); different last name → listed.
 *  - FILL EMPTY ONLY: an address only when the person has no ADDRESS# item, a
 *    phone only when they have no PHONE# item. Never overwrite, never delete.
 *  - PARSE strictly. An address or phone that does not parse cleanly is
 *    listed, never written.
 *  - Several legacy rows can point at one person (household rows). Their values
 *    are written once when they agree; when they disagree it is listed.
 *  - IDEMPOTENT: once written, the person has an ADDRESS#/PHONE#, so a re-plan
 *    adds nothing.
 *
 * No I/O here: the script reads the stores and hands the rows in. Deleted with
 * the legacy store in R8.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface LegacyDirectoryRow {
  /** The row's sort key (opaque; may contain an email, so never printed in counts-only mode). */
  sk: string
  firstName?: string | null
  lastName?: string | null
  /** One or more addresses, newline / `;` / `,` separated. */
  email?: string | null
  /** Free text, multi-line: "<street>\n<City>, <PROV> <POSTAL>". */
  address?: string | null
  /** Free text, may hold several labelled numbers. */
  phone?: string | null
}

export interface PersonSnapshot {
  personId: string
  firstName?: string | null
  lastName?: string | null
  /** Every address the person holds (PROFILE.primaryEmail + every EMAIL# row). */
  emails: string[]
  addressCount: number
  phoneCount: number
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedAddress {
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: 'Canada' | 'USA'
}

const CA_PROVINCES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
])

// "<City>, <PROV> <A1A 1A1>" (space in the postal code optional)
const CA_LOCALITY = /^(.+?)\s*,\s*([A-Za-z]{2})\.?\s+([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)$/
// "<City>, <ST> <12345[-6789]>" optionally followed by ", USA" / ", U.S.A."
const US_LOCALITY = /^(.+?)\s*,\s*([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)(?:\s*,?\s*(?:USA|U\.S\.A\.?))?$/i
const US_COUNTRY_LINE = /^(?:USA|U\.S\.A\.?|United States(?: of America)?)$/i

/**
 * Parse a legacy multi-line address. Requires the street on its own line(s)
 * and a final "City, PROV POSTAL" line (Canada) or "City, ST ZIP" (US, an
 * optional trailing "USA" line). Anything else → null (listed, not written).
 */
export function parseLegacyAddress(raw: string | null | undefined): ParsedAddress | null {
  if (!raw) return null
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  if (lines.length > 0 && US_COUNTRY_LINE.test(lines[lines.length - 1]!)) {
    lines.pop()
    // The country line only belongs to a US locality.
    const last = lines[lines.length - 1]
    if (!last || !US_LOCALITY.test(last)) return null
  }
  // A city and province alone ("Windsor, ON") is kept as a partial address; the
  // street and postal code are added later when they're known (owner, Oct 2026).
  if (lines.length === 1) {
    const only = lines[0]!.match(/^([^,\d]+),\s*([A-Za-z]{2})\.?$/)
    const province = only?.[2]!.toUpperCase()
    if (!only || !province || !CA_PROVINCES.has(province)) return null
    return { street1: '', city: only[1]!.trim(), province, postalCode: '', country: 'Canada' }
  }
  if (lines.length < 2) return null

  const locality = lines[lines.length - 1]!
  const streetLines = lines.slice(0, -1)
  const street1 = streetLines[0]!
  const street2 = streetLines.length > 1 ? streetLines.slice(1).join(', ') : undefined

  const ca = locality.match(CA_LOCALITY)
  if (ca) {
    const province = ca[2]!.toUpperCase()
    if (!CA_PROVINCES.has(province)) return null
    const city = ca[1]!.trim()
    if (!city) return null
    return {
      street1,
      ...(street2 ? { street2 } : {}),
      city,
      province,
      postalCode: `${ca[3]!.toUpperCase()} ${ca[4]!.toUpperCase()}`,
      country: 'Canada',
    }
  }
  const us = locality.match(US_LOCALITY)
  if (us) {
    const state = us[2]!.toUpperCase()
    if (!US_STATES.has(state)) return null
    const city = us[1]!.trim()
    if (!city) return null
    return {
      street1,
      ...(street2 ? { street2 } : {}),
      city,
      province: state,
      postalCode: us[3]!,
      country: 'USA',
    }
  }
  return null
}

export interface ParsedPhone {
  /** Digits only, 10 digits (a leading North-American "1" is dropped). */
  number: string
  type: 'home' | 'mobile'
}

const PHONE_RE = /(?:\+?1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(?!\d)/g

interface PhoneCandidate {
  number: string
  /** The line's text with the number removed (its label). */
  label: string
}

function phoneCandidates(raw: string): PhoneCandidate[] {
  const out: PhoneCandidate[] = []
  for (const line of raw.split(/\r?\n/)) {
    const matches = [...line.matchAll(PHONE_RE)]
    if (matches.length === 0) continue
    // A line holding several numbers ("A (C) 111… B (C) 222…"): each number's
    // label is the text between the previous number and this one.
    let cursor = 0
    for (const m of matches) {
      const start = m.index ?? 0
      const label = line.slice(cursor, start).trim()
      cursor = start + m[0].length
      out.push({ number: `${m[1]}${m[2]}${m[3]}`, label })
    }
    // Trailing text after the last number on the line ("416… (C)") labels it too.
    const tail = line.slice(cursor).trim()
    if (tail && out.length > 0) {
      const lastIdx = out.length - 1
      out[lastIdx] = { ...out[lastIdx]!, label: `${out[lastIdx]!.label} ${tail}`.trim() }
    }
  }
  return out
}

const CELL_MARK = /\((?:c|cell)\s*\)|\bcell\b|\bmobile\b/i
const HOME_MARK = /\((?:h|home)\s*\)|\bhome\b/i
const OTHER_MARK = /\((?:w|work)\s*\)|\bwork\b|\bshop\b|\boffice\b/i

/** The words in a label, minus the cell/home/work markers. */
function labelWords(label: string): string[] {
  return label
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[:;,]/g, ' ')
    .split(/\s+/)
    .map((w) => normalizeNamePart(w.replace(/['’]s$/i, '')))
    .filter((w) => w && !['cell', 'mobile', 'home', 'work', 'shop', 'office', 'tel'].includes(w))
}

/**
 * Choose the ONE phone to restore for a person from a legacy phone field.
 *  1. the first number with no person label and no work mark → home phone
 *     (cell-marked → mobile);
 *  2. else the number labelled with the person's first name;
 *  3. else, if the field holds exactly one number, that number.
 * Anything else (several numbers for other people only, nothing that parses)
 * → null, listed.
 */
export function chooseLegacyPhone(raw: string | null | undefined, firstName?: string | null): ParsedPhone | null {
  if (!raw || !raw.trim()) return null
  const candidates = phoneCandidates(raw)
  if (candidates.length === 0) return null
  const typeOf = (c: PhoneCandidate): ParsedPhone['type'] =>
    CELL_MARK.test(c.label) && !HOME_MARK.test(c.label) ? 'mobile' : 'home'

  const unlabelled = candidates.find((c) => labelWords(c.label).length === 0 && !OTHER_MARK.test(c.label))
  if (unlabelled) return { number: unlabelled.number, type: typeOf(unlabelled) }

  const first = normalizeNamePart(firstName || '')
  if (first) {
    const mine = candidates.filter((c) => labelWords(c.label).includes(first))
    if (mine.length === 1) return { number: mine[0]!.number, type: typeOf(mine[0]!) }
  }

  if (candidates.length === 1 && !OTHER_MARK.test(candidates[0]!.label)) {
    return { number: candidates[0]!.number, type: typeOf(candidates[0]!) }
  }
  return null
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function normalizeNamePart(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function nameKey(first?: string | null, last?: string | null): string | null {
  const f = normalizeNamePart(first || '')
  const l = normalizeNamePart(last || '')
  return f && l ? `${f}|${l}` : null
}

export function splitLegacyEmails(raw: string | null | undefined): string[] {
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(/[\s;,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ]
}

export type MatchResult =
  | { kind: 'matched'; personId: string; by: 'email' | 'name' }
  | { kind: 'ambiguous'; reason: 'email-held-by-several' | 'name-held-by-several' | 'email-and-name-disagree' }
  | { kind: 'no-match' }

export interface PersonIndex {
  byEmail: Map<string, Set<string>>
  byName: Map<string, Set<string>>
  byId: Map<string, PersonSnapshot>
}

export function buildPersonIndex(people: PersonSnapshot[]): PersonIndex {
  const byEmail = new Map<string, Set<string>>()
  const byName = new Map<string, Set<string>>()
  const byId = new Map<string, PersonSnapshot>()
  const add = (m: Map<string, Set<string>>, k: string, id: string) => {
    const s = m.get(k) ?? new Set<string>()
    s.add(id)
    m.set(k, s)
  }
  for (const p of people) {
    byId.set(p.personId, p)
    for (const e of p.emails) {
      const n = e?.trim().toLowerCase()
      if (n) add(byEmail, n, p.personId)
    }
    const k = nameKey(p.firstName, p.lastName)
    if (k) add(byName, k, p.personId)
  }
  return { byEmail, byName, byId }
}

export function matchLegacyRow(row: LegacyDirectoryRow, index: PersonIndex): MatchResult {
  const holders = new Set<string>()
  for (const e of splitLegacyEmails(row.email)) {
    for (const id of index.byEmail.get(e) ?? []) holders.add(id)
  }
  const key = nameKey(row.firstName, row.lastName)
  const named = key ? [...(index.byName.get(key) ?? [])] : []
  const uniqueName = named.length === 1 ? named[0]! : null

  if (holders.size === 1) {
    const [byEmail] = [...holders]
    if (uniqueName && uniqueName !== byEmail) {
      // A household inbox: the row is the named person's entry, written with a
      // spouse's / relative's address (same last name). The row describes the
      // named person, so it goes to them. Different last names → listed.
      const holder = index.byId.get(byEmail!)
      const sameFamily =
        !!holder && normalizeNamePart(holder.lastName || '') === normalizeNamePart(row.lastName || '')
      if (sameFamily) return { kind: 'matched', personId: uniqueName, by: 'name' }
      return { kind: 'ambiguous', reason: 'email-and-name-disagree' }
    }
    return { kind: 'matched', personId: byEmail!, by: 'email' }
  }
  if (uniqueName) {
    // The email pointed at several people: the name must be one of them.
    if (holders.size > 1 && !holders.has(uniqueName)) {
      return { kind: 'ambiguous', reason: 'email-and-name-disagree' }
    }
    return { kind: 'matched', personId: uniqueName, by: 'name' }
  }
  if (holders.size > 1) return { kind: 'ambiguous', reason: 'email-held-by-several' }
  if (named.length > 1) return { kind: 'ambiguous', reason: 'name-held-by-several' }
  return { kind: 'no-match' }
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type ListedReason =
  | 'no-match'
  | 'email-held-by-several'
  | 'name-held-by-several'
  | 'email-and-name-disagree'
  | 'address-unparseable'
  | 'phone-unparseable'
  | 'address-conflict'
  | 'phone-conflict'

export interface ListedItem {
  rowIndex: number
  personId?: string
  reason: ListedReason
  raw?: string
}

export interface AddressAction {
  kind: 'address'
  personId: string
  rowIndexes: number[]
  value: ParsedAddress
}

export interface PhoneAction {
  kind: 'phone'
  personId: string
  rowIndexes: number[]
  value: ParsedPhone
}

export interface RestorePlan {
  addresses: AddressAction[]
  phones: PhoneAction[]
  listed: ListedItem[]
  counts: {
    legacyRows: number
    rowsWithContact: number
    matchedByEmail: number
    matchedByName: number
    alreadyHasAddress: number
    alreadyHasPhone: number
    addressesToAdd: number
    phonesToAdd: number
    peopleAffected: number
    listedByReason: Partial<Record<ListedReason, number>>
  }
}

const addressKey = (a: ParsedAddress) =>
  [a.street1, a.street2 ?? '', a.city, a.province, a.postalCode.replace(/\s/g, '')]
    .map((s) => s.toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim())
    .join('|')

export function planRestore(rows: LegacyDirectoryRow[], people: PersonSnapshot[]): RestorePlan {
  const index = buildPersonIndex(people)
  const listed: ListedItem[] = []
  let matchedByEmail = 0
  let matchedByName = 0
  let rowsWithContact = 0
  const alreadyAddress = new Set<string>()
  const alreadyPhone = new Set<string>()

  // personId → candidate values (with the rows they came from)
  const addrCandidates = new Map<string, Array<{ rowIndex: number; value: ParsedAddress }>>()
  const phoneCandidatesByPerson = new Map<string, Array<{ rowIndex: number; value: ParsedPhone }>>()

  rows.forEach((row, rowIndex) => {
    const hasAddress = !!row.address?.trim()
    const hasPhone = !!row.phone?.trim()
    if (!hasAddress && !hasPhone) return
    rowsWithContact++

    const match = matchLegacyRow(row, index)
    if (match.kind === 'no-match') {
      listed.push({ rowIndex, reason: 'no-match' })
      return
    }
    if (match.kind === 'ambiguous') {
      listed.push({ rowIndex, reason: match.reason })
      return
    }
    if (match.by === 'email') matchedByEmail++
    else matchedByName++
    const person = index.byId.get(match.personId)!

    if (hasAddress) {
      if (person.addressCount > 0) alreadyAddress.add(person.personId)
      else {
        const parsed = parseLegacyAddress(row.address)
        if (!parsed) listed.push({ rowIndex, personId: person.personId, reason: 'address-unparseable', raw: row.address! })
        else {
          const list = addrCandidates.get(person.personId) ?? []
          list.push({ rowIndex, value: parsed })
          addrCandidates.set(person.personId, list)
        }
      }
    }
    if (hasPhone) {
      if (person.phoneCount > 0) alreadyPhone.add(person.personId)
      else {
        const parsed = chooseLegacyPhone(row.phone, person.firstName)
        if (!parsed) listed.push({ rowIndex, personId: person.personId, reason: 'phone-unparseable', raw: row.phone! })
        else {
          const list = phoneCandidatesByPerson.get(person.personId) ?? []
          list.push({ rowIndex, value: parsed })
          phoneCandidatesByPerson.set(person.personId, list)
        }
      }
    }
  })

  const addresses: AddressAction[] = []
  for (const [personId, cands] of addrCandidates) {
    const distinct = new Set(cands.map((c) => addressKey(c.value)))
    if (distinct.size > 1) {
      for (const c of cands) listed.push({ rowIndex: c.rowIndex, personId, reason: 'address-conflict' })
      continue
    }
    addresses.push({ kind: 'address', personId, rowIndexes: cands.map((c) => c.rowIndex), value: cands[0]!.value })
  }
  const phones: PhoneAction[] = []
  for (const [personId, cands] of phoneCandidatesByPerson) {
    const distinct = new Set(cands.map((c) => c.value.number))
    if (distinct.size > 1) {
      for (const c of cands) listed.push({ rowIndex: c.rowIndex, personId, reason: 'phone-conflict' })
      continue
    }
    // Several agreeing rows: a "mobile" mark on any of them wins over the default.
    const value = cands.find((c) => c.value.type === 'mobile')?.value ?? cands[0]!.value
    phones.push({ kind: 'phone', personId, rowIndexes: cands.map((c) => c.rowIndex), value })
  }

  const listedByReason: Partial<Record<ListedReason, number>> = {}
  for (const l of listed) listedByReason[l.reason] = (listedByReason[l.reason] ?? 0) + 1

  return {
    addresses,
    phones,
    listed,
    counts: {
      legacyRows: rows.length,
      rowsWithContact,
      matchedByEmail,
      matchedByName,
      alreadyHasAddress: alreadyAddress.size,
      alreadyHasPhone: alreadyPhone.size,
      addressesToAdd: addresses.length,
      phonesToAdd: phones.length,
      peopleAffected: new Set([...addresses, ...phones].map((a) => a.personId)).size,
      listedByReason,
    },
  }
}

/** Every person the plan would write to — the partitions the script backs up. */
export function affectedPersonIds(plan: RestorePlan): string[] {
  return [...new Set([...plan.addresses, ...plan.phones].map((a) => a.personId))].sort()
}
