/**
 * People & ecclesia access patterns on the single `tee-admin` table
 * (ADR-0006 §8, `docs/legacy-people-retirement-plan.md` §7).
 *
 * Everything in this file is PURE: key builders and the functions that derive
 * projection items from source items. The I/O lives in `projections.ts` (the
 * writer) and `reader.ts` (the readers). Keeping derivation pure means the
 * runtime writer and the backfill script share one definition of every
 * projection, and the derivation is unit-testable without DynamoDB.
 *
 * SOURCES (never written here):
 *   PERSON#<id> / PROFILE, EMAIL#…, PHONE#…           (personRepository)
 *   ECCLESIA#<country|prov> / <city>#<name>             (locations.ts)
 *
 * PROJECTIONS (derived only; each has exactly one writer):
 *   PERSON#<id> / CARD                  person card: pattern 4 (everyone, by ecclesia) + 10 (BatchGet)
 *   PERSON#<id> / NAMETOK#<token>       name typeahead tokens, pattern 3 (gsi3)
 *   ECCLESIA_ID#<eid> / ECCLESIA        stable id alias + directory entry, patterns 7/9 (writer: ecclesia)
 *   PEOPLE_INDEX#META / BUILD           "the backfill has run" marker
 *
 * OFFICES are NOT projections: an office (Recording Brother, Treasurer, …) is
 * its own SOURCE entity at ECCLESIA_ID#<eid> / OFFICE#<role>, written only by
 * `officeRepository` (see `office-keys.ts`). Nothing here derives or deletes one.
 *
 * Every index entry is SPARSE: only these items carry the new key values, and
 * each prefix is new, so no existing Query can see them.
 */

/** Persons are not tenant-scoped yet (ADR-0001); one namespace for now. */
export const PEOPLE_NAMESPACE = 'ALL'

export const CARD_SK = 'CARD'
export const NAMETOK_PREFIX = 'NAMETOK#'
export const ECCLESIA_ID_PREFIX = 'ECCLESIA_ID#'
export const ECCLESIA_ALIAS_SK = 'ECCLESIA'
export const ECCLESIA_DIRECTORY_PK = 'ECCLESIAS'
export const INDEX_META_PK = 'PEOPLE_INDEX#META'
export const INDEX_META_SK = 'BUILD'
/** Bump when a projection's shape changes, so the backfill rewrites it. */
export const PROJECTION_SCHEMA_VERSION = 1

export const peopleRosterPk = () => `PEOPLE#${PEOPLE_NAMESPACE}`
export const ecclesiaPeoplePk = (ecclesiaId: string) => `ECCPEOPLE#${ecclesiaId}`
export const namePrefixPk = (token: string) => `NAMEPFX#${PEOPLE_NAMESPACE}#${token.slice(0, 2)}`
export const ecclesiaIdPk = (ecclesiaId: string) => `${ECCLESIA_ID_PREFIX}${ecclesiaId}`
export const rbEmailPk = (email: string) => `RBEMAIL#${email.trim().toLowerCase()}`

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Lower-case, strip diacritics and apostrophes. "Zoë O'Brien" → "zoe obrien". */
export function foldName(value: string | undefined | null): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
}

/** Distinct search tokens of a name, in order. "Mary-Ann  Smith" → [mary, ann, smith]. */
export function nameTokens(...parts: Array<string | undefined | null>): string[] {
  const out: string[] = []
  for (const part of parts) {
    for (const t of foldName(part).split(/[^a-z0-9]+/)) {
      if (t && !out.includes(t)) out.push(t)
    }
  }
  return out
}

/**
 * The stable id of an ecclesia. Stored on the ECCLESIA item (`ecclesiaId`)
 * from creation and carried across renames; items written before ids existed
 * use the slug of their name, which is what their id would have been.
 */
export function slugifyEcclesia(name: string | undefined | null): string {
  const slug = foldName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'none'
}

export function ecclesiaIdOf(item: { ecclesiaId?: string; name?: string }): string {
  return item.ecclesiaId || slugifyEcclesia(item.name)
}

const sortName = (lastName?: string, firstName?: string) =>
  `${foldName(lastName)}#${foldName(firstName)}`

// ---------------------------------------------------------------------------
// Source shapes (only the attributes the projections read)
// ---------------------------------------------------------------------------

export interface ProfileSource {
  pkey: string
  skey: string
  personId: string
  primaryEmail?: string
  firstName?: string
  lastName?: string
  displayName?: string
  ecclesia?: string
  memberStatus?: string
  role?: string
  isRecordingBrother?: boolean
  isInterEcclesiaRep?: boolean
  createdAt?: string
}

