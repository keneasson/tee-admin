/**
 * OFFICES — a first-class SOURCE entity (#58, ADR-0006 §6, owner 2026-10-17).
 *
 * An office (Recording Brother, Treasurer, Inter-Ecclesia Rep, …) belongs to
 * an ecclesia and owns its OWN contact channels — e.g. a role inbox such as
 * "treasurer@…" — plus a REFERENCE to the person who currently holds it.
 * The holder changes; the office's contact details do not.
 *
 *   - Contact info lives on the office, never on the person. Sending "to the
 *     Treasurer" uses the office email.
 *   - The holder is a personId reference with a history of terms (from/to).
 *     "Who is the Recording Brother" resolves that person through the
 *     smart-component tiers (ADR-0005) — the office stores no name.
 *   - An office mailbox is NEVER modelled as a nameless PersonRecord.
 *
 * Item:   pkey ECCLESIA_ID#<ecclesiaId>   skey OFFICE#<role>
 * Sparse index entries on the office item (only when present):
 *   gsi1  OFFICEHOLDER#<personId> / OFFICE#<ecclesiaId>#<role>   person → offices held (Query)
 *   gsi3  OFFICEMAIL#<email>      / OFFICE#<ecclesiaId>#<role>   office inbox → office (Query)
 *
 * This repository is the office's only writer. Every write is conditional on
 * the item's version, so two concurrent holder changes cannot lose a term.
 */
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, tableNames } from '../config'
import { batchGetItems } from '../people-index/reader'
import { ecclesiaIdPk, foldName, type PersonCard, CARD_SK } from '../people-index/keys'

const TABLE = tableNames.admin
export const OFFICE_SK_PREFIX = 'OFFICE#'

/** Well-known roles. Any other slug is allowed (e.g. an organization's "president"). */
export const OFFICE_ROLES = {
  RECORDING_BROTHER: 'recording-brother',
  TREASURER: 'treasurer',
  INTER_ECCLESIA_REP: 'inter-ecclesia-rep',
} as const

export const OFFICE_TITLES: Record<string, string> = {
  [OFFICE_ROLES.RECORDING_BROTHER]: 'Recording Brother',
  [OFFICE_ROLES.TREASURER]: 'Treasurer',
  [OFFICE_ROLES.INTER_ECCLESIA_REP]: 'Inter-Ecclesia Representative',
}

export interface OfficeTerm {
  personId: string
  from: string
  to?: string
}

export interface OfficePostalAddress {
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country?: string
}

export interface OfficeRecord {
  pkey: string
  skey: string
  type: 'OFFICE'
  ecclesiaId: string
  role: string
  title: string
  /** The office's own inbox (e.g. a role address). Optional: some offices have none. */
  email?: string
  phone?: string
  postalAddress?: OfficePostalAddress
  /** The person holding the office now. A reference, never a copied name/email. */
  holderPersonId?: string
  holderSince?: string
  /** Past and current terms, oldest first. The open term has no `to`. */
  terms: OfficeTerm[]
  createdAt: string
  updatedAt: string
  version: number
  gsi1pk?: string
  gsi1sk?: string
  gsi3pk?: string
  gsi3sk?: string
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeOfficeRole(role: string): string {
  const slug = foldName(role).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!slug) throw new Error('office role is required')
  return slug
}

export const officeKey = (ecclesiaId: string, role: string) => ({
  pkey: ecclesiaIdPk(ecclesiaId),
  skey: `${OFFICE_SK_PREFIX}${normalizeOfficeRole(role)}`,
})

/** (Re)compute the sparse index attributes from the office's own fields. */
export function withOfficeIndexes(office: Omit<OfficeRecord, 'gsi1pk' | 'gsi1sk' | 'gsi3pk' | 'gsi3sk'>): OfficeRecord {
  const sk = `${OFFICE_SK_PREFIX}${office.ecclesiaId}#${office.role}`
  const out: OfficeRecord = { ...office }
  if (office.holderPersonId) {
    out.gsi1pk = `OFFICEHOLDER#${office.holderPersonId}`
    out.gsi1sk = sk
  }
  if (office.email) {
    out.gsi3pk = `OFFICEMAIL#${office.email}`
    out.gsi3sk = sk
  }
  return out
}

/**
 * Hand the office to `personId` (or vacate it with null) at `at`: closes the
 * open term and opens a new one. Contact details are untouched. Re-assigning
 * the current holder is a no-op.
 */
