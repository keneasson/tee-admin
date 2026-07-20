/**
 * Server-side PII redaction for the legacy `Event` shape (Phase 0 of the unified
 * post model — see docs/UNIFIED_POST_MODEL_DESIGN.md). Maps each PII-bearing field
 * to a PiiClass and shapes it for the (viewer, channel):
 *   - name            → first-name-only for anon (never carries lastName)
 *   - bio / free-text → dropped for anon (obituary, testimony, about*, engagement blurb)
 *   - location-precise→ venue + city/province only for anon (drop street/postal/geo);
 *                       private residence dropped whole
 *   - contact         → dropped for anon (registration email/phone, contact person)
 *
 * Reveal tier (full PII) = verified member+ OR the curated `newsletter-email`
 * channel. Sanitation happens HERE, before serialization — a redacted event
 * literally cannot carry a surname / street address (no ship-then-hide leak).
 */
import type { Event, LocationInfo, FuneralLocations } from '../types/events'
import { canRevealPii, revealBio, type Viewer, type Channel } from './viewer-pii'

type Person = { firstName: string; lastName?: string; [k: string]: unknown }

/** Strip lastName unless the viewer/channel may see it. Preserves other fields (role, ecclesia). */
function redactPerson<T extends Person>(p: T, reveal: boolean): T {
  if (reveal) return p
  const { lastName, ...rest } = p
  // Some records denormalize `ecclesia` as an object that can carry a full street
  // address; keep only the venue floor (name/city/province/country).
  const ec = (rest as Record<string, unknown>).ecclesia
  if (ec && typeof ec === 'object') {
    const e = ec as Record<string, unknown>
    const floor: Record<string, unknown> = {}
    if (e.name) floor.name = e.name
    if (e.city) floor.city = e.city
    if (e.province) floor.province = e.province
    if (e.country) floor.country = e.country
    ;(rest as Record<string, unknown>).ecclesia = floor
  }
  return rest as unknown as T
}

function redactPeople<T extends Person>(people: T[] | undefined, reveal: boolean): T[] | undefined {
  if (!people) return people
  return people.map((p) => redactPerson(p, reveal))
}

/**
 * Anon location floor: venue name(s) + city/province/country + mode + online
 * meeting; drop street/postal/geo/maps/directions. A private residence is dropped
 * whole. Returns a NEW object carrying only the safe fields.
 */
function redactLocationInfo(loc: LocationInfo | undefined, reveal: boolean): LocationInfo | undefined {
  if (!loc) return undefined
  if (reveal) return loc
  if ((loc as { privateResidence?: boolean }).privateResidence) return undefined
  const safe: LocationInfo = {}
  if (loc.mode) safe.mode = loc.mode
  if (loc.name) safe.name = loc.name
  if (loc.placeName) safe.placeName = loc.placeName
  if (loc.city) safe.city = loc.city
  if (loc.province) safe.province = loc.province
  if (loc.country) safe.country = loc.country
  if (loc.onlineMeeting) safe.onlineMeeting = loc.onlineMeeting
  return safe
}

function redactLocations(
  locations: FuneralLocations | LocationInfo[] | undefined,
  reveal: boolean
): FuneralLocations | LocationInfo[] | undefined {
  if (!locations) return locations
  if (reveal) return locations
  if (Array.isArray(locations)) {
    return locations.map((l) => redactLocationInfo(l, reveal)).filter(Boolean) as LocationInfo[]
  }
  const out: FuneralLocations = {}
  for (const [key, val] of Object.entries(locations)) {
    const r = redactLocationInfo(val as LocationInfo, reveal)
    if (r) (out as Record<string, LocationInfo>)[key] = r
  }
  return out
}

/**
 * Redact a single event for the given viewer + channel. Returns a shallow-rebuilt
 * event; when `reveal` is true (member+ or newsletter-email) it is returned
 * unchanged.
 */
export function redactEventForViewer(
  event: Event,
  viewer: Viewer,
  channel: Channel = 'public-web'
): Event {
  const reveal = canRevealPii(viewer, channel)
  if (reveal) return event

  const e = event as Event & Record<string, unknown>
  const out: Event = { ...event }
  const o = out as Event & Record<string, unknown>

  // --- name-class (structured) ---
  if (e.speakers) out.speakers = redactPeople(e.speakers as Person[], reveal) as Event['speakers']
  if (e.weddingParty) out.weddingParty = redactPeople(e.weddingParty as Person[], reveal) as Event['weddingParty']
  if (e.sponsors) out.sponsors = redactPeople(e.sponsors as Person[], reveal) as Event['sponsors']
  if (e.couple) {
    const c = e.couple as { bride: Person; groom: Person }
    out.couple = { bride: redactPerson(c.bride, reveal), groom: redactPerson(c.groom, reveal) } as Event['couple']
  }
  if (e.candidate) {
    // name shaped; testimony/baptismStatement are bio → dropped for anon
    const c = redactPerson(e.candidate as Person, reveal) as Record<string, unknown>
    delete c.testimony
    delete c.baptismStatement
    out.candidate = c as Event['candidate']
  }
  if (e.deceased) {
    const d = redactPerson(e.deceased as Person, reveal) as Record<string, unknown>
    delete d.obituary // bio
    out.deceased = d as Event['deceased']
  }

  // --- bio / free-text (dropped for anon; members-only per design §8.3) ---
  delete o.aboutCandidate
  delete o.aboutDeceased
  delete o.engagementProposed
  delete o.engagementTo
  delete o.engagementAnnouncement
  // personal photos are visual PII
  delete o.candidatePhoto
  delete o.deceasedPhoto

  // --- location-class ---
  if (e.location) out.location = redactLocationInfo(e.location as LocationInfo, reveal)
  if (e.ceremonyLocation) out.ceremonyLocation = redactLocationInfo(e.ceremonyLocation as LocationInfo, reveal)
  if (e.locations) out.locations = redactLocations(e.locations as FuneralLocations | LocationInfo[], reveal)
  if (e.reception) {
    const r = e.reception as { location?: LocationInfo }
    out.reception = { ...r, location: redactLocationInfo(r.location, reveal) } as Event['reception']
  }
  if (e.sections) {
    out.sections = (e.sections as Array<{ location?: LocationInfo }>).map((s) => ({
      ...s,
      location: redactLocationInfo(s.location, reveal),
    })) as Event['sections']
  }

  // --- contact-class ---
  if (e.registration) {
    const r = { ...(e.registration as Record<string, unknown>) }
    delete r.contactEmail
    delete r.contactPhone
    out.registration = r as Event['registration']
  }

  return out
}

/** Redact a list of events. */
export function redactEventsForViewer(
  events: Event[],
  viewer: Viewer,
  channel: Channel = 'public-web'
): Event[] {
  return events.map((e) => redactEventForViewer(e, viewer, channel))
}