export interface EmailSource {
  skey: string
  email: string
  emailType?: string
  order?: number
  verified?: boolean
  sesStatus?: string
  sesSubscribed?: boolean
  loginExcluded?: boolean
  archiveAfter?: string
}

export interface PhoneSource {
  skey: string
  number?: string
  type?: string
  isPrimary?: boolean
  order?: number
  verified?: boolean
}

export interface EcclesiaSource {
  pkey: string
  skey: string
  name: string
  country?: string
  province?: string
  city?: string
  ecclesiaId?: string
  recordingBrotherPersonId?: string
  recordingBrotherEmail?: string
}

export type ProjectionItem = Record<string, any> & { pkey: string; skey: string }

// ---------------------------------------------------------------------------
// Person projections
// ---------------------------------------------------------------------------

export interface CardEmail {
  email: string
  emailType?: string
  order?: number
  verified?: boolean
  sesStatus?: string
  sesSubscribed?: boolean
  loginExcluded?: boolean
  archiveAfter?: string
}

export interface PersonCard {
  pkey: string
  skey: typeof CARD_SK
  type: 'PERSON_CARD'
  schemaVersion: number
  personId: string
  displayName: string
  firstName: string
  lastName: string
  ecclesia: string
  ecclesiaId: string
  memberStatus?: string
  role?: string
  primaryEmail: string
  primaryPhone?: string
  /** Digits only, every number the person has — search material, not display. */
  phoneDigits: string[]
  emails: CardEmail[]
  isRecordingBrother?: boolean
  isInterEcclesiaRep?: boolean
  createdAt?: string
  gsi2pk: string
  gsi2sk: string
  gsi4pk: string
  gsi4sk: string
}

/**
 * Every projection item derived from ONE person's own partition, plus the
 * ECCLESIA-side half of the REP office reference (which this writer owns).
 *
 * `ecclesiaId` is the resolved stable id of `profile.ecclesia`.
 */
export function derivePersonProjections(input: {
  profile: ProfileSource | null
  emails: EmailSource[]
  phones: PhoneSource[]
  ecclesiaId: string
}): ProjectionItem[] {
  const { profile, emails, phones, ecclesiaId } = input
  if (!profile) return []
  const personId = profile.personId
  const pkey = `PERSON#${personId}`
  const firstName = profile.firstName || ''
  const lastName = profile.lastName || ''
  const displayName = profile.displayName || `${firstName} ${lastName}`.trim()
  const order = sortName(lastName, firstName)

  const sortedPhones = phones
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.skey.localeCompare(b.skey))
  const primaryPhone = (sortedPhones.find((p) => p.isPrimary) || sortedPhones[0])?.number
  const phoneDigits = [
    ...new Set(sortedPhones.map((p) => (p.number || '').replace(/\D/g, '')).filter(Boolean)),
  ]

  const cardEmails: CardEmail[] = emails
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.skey.localeCompare(b.skey))
    .map((e) =>
      stripUndefined({
        email: (e.email || '').toLowerCase(),
        emailType: e.emailType,
        order: e.order,
        verified: e.verified,
        sesStatus: e.sesStatus,
        sesSubscribed: e.sesSubscribed,
        loginExcluded: e.loginExcluded,
        archiveAfter: e.archiveAfter,
      }) as CardEmail
    )
    .filter((e) => e.email)

  const card: PersonCard = stripUndefined({
    pkey,
    skey: CARD_SK,
    type: 'PERSON_CARD',
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    personId,
    displayName,
    firstName,
    lastName,
    ecclesia: profile.ecclesia || '',
    ecclesiaId,
    memberStatus: profile.memberStatus,
    role: profile.role,
    primaryEmail: (profile.primaryEmail || '').toLowerCase(),
    primaryPhone,
    phoneDigits,
    emails: cardEmails,
    isRecordingBrother: profile.isRecordingBrother || undefined,
    isInterEcclesiaRep: profile.isInterEcclesiaRep || undefined,
    createdAt: profile.createdAt,
    gsi2pk: ecclesiaPeoplePk(ecclesiaId),
    gsi2sk: `${order}#${personId}`,
    gsi4pk: peopleRosterPk(),
    gsi4sk: `${order}#${personId}`,
  }) as PersonCard

  const items: ProjectionItem[] = [card]

  const tokens = nameTokens(firstName, lastName)
  for (const token of tokens) {
    items.push(
      stripUndefined({
        pkey,
        skey: `${NAMETOK_PREFIX}${token}`,
        type: 'NAME_TOKEN',
        schemaVersion: PROJECTION_SCHEMA_VERSION,
        personId,
        displayName,
        ecclesia: profile.ecclesia || '',
        role: profile.role,
        tokens,
        gsi3pk: namePrefixPk(token),
        gsi3sk: `${token}#${personId}`,
      }) as ProjectionItem
    )
  }

  return items
}

