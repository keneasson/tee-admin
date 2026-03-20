/**
 * Cross-ecclesia event sharing resolution.
 *
 * Determines which events an ecclesia should see based on:
 * 1. Own events — always included
 * 2. Subscribed ecclesias' events — always included
 * 3. Nearby ecclesias' events — filtered by configured radius + sharing prefs
 * 4. Global events — always included regardless of distance
 *
 * Nearby lists are pre-computed at 1000km (max radius). Each ecclesia's
 * configured sharingRadiusKm (default 300km) filters at query time.
 */

import type { Event, EventType, EventSharingScope } from '@my/app/types/events'
import { isEventActive } from '@my/app/types/events'
import { haversineDistance, DEFAULT_SHARING_RADIUS_KM } from '@my/app/utils/geo'

/** Minimal ecclesia data needed for sharing resolution */
export interface SharingEcclesiaData {
  name: string
  latitude?: number
  longitude?: number
  country?: string
  sharingPreference?: 'open' | 'subscribers-only' | 'private'
  sharingRadiusKm?: number
  excludedEcclesias?: string[]
  nearbyEcclesias?: string[]
}

/** Default sharing scope per event type (when sharingScope is not set on the event) */
const DEFAULT_SHARING_SCOPE: Record<EventType, EventSharingScope> = {
  'recurring': 'own',          // memorial, bible class, sunday school — own ecclesia only
  'general': 'own',            // general events default to own
  'election-cycle': 'own',     // internal governance
  'baptism': 'region',         // regional interest
  'funeral': 'region',         // regional interest
  'wedding': 'region',         // regional interest
  'engagement': 'region',      // regional interest
  'study-weekend': 'global',   // major gatherings, advertised widely
}

/** Resolve the effective sharing scope for an event */
export function getEffectiveSharingScope(event: Event): EventSharingScope {
  if (event.sharingScope) return event.sharingScope
  return DEFAULT_SHARING_SCOPE[event.type] || 'own'
}

/** Get the hosting ecclesia name from an event */
function getEventEcclesiaName(event: Event): string | null {
  if (typeof event.hostingEcclesia === 'string') return event.hostingEcclesia
  return event.hostingEcclesia?.name || null
}

/**
 * Check if ecclesia A is allowed to receive events from ecclesia B,
 * based on sharing preferences and exclusion lists.
 */
function canReceiveEventsFrom(
  receiver: SharingEcclesiaData,
  sender: SharingEcclesiaData
): boolean {
  // Sender has opted out of sharing entirely
  if (sender.sharingPreference === 'private') return false

  // Sender has blocked this receiver
  if (sender.excludedEcclesias?.includes(receiver.name)) return false

  // Receiver has blocked this sender
  if (receiver.excludedEcclesias?.includes(sender.name)) return false

  return true
}

/**
 * Check if a sender ecclesia is within the receiver's configured sharing radius.
 * Returns true if either ecclesia lacks coordinates (fail open — let other checks handle it).
 */
function isWithinConfiguredRadius(
  receiver: SharingEcclesiaData,
  sender: SharingEcclesiaData
): boolean {
  if (!receiver.latitude || !receiver.longitude) return true
  if (!sender.latitude || !sender.longitude) return true

  // Same-country check
  if (receiver.country && sender.country && receiver.country !== sender.country) return false

  const radius = receiver.sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM
  const distance = haversineDistance(
    receiver.latitude, receiver.longitude,
    sender.latitude, sender.longitude
  )
  return distance <= radius
}

export interface EventSharingInput {
  /** The ecclesia requesting events */
  ecclesia: SharingEcclesiaData
  /** Names of ecclesias this ecclesia explicitly subscribes to */
  subscribedEcclesias: string[]
  /** All ecclesias (needed for looking up sender sharing preferences + coordinates) */
  allEcclesias: SharingEcclesiaData[]
  /** All candidate events (already filtered to active + date range) */
  events: Event[]
}

export interface ResolvedEventFeed {
  /** Events from own ecclesia */
  ownEvents: Event[]
  /** Events from subscribed ecclesias */
  subscribedEvents: Event[]
  /** Events from nearby ecclesias (auto-shared based on proximity) */
  nearbyEvents: Event[]
  /** Global events from any ecclesia */
  globalEvents: Event[]
  /** All events combined, deduplicated, sorted by date */
  allEvents: Event[]
}

