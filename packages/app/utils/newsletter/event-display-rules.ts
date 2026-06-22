import type { DisplayDuration } from '@my/app/types/newsletter-rules'
import type { Event } from '@my/app/types/events'
import { EventDurationCalculator } from './event-duration'

/**
 * Shared event display-duration rules.
 *
 * These determine how long an event remains visible after it is published.
 * They are the single source of truth for both the newsletter (web + email)
 * and the public Events listing, so the two surfaces can never disagree about
 * whether an event is still current (e.g. an engagement that expired weeks ago
 * should not linger on the Events page after it has dropped off the newsletter).
 */
export type EventDisplayRule = {
  displayDuration: DisplayDuration
  priority: number
  includeInSummary: boolean
  requiresCTA: boolean
}

export const EVENT_DURATION_RULES: Record<string, EventDisplayRule> = {
  'recurring': {
    displayDuration: 'until_event_date',
    priority: 1,
    includeInSummary: true,
    requiresCTA: false,
  },
  'funeral': {
    displayDuration: '2_weeks_then_thursday_before',
    priority: 2,
    includeInSummary: true,
    requiresCTA: false,
  },
  'engagement': {
    displayDuration: '3_weeks_from_publish',
    priority: 3,
    includeInSummary: true,
    requiresCTA: false,
  },
  'wedding': {
    displayDuration: '3_weeks_or_until_event_date',
    priority: 4,
    includeInSummary: true,
    requiresCTA: false,
  },
  'baptism': {
    displayDuration: '1_week_after_event',
    priority: 5,
    includeInSummary: true,
    requiresCTA: false,
  },
  'study-weekend': {
    displayDuration: 'until_event_date',
    priority: 6,
    includeInSummary: true,
    requiresCTA: true,
  },
  'general': {
    displayDuration: 'until_event_date',
    priority: 7,
    includeInSummary: true,
    requiresCTA: false,
  },
  'election-cycle': {
    displayDuration: 'until_event_date',
    priority: 8,
    includeInSummary: false, // Election cycle triggers a message, not shown as an event
    requiresCTA: false,
  },
}

/**
 * Decide whether an event should currently be displayed, applying its
 * display-duration rule. Events with no matching rule are included by default
 * (matching prior behaviour). `currentDate` defaults to now.
 */
export function shouldDisplayEvent(event: Event, currentDate: Date = new Date()): boolean {
  const rule = EVENT_DURATION_RULES[event.type]
  if (!rule) return true

  const result = EventDurationCalculator.shouldIncludeEvent({
    event,
    rule,
    currentDate,
    firstIncludedDate: (event as any).newsletter?.firstIncludedDate
      ? new Date((event as any).newsletter.firstIncludedDate)
      : undefined,
  })

  return result.shouldInclude
}