/** Does the PERSON writer own this existing item? Its partition's CARD and NAMETOK# items. */
export function isPersonWriterItem(item: { pkey: string; skey: string }): boolean {
  if (!item.pkey.startsWith('PERSON#')) return false
  return item.skey === CARD_SK || item.skey.startsWith(NAMETOK_PREFIX)
}

// ---------------------------------------------------------------------------
// Ecclesia projections
// ---------------------------------------------------------------------------

export function deriveEcclesiaProjections(source: EcclesiaSource | null, ecclesiaId: string): ProjectionItem[] {
  if (!source) return []
  const country = source.country || ''
  const province = source.province || ''
  const city = source.city || ''
  const rbEmail = (source.recordingBrotherEmail || '').trim().toLowerCase()
  const alias = stripUndefined({
    pkey: ecclesiaIdPk(ecclesiaId),
    skey: ECCLESIA_ALIAS_SK,
    type: 'ECCLESIA_DIRECTORY',
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    ecclesiaId,
    name: source.name,
    country,
    province,
    city,
    ecclesiaPkey: source.pkey,
    ecclesiaSkey: source.skey,
    gsi2pk: ECCLESIA_DIRECTORY_PK,
    gsi2sk: `${country}|${province}|${city}#${source.name}`,
    // Sign-in RB check for an address that has no PersonRecord yet. Indexes
    // the LEGACY copied `recordingBrotherEmail` until offices are migrated
    // (the office's own email is indexed by officeRepository).
    gsi1pk: rbEmail ? rbEmailPk(rbEmail) : undefined,
    gsi1sk: rbEmail ? ECCLESIA_ALIAS_SK : undefined,
  }) as ProjectionItem
  return [alias]
}

/** Does the ECCLESIA writer own this existing item? Only the alias/directory entry (never an OFFICE#). */
export function isEcclesiaWriterItem(item: { pkey: string; skey: string }): boolean {
  return item.pkey.startsWith(ECCLESIA_ID_PREFIX) && item.skey === ECCLESIA_ALIAS_SK
}

/**
 * The only keys any projection writer (runtime or backfill) may put or delete.
 * A guard, so a bug can never touch a source PROFILE/EMAIL#/PHONE#/ECCLESIA item.
 */
export function isProjectionKey(item: { pkey: string; skey: string }): boolean {
  if (item.pkey === INDEX_META_PK) return item.skey === INDEX_META_SK
  return isPersonWriterItem(item) || isEcclesiaWriterItem(item)
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export interface ProjectionDiff {
  puts: ProjectionItem[]
  deletes: Array<{ pkey: string; skey: string }>
  unchanged: number
}

const IGNORED_FOR_EQUALITY = new Set(['projectedAt'])

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .filter((k) => !IGNORED_FOR_EQUALITY.has(k))
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonical(value[k])
        return acc
      }, {} as Record<string, any>)
  }
  return value
}

export function sameProjection(a: Record<string, any>, b: Record<string, any>): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

const keyOf = (i: { pkey: string; skey: string }) => `${i.pkey}\u0000${i.skey}`

/**
 * What must change so that `existing` (the writer's items as they are) becomes
 * `desired`. Idempotent: a second run on the result yields no puts/deletes.
 */
export function diffProjections(existing: ProjectionItem[], desired: ProjectionItem[]): ProjectionDiff {
  const have = new Map(existing.map((i) => [keyOf(i), i]))
  const want = new Map(desired.map((i) => [keyOf(i), i]))
  const puts: ProjectionItem[] = []
  const deletes: Array<{ pkey: string; skey: string }> = []
  let unchanged = 0
  for (const [k, item] of want) {
    const cur = have.get(k)
    if (cur && sameProjection(cur, item)) unchanged++
    else puts.push(item)
  }
  for (const [k, item] of have) {
    if (!want.has(k)) deletes.push({ pkey: item.pkey, skey: item.skey })
  }
  return { puts, deletes, unchanged }
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}
