/**
 * OFFICES — a first-class SOURCE entity (#58, ADR-0006 §6, owner 2026-10-17).
 *
 * EVERY ecclesia has a Recording Brother office (`OFFICE#rb`) and zero or more
 * Rep offices (`OFFICE#rep#<n>`). A Rep is an assistant to the Recording
 * Brother; RB and Reps receive inter-ecclesia email. Other offices (e.g.
 * `OFFICE#treasurer`) are allowed.
 *
 * An office belongs to
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
 * Item:   pkey ECCLESIA_ID#<ecclesiaId>   skey OFFICE#<officeId>   (officeId: rb | rep#<n> | <slug>)
 *
 * `isRecordingBrother` / `isInterEcclesiaRep` are DERIVED from these holders
 * (`deriveOfficeFlags`); the office writer never writes person flags.
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

/** Office kinds. Any other slug is allowed (e.g. an organization's "president"). */
export const OFFICE_ROLES = {
  /** Exactly one per ecclesia: `OFFICE#rb`. */
  RECORDING_BROTHER: 'rb',
  /** Zero or more per ecclesia: `OFFICE#rep#<n>`. Assistant to the RB; receives inter-ecclesia email. */
  REP: 'rep',
  TREASURER: 'treasurer',
} as const

export const OFFICE_TITLES: Record<string, string> = {
  [OFFICE_ROLES.RECORDING_BROTHER]: 'Recording Brother',
  [OFFICE_ROLES.REP]: 'Rep',
  [OFFICE_ROLES.TREASURER]: 'Treasurer',
}

/** Kinds whose offices receive inter-ecclesia email. */
export const INTER_ECCLESIA_KINDS: readonly string[] = [OFFICE_ROLES.RECORDING_BROTHER, OFFICE_ROLES.REP]

export const repOfficeId = (slot: number) => `${OFFICE_ROLES.REP}#${slot}`

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
  /** The office id within its ecclesia: `rb`, `rep#2`, `treasurer`. */
  role: string
  /** `rb`, `rep`, `treasurer`, … (the id without its slot). */
  kind: string
  /** Rep slot number. */
  slot?: number
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

/**
 * Canonical office id: a kind slug plus an optional `#<n>` slot.
 * "Recording Brother" → `rb`; "rep#2" → `rep#2`. A Rep office must carry a slot.
 */
export function normalizeOfficeRole(role: string): string {
  const [rawKind, rawSlot, ...extra] = (role || '').split('#')
  if (extra.length > 0) throw new Error(`invalid office id "${role}"`)
  let kind = foldName(rawKind).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (kind === 'recording-brother') kind = OFFICE_ROLES.RECORDING_BROTHER
  if (!kind) throw new Error('office role is required')
  if (rawSlot === undefined) {
    if (kind === OFFICE_ROLES.REP) throw new Error('a Rep office needs a slot, e.g. "rep#1"')
    return kind
  }
  const slot = Number(rawSlot)
  if (!Number.isInteger(slot) || slot < 1) throw new Error(`invalid office slot in "${role}"`)
  if (kind === OFFICE_ROLES.RECORDING_BROTHER) throw new Error('there is one Recording Brother office per ecclesia ("rb")')
  return `${kind}#${slot}`
}

export function parseOfficeId(officeId: string): { kind: string; slot?: number } {
  const [kind, slot] = normalizeOfficeRole(officeId).split('#')
  return slot ? { kind, slot: Number(slot) } : { kind }
}

/**
 * The person flags, DERIVED from the offices a person holds — never stored
 * independently once offices are live.
 */
export function deriveOfficeFlags(heldOffices: Array<Pick<OfficeRecord, 'kind' | 'ecclesiaId'>>) {
  const rb = heldOffices.filter((o) => o.kind === OFFICE_ROLES.RECORDING_BROTHER).map((o) => o.ecclesiaId)
  const rep = heldOffices.filter((o) => o.kind === OFFICE_ROLES.REP).map((o) => o.ecclesiaId)
  return {
    isRecordingBrother: rb.length > 0,
    isInterEcclesiaRep: rep.length > 0,
    recordingBrotherOf: [...new Set(rb)].sort(),
    repOf: [...new Set(rep)].sort(),
  }
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
    const { kind, slot } = parseOfficeId(role)
    const now = new Date().toISOString()
    const current = await this.getOffice(input.ecclesiaId, role)
    const base: Omit<OfficeRecord, 'gsi1pk' | 'gsi1sk' | 'gsi3pk' | 'gsi3sk'> = current
      ? (({ gsi1pk: _a, gsi1sk: _b, gsi3pk: _c, gsi3sk: _d, ...rest }) => rest)(current)
      : {
          ...officeKey(input.ecclesiaId, role),
          type: 'OFFICE',
          ecclesiaId: input.ecclesiaId,
          role,
          kind,
          slot,
          title: OFFICE_TITLES[kind] ? `${OFFICE_TITLES[kind]}${slot && slot > 1 ? ` ${slot}` : ''}` : role,
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

  /** The ecclesia's Recording Brother office, created (vacant, no channels) if missing. */
  async ensureRecordingBrotherOffice(ecclesiaId: string): Promise<OfficeRecord> {
    return (await this.getOffice(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER)) ||
      this.saveOffice({ ecclesiaId, role: OFFICE_ROLES.RECORDING_BROTHER })
  }

  /** Add a Rep office in the next free slot. */
  async addRepOffice(ecclesiaId: string, channels: Omit<SaveOfficeInput, 'ecclesiaId' | 'role'> = {}): Promise<OfficeRecord> {
    const slots = (await this.listOffices(ecclesiaId)).filter((o) => o.kind === OFFICE_ROLES.REP).map((o) => o.slot || 0)
    return this.saveOffice({ ...channels, ecclesiaId, role: repOfficeId(Math.max(0, ...slots) + 1) })
  }

  /**
   * Where inter-ecclesia email for this ecclesia goes: each RB/Rep office's own
   * inbox, else its holder's primary address. Not yet wired to the send path
   * (which keeps its current recipients until cutover).
   */
  async listInterEcclesiaContacts(ecclesiaId: string): Promise<Array<{ officeId: string; email: string | null; holderPersonId?: string; via: 'office' | 'holder' | 'none' }>> {
    const offices = (await this.listOffices(ecclesiaId)).filter((o) => INTER_ECCLESIA_KINDS.includes(o.kind))
    const holderIds = offices.filter((o) => !o.email && o.holderPersonId).map((o) => o.holderPersonId as string)
    const cards = holderIds.length
      ? await batchGetItems<PersonCard>(holderIds.map((id) => ({ pkey: `PERSON#${id}`, skey: CARD_SK })))
      : []
    const byId = new Map(cards.map((c) => [c.personId, c]))
    return offices.map((o) => {
      if (o.email) return { officeId: o.role, email: o.email, holderPersonId: o.holderPersonId, via: 'office' as const }
      const card = o.holderPersonId ? byId.get(o.holderPersonId) : undefined
      return card?.primaryEmail
        ? { officeId: o.role, email: card.primaryEmail, holderPersonId: o.holderPersonId, via: 'holder' as const }
        : { officeId: o.role, email: null, holderPersonId: o.holderPersonId, via: 'none' as const }
    })
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
