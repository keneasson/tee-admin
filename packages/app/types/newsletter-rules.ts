/**
 * Newsletter Rules Types
 * Types for event duration calculations in the newsletter system
 */

export type DisplayDuration =
  | 'until_event_date'
  | '1_week_after_event'
  | '2_weeks_after_event'
  | '3_weeks_after_event'
  | '3_weeks_from_publish'
  | '3_weeks_from_first_inclusion'
  | '3_weeks_or_until_event_date'
  | '2_weeks_then_thursday_before'
  | 'custom'

export interface EventTypeRule {
  displayDuration: DisplayDuration
  [key: string]: any
}

export interface DurationCalculationResult {
  shouldInclude: boolean
  displayUntilDate?: Date
  reason: string
}

export interface EventDurationContext {
  event: any
  rule: EventTypeRule
  currentDate: Date
  firstIncludedDate?: Date
}