export function applyHolderChange(office: OfficeRecord, personId: string | null, at: string): OfficeRecord {
  if ((office.holderPersonId || null) === personId) return office
  const terms = office.terms.map((t) => (t.to ? t : { ...t, to: at }))
  if (personId) terms.push({ personId, from: at })
  const { gsi1pk: _a, gsi1sk: _b, gsi3pk: _c, gsi3sk: _d, ...rest } = office
  return withOfficeIndexes({
    ...rest,
    holderPersonId: personId || undefined,
    holderSince: personId ? at : undefined,
    terms,
    updatedAt: at,
  })
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface SaveOfficeInput {
  ecclesiaId: string
  role: string
  title?: string
  email?: string | null
  phone?: string | null
  postalAddress?: OfficePostalAddress | null
}

export class OfficeRepository {
  async getOffice(ecclesiaId: string, role: string): Promise<OfficeRecord | null> {
    const result = await docClient.send(
      new GetCommand({ TableName: TABLE, Key: officeKey(ecclesiaId, role), ConsistentRead: true })
    )
    return (result?.Item as OfficeRecord) || null
  }

  /** Pattern 8: every office of an ecclesia. */
  async listOffices(ecclesiaId: string): Promise<OfficeRecord[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
        ExpressionAttributeValues: { ':pk': ecclesiaIdPk(ecclesiaId), ':sk': OFFICE_SK_PREFIX },
      })
    )
    return (result?.Items || []) as OfficeRecord[]
  }

  /** Pattern 11: the offices a person holds now (sign-in RB check, permissions). */
  async listOfficesHeldBy(personId: string): Promise<OfficeRecord[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': `OFFICEHOLDER#${personId}` },
      })
    )
    return (result?.Items || []) as OfficeRecord[]
  }

  /** An office inbox → its office(s). Lets a role address reach its holder without a nameless person. */
  async findOfficesByEmail(email: string): Promise<OfficeRecord[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'gsi3',
        KeyConditionExpression: 'gsi3pk = :pk',
        ExpressionAttributeValues: { ':pk': `OFFICEMAIL#${email.trim().toLowerCase()}` },
      })
    )
    return (result?.Items || []) as OfficeRecord[]
  }

  /** Create the office, or change its title / contact channels. Never touches the holder. */
  async saveOffice(input: SaveOfficeInput): Promise<OfficeRecord> {
    const role = normalizeOfficeRole(input.role)
    const now = new Date().toISOString()
    const current = await this.getOffice(input.ecclesiaId, role)
    const base: Omit<OfficeRecord, 'gsi1pk' | 'gsi1sk' | 'gsi3pk' | 'gsi3sk'> = current
      ? (({ gsi1pk: _a, gsi1sk: _b, gsi3pk: _c, gsi3sk: _d, ...rest }) => rest)(current)
      : {
          ...officeKey(input.ecclesiaId, role),
          type: 'OFFICE',
          ecclesiaId: input.ecclesiaId,
          role,
          title: OFFICE_TITLES[role] || role,
          terms: [],
          createdAt: now,
          updatedAt: now,
          version: 0,
        }
    const next = { ...base, updatedAt: now }
    if (input.title !== undefined) next.title = input.title.trim() || next.title
    // `null` clears a channel; `undefined` leaves it as it is.
    if (input.email !== undefined) next.email = input.email ? input.email.trim().toLowerCase() : undefined
    if (input.phone !== undefined) next.phone = input.phone ? input.phone.trim() : undefined
    if (input.postalAddress !== undefined) next.postalAddress = input.postalAddress || undefined
    return this.write(withOfficeIndexes(next), current?.version)
  }

  /** Change (or vacate, with null) the holder, recording the term. */
  async assignHolder(ecclesiaId: string, role: string, personId: string | null, at = new Date().toISOString()): Promise<OfficeRecord> {
    const current = await this.getOffice(ecclesiaId, role)
    if (!current) throw new Error(`No office "${normalizeOfficeRole(role)}" for ecclesia ${ecclesiaId}; create it first`)
    const next = applyHolderChange(current, personId, at)
    if (next === current) return current
    return this.write(next, current.version)
  }

  /** The office plus its holder's CARD (one BatchGet). Redact the card per ADR-0005 before showing it. */
  async getOfficeWithHolder(ecclesiaId: string, role: string): Promise<{ office: OfficeRecord; holder: PersonCard | null } | null> {
    const office = await this.getOffice(ecclesiaId, role)
    if (!office) return null
    if (!office.holderPersonId) return { office, holder: null }
    const [holder] = await batchGetItems<PersonCard>([{ pkey: `PERSON#${office.holderPersonId}`, skey: CARD_SK }])
    return { office, holder: holder || null }
  }

  private async write(item: OfficeRecord, expectedVersion: number | undefined): Promise<OfficeRecord> {
    if (!item.pkey.startsWith(ecclesiaIdPk('')) || !item.skey.startsWith(OFFICE_SK_PREFIX)) {
      throw new Error(`officeRepository: refusing to write ${item.pkey} / ${item.skey}`)
    }
    const toWrite = Object.fromEntries(
      Object.entries({ ...item, version: (expectedVersion ?? -1) + 1 }).filter(([, v]) => v !== undefined)
    ) as unknown as OfficeRecord
    await docClient.send(
      new PutCommand({
        TableName: TABLE,
        Item: toWrite,
        ...(expectedVersion === undefined
          ? { ConditionExpression: 'attribute_not_exists(pkey)' }
          : {
              ConditionExpression: '#v = :v',
              ExpressionAttributeNames: { '#v': 'version' },
              ExpressionAttributeValues: { ':v': expectedVersion },
            }),
      })
    )
    return toWrite
  }
}

export const officeRepository = new OfficeRepository()
