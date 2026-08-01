/**
 * Phase 0 adapter — maps today's flat `Event` / `NewsItem` records into the
 * unified {@link Post} block model WITH correct PII classes, so `redactPost` can
 * scrub them without any storage migration or new authoring UI (design §7).
 *
 * This is where every PII field gets enumerated ONCE: a candidate/deceased/
 * couple becomes a PersonBlock; an aboutCandidate/obituary becomes a `bio`; a
 * LocationInfo becomes a LocationBlock (venue floor vs precise); dates/schedule
 * become TimeBlocks; documents become FlyerBlocks; body/theme become a TextBlock.
 *
 * Pure + I/O-free. Cross-platform: no platform imports.
 */

import type {
  Event,
  EventType,
  FuneralLocations,
  LocationInfo,
  RegistrationInfo,
  ScheduleItem,
} from '../types/events'
import type { NewsItem } from '../types/news'
import type {
  Block,
  FlyerBlock,
  LocationBlock,
  OccasionTag,
  PersonBlock,
  Post,
  RegistrationBlock,
  TextBlock,
  TimeBlock,
  Visibility,
} from '../types/post'

// ── helpers ──────────────────────────────────────────────────────────────

// Intentional module-level counter: `legacyToPost` output is transient (an
// in-memory adapter view, never persisted), so a process-wide incrementing
// counter for virtual block ids is fine — it just needs to be unique within a
// single adapted post, not stable across calls or processes.
let seq = 0
/** Deterministic-enough virtual block id (adapter output is transient). */
function bid(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value)
  const t = d.getTime()
  return isNaN(t) ? (typeof value === 'string' ? value : undefined) : d.toISOString()
}

function joinBio(...parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((p): p is string => !!p && p.trim().length > 0)
  return kept.length ? kept.join('\n\n') : undefined
}

/**
 * Occasions that can carry sensitive PII in FREE TEXT / pixels. Under these, a
 * TextBlock and a FlyerBlock default to `members` reach (design §5, §8.3) — the
 * redactor can't parse names out of prose or images, so anon simply doesn't see
 * them.
 */
const PII_BEARING_OCCASIONS: ReadonlySet<OccasionTag> = new Set([
  'funeral',
  'baptism',
  'engagement',
  'medical',
])

function isPiiBearing(occasion: OccasionTag[]): boolean {
  return occasion.some((o) => PII_BEARING_OCCASIONS.has(o))
}

const EVENT_TYPE_TO_OCCASION: Record<EventType, OccasionTag> = {
  'study-weekend': 'study-weekend',
  funeral: 'funeral',
  wedding: 'wedding',
  baptism: 'baptism',
  engagement: 'engagement',
  general: 'general',
  recurring: 'recurring',
  'election-cycle': 'election-cycle',
}

// ── location mapping ───────────────────────────────────────────────────────

function locationInfoToBlock(
  loc: LocationInfo | undefined,
  label?: string
): LocationBlock | undefined {
  if (!loc) return undefined
  const hasContent =
    loc.name ||
    loc.placeName ||
    loc.address ||
    loc.city ||
    loc.onlineMeeting ||
    loc.postalCode ||
    typeof loc.lat === 'number'
  if (!hasContent) return undefined
  const block: LocationBlock = {
    id: bid('loc'),
    kind: 'location',
    mode: loc.mode === 'online' ? 'plain' : 'geo',
  }
  if (label) block.label = label
  const venue = loc.name || loc.placeName
  if (venue) block.venueName = venue
  if (loc.city) block.city = loc.city
  if (loc.province) block.province = loc.province
  if (loc.country) block.country = loc.country
  if (loc.address) block.address = loc.address
  if (loc.postalCode) block.postalCode = loc.postalCode
  if (typeof loc.lat === 'number') block.lat = loc.lat
  if (typeof loc.lng === 'number') block.lng = loc.lng
  if (loc.directions) block.directions = loc.directions
  if (loc.parkingInfo) block.parkingInfo = loc.parkingInfo
  if (loc.mapsUrl) block.mapsUrl = loc.mapsUrl
  if (loc.onlineMeeting) block.onlineMeeting = loc.onlineMeeting
  if ((loc as { privateResidence?: boolean }).privateResidence) block.privateResidence = true
  return block
}

const FUNERAL_LOCATION_LABELS: Record<keyof FuneralLocations, string> = {
  service: 'Service',
  viewing: 'Visitation',
  visitation: 'Visitation',
  burial: 'Burial',
  graveside: 'Graveside',
}

function funeralLocationsToBlocks(locations: FuneralLocations): LocationBlock[] {
  const out: LocationBlock[] = []
  for (const key of Object.keys(locations) as Array<keyof FuneralLocations>) {
    const block = locationInfoToBlock(locations[key], FUNERAL_LOCATION_LABELS[key])
    if (block) out.push(block)
  }
  return out
}

// ── time mapping ───────────────────────────────────────────────────────────

