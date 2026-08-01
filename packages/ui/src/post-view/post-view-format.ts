/**
 * Pure formatting helpers for {@link PostView} (Consolidated CMS epic #131,
 * Phase 3 — the read-only display twin of the editor).
 *
 * Kept in a SEPARATE, platform-free module (no `tamagui`, no
 * `@tamagui/lucide-icons`) so the display logic is unit-testable in the
 * project's plain-Node Vitest environment — importing the full `PostView`
 * (which pulls in Tamagui + Lucide) hangs there, the same test-infra wall the
 * Phase 2b block tests document. PostView renders; THIS decides what strings it
 * renders.
 *
 * Cross-platform: pure functions + the pure `timezone` utils only.
 */

import type {
  BlockPerson,
  LocationBlock,
  PersonBlock,
  Post,
  TimeBlock,
} from '@my/app/types/post'
import { formatScheduleDateTime, DEFAULT_TIMEZONE } from '@my/app/utils/timezone'

/** Human-readable label for a PersonBlock role (design vocabulary → display). */
const ROLE_LABELS: Record<PersonBlock['role'], string> = {
  speaker: 'Speaker',
  candidate: 'Candidate',
  deceased: 'In memory of',
  bride: 'Bride',
  groom: 'Groom',
  sponsor: 'Sponsor',
  contact: 'Contact',
  other: 'People',
}

export function personRoleLabel(role: PersonBlock['role']): string {
  return ROLE_LABELS[role] ?? 'People'
}

/**
 * The display name for an already-REDACTED person. `firstName` is the floor
 * (always present); `lastName` is present only when the redactor revealed it.
 * An optional honorific `title` (Brother/Sister/…) prefixes the name.
 */
export function formatPersonName(person: BlockPerson): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ')
  return person.title ? `${person.title} ${name}`.trim() : name
}

/**
 * A secondary "meta" line for a person — sub-role label, ecclesia, age — joined
 * with middots. Empty string when there's nothing to show. `contact`/`bio` are
 * rendered separately (they may be long / need their own affordance).
 */
export function personMetaLine(person: BlockPerson): string {
  const parts: string[] = []
  if (person.label) parts.push(person.label)
  if (person.ecclesia) parts.push(person.ecclesia)
  if (typeof person.age === 'number') parts.push(`age ${person.age}`)
  return parts.join(' · ')
}

/**
 * Address lines for a location block, in reading order. Only the fields present
 * on the (already-redacted) block are included — for an anon viewer the
 * redactor has already stripped `address`/`postalCode`, so this naturally
 * collapses to the venue + city floor.
 */
export function locationAddressLines(block: LocationBlock): string[] {
  const lines: string[] = []
  if (block.venueName) lines.push(block.venueName)
  if (block.address) lines.push(block.address)
  const cityLine = [block.city, block.province, block.postalCode]
    .filter(Boolean)
    .join(', ')
  if (cityLine) lines.push(cityLine)
  if (block.country) lines.push(block.country)
  return lines
}

/**
 * A "get directions" href for a location. Prefers an explicit `mapsUrl`; else,
 * when there's enough address to search, builds a Google Maps search URL from
 * the safe address parts. Returns undefined when there's nothing to link.
 */
export function locationMapsHref(block: LocationBlock): string | undefined {
  if (block.mapsUrl) return block.mapsUrl
  const query = [
    block.venueName,
    block.address,
    block.city,
    block.province,
    block.postalCode,
    block.country,
  ]
    .filter(Boolean)
    .join(', ')
  if (!query) return undefined
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export interface FormattedTime {
  /** Optional author label (e.g. 'Service', 'Reception'). */
  label?: string
  /** e.g. 'Sunday, February 1, 2026' — empty when no date is known. */
  dateLine: string
  /** e.g. '7:00pm (Toronto time)' — empty for date-only or free-text. */
  timeLine: string
}

/**
 * Format a TimeBlock for display. Uses the shared `formatScheduleDateTime` (the
 * codebase's one date/time formatter) when there's an ISO `startsAt`, falling
 * back to the free-text `display` field. End time, when present, is appended.
 */
export function formatTimeBlock(block: TimeBlock): FormattedTime {
  const timezone = block.timezone || DEFAULT_TIMEZONE

  if (block.startsAt) {
    const start = formatScheduleDateTime({
      dateTime: block.startsAt,
      eventTimezone: timezone,
      userTimezone: timezone,
    })
    let timeLine = start.timeDisplay
    if (block.endsAt) {
      const end = formatScheduleDateTime({
        dateTime: block.endsAt,
        eventTimezone: timezone,
        userTimezone: timezone,
      })
      if (end.timeDisplay) timeLine = `${timeLine} – ${end.timeDisplay}`
    }
    return { label: block.label || undefined, dateLine: start.dateDisplay, timeLine }
  }

  // No ISO instant — fall back to free-text time.
  return {
    label: block.label || undefined,
    dateLine: '',
    timeLine: block.display ?? '',
  }
}

/**
 * The header "date facet" — the single most salient date for the post. A future
 * `lifecycle.startsAt` makes a post event-shaped (show the event date); else the
 * publish date is the news-shaped facet. Returns undefined when neither exists.
 */
export function formatDateFacet(post: Post): string | undefined {
  const iso = post.lifecycle.startsAt
  if (iso) {
    return formatScheduleDateTime({
      dateTime: iso,
      eventTimezone: DEFAULT_TIMEZONE,
      userTimezone: DEFAULT_TIMEZONE,
    }).fullDisplay
  }
  const publish = post.lifecycle.publishDate
  if (publish) {
    return formatScheduleDateTime({ date: publish }).dateDisplay
  }
  return undefined
}

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|svg|avif)$/i

/** True when a flyer document should render as an inline image (vs a file link). */
export function looksLikeImage(url: string, mimeType?: string): boolean {
  if (mimeType && mimeType.startsWith('image/')) return true
  return IMAGE_EXTENSION.test(url)
}

/** Occasion tags rendered as a title-cased, middot-joined string for the header. */
export function formatOccasions(occasion: Post['occasion']): string {
  return occasion
    .map((tag) => tag.replace(/-/g, ' '))
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
    .join(' · ')
}