/**
 * Resolve which events an ecclesia should see.
 *
 * Algorithm:
 * 1. Own ecclesia events → always included
 * 2. Subscribed ecclesias' events → included (any scope except 'own')
 * 3. Nearby ecclesias' events → included if scope is 'region' or 'global',
 *    sender is 'open', within configured radius, and no exclusions
 * 4. Global events → included from any ecclesia (respects private + exclusions)
 * 5. membersOnly events from other ecclesias are filtered out
 * 6. Deduplicate and sort
 */
export function resolveEventFeed(input: EventSharingInput): ResolvedEventFeed {
  const { ecclesia, subscribedEcclesias, allEcclesias, events } = input

  // Build lookup map for ecclesia data
  const ecclesiaMap = new Map<string, SharingEcclesiaData>()
  for (const e of allEcclesias) {
    ecclesiaMap.set(e.name, e)
  }

  // Pre-computed nearby list (at 1000km max). We filter by configured radius below.
  const nearbySet = new Set(ecclesia.nearbyEcclesias || [])
  const subscribedSet = new Set(subscribedEcclesias)

  // Track event IDs to deduplicate
  const seen = new Set<string>()

  const ownEvents: Event[] = []
  const subscribedEvents: Event[] = []
  const nearbyEvents: Event[] = []
  const globalEvents: Event[] = []

  for (const event of events) {
    if (!isEventActive(event)) continue
    if (!event.id || seen.has(event.id)) continue

    const eventEcclesia = getEventEcclesiaName(event)
    const scope = getEffectiveSharingScope(event)
    const isMembersOnly = event.membersOnly === true

    // 1. Own ecclesia — always included
    if (!eventEcclesia || eventEcclesia === ecclesia.name) {
      ownEvents.push(event)
      seen.add(event.id)
      continue
    }

    // Skip membersOnly events from other ecclesias
    if (isMembersOnly) continue

    // 2. Subscribed ecclesias — included if scope is not 'own'
    if (subscribedSet.has(eventEcclesia) && scope !== 'own') {
      subscribedEvents.push(event)
      seen.add(event.id)
      continue
    }

    // 3. Nearby ecclesias — in pre-computed list, within configured radius,
    //    scope is 'region' or 'global', sender is 'open', no exclusions
    if (nearbySet.has(eventEcclesia) && (scope === 'region' || scope === 'global')) {
      const sender = ecclesiaMap.get(eventEcclesia)
      if (
        sender &&
        sender.sharingPreference !== 'subscribers-only' &&
        canReceiveEventsFrom(ecclesia, sender) &&
        isWithinConfiguredRadius(ecclesia, sender)
      ) {
        nearbyEvents.push(event)
        seen.add(event.id)
        continue
      }
    }

    // 4. Global events — included from any ecclesia
    if (scope === 'global') {
      const sender = ecclesiaMap.get(eventEcclesia)
      // For global events, still respect 'private' and exclusion lists
      if (!sender || canReceiveEventsFrom(ecclesia, sender)) {
        globalEvents.push(event)
        seen.add(event.id)
        continue
      }
    }
  }

  // Combine and sort all events by date (ascending)
  const allResolved = [...ownEvents, ...subscribedEvents, ...nearbyEvents, ...globalEvents]
  allResolved.sort((a, b) => {
    const dateA = getEventSortDate(a)
    const dateB = getEventSortDate(b)
    return dateA - dateB
  })

  return {
    ownEvents,
    subscribedEvents,
    nearbyEvents,
    globalEvents,
    allEvents: allResolved,
  }
}

/** Extract a sortable timestamp from an event */
function getEventSortDate(event: Event): number {
  const raw =
    event.startDate ||
    event.dateRange?.start ||
    event.ceremonyDate ||
    event.baptismDate ||
    event.serviceDate ||
    event.electionStartDate
  if (raw) {
    const ts = new Date(raw).getTime()
    if (!isNaN(ts)) return ts
  }
  return Date.now()
}