function scheduleItemToTimeBlock(item: ScheduleItem, tz?: string): TimeBlock {
  const block: TimeBlock = { id: bid('time'), kind: 'time' }
  const label = item.title || item.activity
  if (label) block.label = label
  const startsAt = toIso(item.startTime)
  if (startsAt) block.startsAt = startsAt
  const endsAt = item.endTime ? toIso(item.endTime) : undefined
  if (endsAt) block.endsAt = endsAt
  if (!startsAt && item.time) block.display = item.time
  if (tz) block.timezone = tz
  return block
}

function registrationToBlock(reg: RegistrationInfo | undefined): RegistrationBlock | undefined {
  if (!reg) return undefined
  const block: RegistrationBlock = { id: bid('reg'), kind: 'registration' }
  if (reg.required !== undefined) block.required = reg.required === true || reg.required === 'true'
  const deadline = toIso(reg.deadline)
  if (deadline) block.deadline = deadline
  if (reg.registrationUrl) block.registrationUrl = reg.registrationUrl
  if (reg.contactEmail) block.contactEmail = reg.contactEmail
  if (reg.contactPhone) block.contactPhone = reg.contactPhone
  if (reg.hasFee !== undefined) block.hasFee = reg.hasFee
  if (reg.fee !== undefined) block.fee = typeof reg.fee === 'string' ? Number(reg.fee) : reg.fee
  if (reg.paymentInstructions) block.paymentInstructions = reg.paymentInstructions
  if (reg.notes) block.notes = reg.notes
  return block
}

// ── Event → Post ───────────────────────────────────────────────────────────

/** The best "start" date for an event, across the type-specific date fields. */
function eventStartDate(event: Event): string | undefined {
  return toIso(
    event.startDate ??
      event.baptismDate ??
      event.serviceDate ??
      event.ceremonyDate ??
      event.engagementDate ??
      event.dateRange?.start
  )
}

function eventToPost(event: Event): Post {
  const occasion: OccasionTag[] = [EVENT_TYPE_TO_OCCASION[event.type] ?? 'general']
  const piiBearing = isPiiBearing(occasion)
  const memberFloor: Visibility | undefined = piiBearing ? 'members' : undefined

  const blocks: Block[] = []

  // ── People (name / bio class) ──
  if (event.candidate) {
    const person: PersonBlock['people'][number] = {
      firstName: event.candidate.firstName,
      lastName: event.candidate.lastName,
    }
    const bio = joinBio(
      event.aboutCandidate,
      event.candidate.testimony,
      event.candidate.baptismStatement
    )
    if (bio) person.bio = bio
    blocks.push({ id: bid('person'), kind: 'person', role: 'candidate', people: [person] })
  }
  if (event.deceased) {
    const person: PersonBlock['people'][number] = {
      firstName: event.deceased.firstName,
      lastName: event.deceased.lastName,
    }
    if (event.deceased.title) person.title = event.deceased.title
    if (typeof event.deceased.age === 'number') person.age = event.deceased.age
    const bio = joinBio(event.aboutDeceased, event.deceased.obituary)
    if (bio) person.bio = bio
    blocks.push({ id: bid('person'), kind: 'person', role: 'deceased', people: [person] })
  }
  if (event.couple) {
    blocks.push({
      id: bid('person'),
      kind: 'person',
      role: 'bride',
      people: [{ firstName: event.couple.bride.firstName, lastName: event.couple.bride.lastName }],
    })
    blocks.push({
      id: bid('person'),
      kind: 'person',
      role: 'groom',
      people: [{ firstName: event.couple.groom.firstName, lastName: event.couple.groom.lastName }],
    })
  }
  if (event.sponsors?.length) {
    blocks.push({
      id: bid('person'),
      kind: 'person',
      role: 'sponsor',
      people: event.sponsors.map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        ...(s.role ? { label: s.role } : {}),
      })),
    })
  }
  if (event.speakers?.length) {
    blocks.push({
      id: bid('person'),
      kind: 'person',
      role: 'speaker',
      people: event.speakers.map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        ...(s.title ? { title: s.title } : {}),
        ...(s.ecclesia ? { ecclesia: s.ecclesia } : {}),
      })),
    })
  }
  if (event.weddingParty?.length) {
    blocks.push({
      id: bid('person'),
      kind: 'person',
      role: 'other',
      people: event.weddingParty.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        ...(m.role ? { label: m.role } : {}),
      })),
    })
  }

  // Engagement free-text names → members-only text block (can't structure a
  // free-form "Brother Gord Easson" string safely).
  const engagementText = joinBio(
    event.engagementProposed && event.engagementTo
      ? `${event.engagementProposed} & ${event.engagementTo}`
      : event.engagementProposed || event.engagementTo,
    event.engagementAnnouncement
  )
  if (engagementText) {
    blocks.push({
      id: bid('text'),
      kind: 'text',
      body: engagementText,
      containsPii: true,
      visibility: 'members',
    })
  }

  // ── Locations (location-precise class) ──
  const locBlock = locationInfoToBlock(event.location)
  if (locBlock) blocks.push(locBlock)
  const ceremony = locationInfoToBlock(event.ceremonyLocation, 'Ceremony')
  if (ceremony) blocks.push(ceremony)
  if (event.reception?.location) {
    const rec = locationInfoToBlock(event.reception.location, 'Reception')
    if (rec) blocks.push(rec)
  }
  if (event.locations) {
    if (Array.isArray(event.locations)) {
      for (const l of event.locations) {
        const b = locationInfoToBlock(l)
        if (b) blocks.push(b)
      }
    } else {
      blocks.push(...funeralLocationsToBlocks(event.locations))
    }
  }
  if (event.sections?.length) {
    for (const s of event.sections) {
      const b = locationInfoToBlock(s.location, s.title)
      if (b) blocks.push(b)
    }
  }

  // ── Times ──
  const start = eventStartDate(event)
  if (start) {
    blocks.push({
      id: bid('time'),
      kind: 'time',
      label: event.title,
      startsAt: start,
      ...(event.eventTimezone ? { timezone: event.eventTimezone } : {}),
      ...(toIso(event.endDate) ? { endsAt: toIso(event.endDate) } : {}),
    })
  }
  if (event.schedule?.length) {
    for (const item of event.schedule) blocks.push(scheduleItemToTimeBlock(item, event.eventTimezone))
  }

  // ── Free text (theme / description) — members-only under PII occasions ──
  const textBody = joinBio(event.theme, event.description)
  if (textBody) {
    const tb: TextBlock = { id: bid('text'), kind: 'text', body: textBody, containsPii: piiBearing }
    if (memberFloor) tb.visibility = memberFloor
    blocks.push(tb)
  }

  // ── Flyers (unredactable pixels) — members-only under PII occasions ──
  for (const doc of event.documents ?? []) {
    const fb: FlyerBlock = { id: bid('flyer'), kind: 'flyer', document: doc }
    if (memberFloor) fb.visibility = memberFloor
    blocks.push(fb)
  }

  // ── Registration (contact class) ──
  const reg = registrationToBlock(event.registration)
  if (reg) blocks.push(reg)

  return {
    id: event.id,
    tenant: event.ownerEcclesia || event.hostingEcclesia?.name || '',
    authorId: event.createdBy,
    title: event.title,
    occasion,
    visibility: event.membersOnly ? 'members' : 'public',
    sharingScope: event.sharingScope ?? 'own',
    lifecycle: {
      publishDate: toIso(event.publishDate),
      startsAt: start,
      endsAt: toIso(event.endDate),
    },
    blocks,
    createdAt: toIso(event.createdAt) ?? '',
    updatedAt: toIso(event.updatedAt) ?? '',
    status: 'ready',
  }
}

