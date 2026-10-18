/**
 * PURE shaping of resolved smart references for one viewer (plan §0 R6,
 * ADR-0005). The I/O — the batch reads — lives in
 * `packages/app/services/smart-refs-service.ts`; this file only decides what a
 * viewer may see, so every tier is unit-testable without DynamoDB.
 *
 * Tiers:
 *  - anonymous: the floor. A person's first name; an ecclesia's name, venue,
 *    city and its office titles. Everything else is withheld for `sign-in`.
 *  - identified (recognized or authenticated, `canRevealPii`): full name; the
 *    person's email and phone as far as THAT PERSON's per-field privacy
 *    reaches the viewer (`decideFieldVisibility`, the directory's own rule),
 *    else withheld for `scope`; an ecclesia's street address and its offices'
 *    own channels.
 */
import { canRevealPii, type Viewer } from './viewer-pii'
import { decideFieldVisibility } from './privacy-visibility'
import type { PrivacySettingsRecord, VisibilityLevel } from '../provider/dynamodb/types'
import type { PersonCard } from '../provider/dynamodb/people-index/keys'
import type { OfficeRecord } from '../provider/dynamodb/repositories/office-repository'
import type {
  SmartEcclesia,
  SmartEcclesiaField,
  SmartOffice,
  SmartOfficeField,
  SmartPerson,
  SmartPersonField,
  SmartWithheld,
} from '../types/smart-refs'

/** Privacy fields that gate a contact channel. */
type ContactSetting = 'showEmail' | 'showPhone'

/** Is this card the viewer themself? Matched on any of the person's addresses (personId arrives with #268). */
export function isViewerSelf(card: PersonCard, viewer: Viewer): boolean {
  const mine = viewer.email?.trim().toLowerCase()
  if (!mine) return false
  if (card.primaryEmail === mine) return true
  return (card.emails || []).some((e) => e.email === mine)
}

function visibilityOf(privacy: PrivacySettingsRecord | undefined, setting: ContactSetting): VisibilityLevel | undefined {
  return privacy?.[setting]
}

function decide(card: PersonCard, privacy: PrivacySettingsRecord | undefined, viewer: Viewer, setting: ContactSetting) {
  return decideFieldVisibility(visibilityOf(privacy, setting), {
    isSelf: isViewerSelf(card, viewer),
    viewerRole: viewer.role,
    viewerEcclesia: viewer.tenant,
    targetEcclesia: card.ecclesia,
  })
}

/**
 * Would revealing this card's contact depend on a connection from the person
 * to the viewer? The resolver reads connections only for these cards.
 */
export function needsConnectionCheck(card: PersonCard, privacy: PrivacySettingsRecord | undefined, viewer: Viewer): boolean {
  if (!canRevealPii(viewer) || !viewer.email || card.role === 'deceased') return false
  return (
    (!!card.primaryEmail && decide(card, privacy, viewer, 'showEmail') === 'if-connected') ||
    (!!card.primaryPhone && decide(card, privacy, viewer, 'showPhone') === 'if-connected')
  )
}

/** A card the resolver must not render as a contact at all. */
export function isUnrenderablePerson(card: PersonCard | undefined): boolean {
  return !card || card.role === 'suspicious'
}

/**
 * One person for one viewer. `connected` = the person has an active connection
 * to the viewer (only consulted where their privacy says so). `includeId`
 * carries the person id (a top-level reference, or an identified viewer).
 */
export function shapePerson(
  card: PersonCard,
  input: { viewer: Viewer; privacy?: PrivacySettingsRecord; connected?: boolean; includeId: boolean }
): SmartPerson {
  const { viewer, privacy, connected = false, includeId } = input
  const reveal = canRevealPii(viewer)
  const withheld: Array<SmartWithheld<SmartPersonField>> = []
  const out: SmartPerson = { type: 'person', found: true, firstName: card.firstName || '', withheld }
  if (includeId) out.id = card.personId

  if (card.lastName) {
    if (reveal) out.lastName = card.lastName
    else withheld.push({ field: 'lastName', reason: 'sign-in' })
  }

  // Nobody can be contacted on behalf of a deceased person: absent, not withheld.
  if (card.role === 'deceased') return out

  const channels: Array<[SmartPersonField, ContactSetting, string | undefined]> = [
    ['email', 'showEmail', card.primaryEmail || undefined],
    ['phone', 'showPhone', card.primaryPhone || undefined],
  ]
  let scoped = false
  for (const [field, setting, value] of channels) {
    if (!value) continue
    if (!reveal) {
      withheld.push({ field, reason: 'sign-in' })
      continue
    }
    const decision = decide(card, privacy, viewer, setting)
    const allowed = decision === 'if-connected' ? connected : decision
    if (allowed) {
      out[field] = value
    } else {
      withheld.push({ field, reason: 'scope' })
      scoped = true
    }
  }
  if (scoped) out.canRequestContact = privacy?.allowContactRequests !== false
  return out
}