// ── NewsItem → Post ──────────────────────────────────────────────────────────

function newsToPost(item: NewsItem): Post {
  const occasion: OccasionTag[] =
    item.category && item.category !== 'general'
      ? ['news', item.category]
      : ['news']
  const piiBearing = isPiiBearing(occasion) // true for 'medical'
  const memberFloor: Visibility | undefined = piiBearing ? 'members' : undefined

  const blocks: Block[] = []
  if (item.body) {
    const tb: TextBlock = { id: bid('text'), kind: 'text', body: item.body, containsPii: piiBearing }
    if (memberFloor) tb.visibility = memberFloor
    blocks.push(tb)
  }
  for (const doc of item.documents ?? []) {
    const fb: FlyerBlock = { id: bid('flyer'), kind: 'flyer', document: doc }
    if (memberFloor) fb.visibility = memberFloor
    blocks.push(fb)
  }

  return {
    id: item.id,
    tenant: item.ecclesiaId,
    authorId: item.authorId,
    title: item.title,
    occasion,
    visibility: 'public',
    sharingScope: item.sharingScope,
    lifecycle: {
      publishDate: toIso(item.publishedAt),
      expiresAt: toIso(item.expiresAt),
    },
    blocks,
    createdAt: toIso(item.createdAt) ?? '',
    updatedAt: toIso(item.updatedAt) ?? '',
    status: 'ready',
  }
}

/** True when the input is a legacy Event (vs a NewsItem). */
function isLegacyEvent(input: Event | NewsItem): input is Event {
  return (input as Event).type !== undefined && (input as NewsItem).ecclesiaId === undefined
}

/**
 * Adapt a legacy flat record (Event OR NewsItem) into a unified {@link Post}
 * with PII-classed blocks. The bridge that lets `redactPost` scrub today's data
 * with no storage migration (design §7, Phase 0).
 */
export function legacyToPost(input: Event | NewsItem): Post {
  return isLegacyEvent(input) ? eventToPost(input) : newsToPost(input)
}