// ---------------------------------------------------------------------------
// Ecclesias
// ---------------------------------------------------------------------------

/** The ecclesia id alias / directory entry (`ECCLESIA_ID#<id> / ECCLESIA`). */
export interface EcclesiaAlias {
  ecclesiaId: string
  name: string
  country?: string
  province?: string
  city?: string
  ecclesiaPkey: string
  ecclesiaSkey: string
}

/** The attributes of the `ECCLESIA#…` source item this shaping reads. */
export interface EcclesiaSourceFields {
  name?: string
  country?: string
  province?: string
  city?: string
  venue?: string
  address?: string
  postalCode?: string
  website?: string
  timezone?: string
}

/** `rb`, `rep` or another kind, for offices written before and after the RB/Rep slot model (#280). */
export function officeKind(office: Pick<OfficeRecord, 'role'> & { kind?: string }): string {
  if (office.kind) return office.kind
  const base = (office.role || '').split('#')[0]
  if (base === 'rb' || base === 'recording-brother') return 'rb'
  if (base === 'rep' || base === 'inter-ecclesia-rep') return 'rep'
  return base
}

const KIND_ORDER: Record<string, number> = { rb: 0, rep: 1 }

function officeOrder(a: OfficeRecord & { kind?: string; slot?: number }, b: OfficeRecord & { kind?: string; slot?: number }) {
  const ka = officeKind(a)
  const kb = officeKind(b)
  return (
    (KIND_ORDER[ka] ?? 2) - (KIND_ORDER[kb] ?? 2) ||
    ka.localeCompare(kb) ||
    (a.slot ?? 0) - (b.slot ?? 0) ||
    a.role.localeCompare(b.role)
  )
}

export function shapeOffice(
  office: OfficeRecord & { kind?: string; slot?: number },
  input: { viewer: Viewer; holder: SmartPerson | null }
): SmartOffice {
  const reveal = canRevealPii(input.viewer)
  const withheld: Array<SmartWithheld<SmartOfficeField>> = []
  const out: SmartOffice = {
    officeId: office.role,
    kind: officeKind(office),
    title: office.title,
    withheld,
    holder: input.holder,
  }
  const channels: Array<[SmartOfficeField, unknown]> = [
    ['email', office.email],
    ['phone', office.phone],
    ['postalAddress', office.postalAddress],
  ]
  for (const [field, value] of channels) {
    if (!value) continue
    if (reveal) (out as any)[field] = value
    else withheld.push({ field, reason: 'sign-in' })
  }
  return out
}

/**
 * One ecclesia for one viewer. `holders` maps an office's holderPersonId to
 * that holder already shaped for this viewer (or absent when the card is missing).
 */
export function shapeEcclesia(
  alias: EcclesiaAlias,
  input: {
    viewer: Viewer
    source: EcclesiaSourceFields | null
    offices: Array<OfficeRecord & { kind?: string; slot?: number }>
    holders: Map<string, SmartPerson>
  }
): SmartEcclesia {
  const { viewer, source, offices, holders } = input
  const reveal = canRevealPii(viewer)
  const withheld: Array<SmartWithheld<SmartEcclesiaField>> = []
  const location: SmartEcclesia['location'] = {}
  const floor = {
    venue: source?.venue,
    city: source?.city || alias.city,
    province: source?.province || alias.province,
    country: source?.country || alias.country,
  }
  for (const [k, v] of Object.entries(floor)) if (v) (location as any)[k] = v
  // A meeting place can be a member's home, so the street address is
  // location-precise like any other (ADR-0005 floor: venue + city).
  const precise: Array<[SmartEcclesiaField, string | undefined]> = [
    ['address', source?.address],
    ['postalCode', source?.postalCode],
  ]
  for (const [field, value] of precise) {
    if (!value) continue
    if (reveal) location[field] = value
    else withheld.push({ field, reason: 'sign-in' })
  }

  const out: SmartEcclesia = {
    type: 'ecclesia',
    id: alias.ecclesiaId,
    found: true,
    name: source?.name || alias.name,
    location,
    offices: offices
      .slice()
      .sort(officeOrder)
      .map((o) =>
        shapeOffice(o, { viewer, holder: o.holderPersonId ? holders.get(o.holderPersonId) || null : null })
      ),
    withheld,
  }
  if (source?.website) out.website = source.website
  if (source?.timezone) out.timezone = source.timezone
  return out
}
