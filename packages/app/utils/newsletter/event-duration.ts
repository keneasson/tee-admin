import { DisplayDuration, EventTypeRule, DurationCalculationResult, EventDurationContext } from '@my/app/types/newsletter-rules'
import { getThursdayBefore, isSameDay, isUserDateOnOrBefore } from './date-helpers'

/**
 * Event Duration Calculator
 * Determines if an event should be included in newsletter based on duration rules
 */
export class EventDurationCalculator {
  
  /**
   * Calculate if an event should be included based on its duration rule
   */
  static shouldIncludeEvent(context: EventDurationContext): DurationCalculationResult {
    const { event, rule, currentDate, firstIncludedDate } = context
    
    switch (rule.displayDuration) {
      case 'until_event_date':
        return this.calculateUntilEventDate(event, currentDate)
      
      case '1_week_after_event':
        return this.calculateWeeksAfterEvent(event, currentDate, 1)
      
      case '2_weeks_after_event':
        return this.calculateWeeksAfterEvent(event, currentDate, 2)
      
      case '3_weeks_after_event':
        return this.calculateWeeksAfterEvent(event, currentDate, 3)

      case '3_weeks_from_publish':
        return this.calculateWeeksFromPublish(event, currentDate, 3)

      case '3_weeks_from_first_inclusion':
        return this.calculateWeeksFromFirstInclusion(firstIncludedDate, currentDate, 3)
      
      case '3_weeks_or_until_event_date':
        return this.calculateWeeksOrUntilEvent(event, currentDate, firstIncludedDate, 3)
      
      case '2_weeks_then_thursday_before':
        return this.calculateFuneralDuration(event, currentDate, firstIncludedDate)

      case 'custom':
        return this.calculateCustomDuration(event, currentDate)

      default:
        return {
          shouldInclude: false,
          reason: `Unknown display duration: ${rule.displayDuration}`
        }
    }
  }

  /**
   * Include until the event date (inclusive - shows for the entire day in user's timezone)
   * Used for: study-weekend, general events, fraternals, bible-school
   * Recurring events are handled specially - they show as long as the series is active
   */
  private static calculateUntilEventDate(event: any, currentDate: Date): DurationCalculationResult {
    // Recurring events (Bible Class, Memorial, Sunday School) are ongoing series.
    // recurringConfig.startDate is the SERIES start, not the next occurrence.
    // Show as long as the series hasn't ended.
    if (event.type === 'recurring' && event.recurringConfig) {
      return this.calculateRecurringSeries(event, currentDate)
    }

    const eventDate = this.getEventDate(event)

    if (!eventDate) {
      return {
        shouldInclude: true,
        reason: 'No event date specified - including by default'
      }
    }

    // For multi-day events, use the end date so the event remains visible
    // through its last day (e.g., a Friday-Sunday fraternal gathering stays
    // visible on Saturday when the recap email is sent)
    const endDate = this.getEventEndDate(event)
    const displayUntilDate = endDate || eventDate

    // Timezone-aware date comparison:
    // - currentDate uses user's local timezone (browser's new Date())
    // - eventDate uses UTC (stored as midnight UTC from "YYYY-MM-DD" strings)
    // This ensures events show until midnight in the user's timezone
    const shouldInclude = this.isUserDateOnOrBefore(currentDate, displayUntilDate)

    return {
      shouldInclude,
      displayUntilDate,
      reason: shouldInclude
        ? `Event is scheduled for ${eventDate.toDateString()}${endDate ? ` - ${endDate.toDateString()}` : ''}`
        : `Event date ${eventDate.toDateString()}${endDate ? ` - ${endDate.toDateString()}` : ''} has passed`
    }
  }

  /**
   * Recurring events (Bible Class, Memorial, Sunday School) are ongoing series.
   * They show continuously as long as the series is active (endDate not passed).
   */
  private static calculateRecurringSeries(event: any, currentDate: Date): DurationCalculationResult {
    const endDate = event.recurringConfig.endDate
      ? (event.recurringConfig.endDate instanceof Date
          ? event.recurringConfig.endDate
          : new Date(event.recurringConfig.endDate))
      : null

    if (endDate && !this.isUserDateOnOrBefore(currentDate, endDate)) {
      return {
        shouldInclude: false,
        displayUntilDate: endDate,
        reason: `Recurring series ended on ${endDate.toDateString()}`
      }
    }

    return {
      shouldInclude: true,
      displayUntilDate: endDate || undefined,
      reason: endDate
        ? `Recurring event active until ${endDate.toDateString()}`
        : 'Recurring event with no end date - always active'
    }
  }

  /**
   * Include for X weeks after the event date
   * Used for: baptism (1 week), funeral (3 weeks)
   */
  private static calculateWeeksAfterEvent(event: any, currentDate: Date, weeks: number): DurationCalculationResult {
    const eventDate = this.getEventDate(event)
    
    if (!eventDate) {
      return {
        shouldInclude: true,
        reason: 'No event date specified - including by default'
      }
    }

    const cutoffDate = new Date(eventDate)
    cutoffDate.setDate(cutoffDate.getDate() + (weeks * 7))
    
    const shouldInclude = currentDate <= cutoffDate
    
    return {
      shouldInclude,
      displayUntilDate: cutoffDate,
      reason: shouldInclude
        ? `Event occurred on ${eventDate.toDateString()}, displaying for ${weeks} weeks until ${cutoffDate.toDateString()}`
        : `${weeks} week display period ended on ${cutoffDate.toDateString()}`
    }
  }

  /**
   * Include for X weeks from the publish/announcement date
   * Used for: engagement announcements (show 3 Thursdays from when announced)
   */
  private static calculateWeeksFromPublish(event: any, currentDate: Date, weeks: number): DurationCalculationResult {
    const publishDate = event.publishDate ? new Date(event.publishDate)
      : event.createdAt ? new Date(event.createdAt)
      : null

    if (!publishDate) {
      return {
        shouldInclude: true,
        reason: 'No publish date specified - including by default'
      }
    }

    const cutoffDate = new Date(publishDate)
    cutoffDate.setDate(cutoffDate.getDate() + (weeks * 7))

    const shouldInclude = currentDate <= cutoffDate

    return {
      shouldInclude,
      displayUntilDate: cutoffDate,
      reason: shouldInclude
        ? `Published on ${publishDate.toDateString()}, displaying for ${weeks} weeks until ${cutoffDate.toDateString()}`
        : `${weeks} week display period from publish date ended on ${cutoffDate.toDateString()}`
    }
  }

  /**
   * Include for X weeks from first inclusion
   * Used for: funeral announcements
   */
  private static calculateWeeksFromFirstInclusion(firstIncludedDate: Date | undefined, currentDate: Date, weeks: number): DurationCalculationResult {
    if (!firstIncludedDate) {
      // First time being included
      const cutoffDate = new Date(currentDate)
      cutoffDate.setDate(cutoffDate.getDate() + (weeks * 7))
      
      return {
        shouldInclude: true,
        displayUntilDate: cutoffDate,
        reason: `First inclusion - will display for ${weeks} weeks until ${cutoffDate.toDateString()}`
      }
    }

    const cutoffDate = new Date(firstIncludedDate)
    cutoffDate.setDate(cutoffDate.getDate() + (weeks * 7))
    
    const shouldInclude = currentDate <= cutoffDate
    
    return {
      shouldInclude,
      displayUntilDate: cutoffDate,
      reason: shouldInclude
        ? `First included on ${firstIncludedDate.toDateString()}, displaying for ${weeks} weeks until ${cutoffDate.toDateString()}`
        : `${weeks} week display period ended on ${cutoffDate.toDateString()}`
    }
  }

  /**
   * Include for X weeks from first inclusion OR until event date (whichever comes first)
   * Used for: wedding announcements
   */
  private static calculateWeeksOrUntilEvent(event: any, currentDate: Date, firstIncludedDate: Date | undefined, weeks: number): DurationCalculationResult {
    const eventDate = this.getEventDate(event)
    
    // Calculate weeks from first inclusion
    const weeksResult = this.calculateWeeksFromFirstInclusion(firstIncludedDate, currentDate, weeks)
    
    // Calculate until event date
    const eventResult = eventDate ? this.calculateUntilEventDate(event, currentDate) : null
    
    // Use the earlier cutoff date
    if (eventResult && eventDate) {
      const weeksUntilDate = weeksResult.displayUntilDate
      const eventUntilDate = eventDate
      
      if (weeksUntilDate && eventUntilDate <= weeksUntilDate) {
        // Event date comes first
        return {
          shouldInclude: eventResult.shouldInclude,
          displayUntilDate: eventUntilDate,
          reason: `Wedding is on ${eventDate.toDateString()} (before ${weeks}-week limit)`
        }
      }
    }
    
    // Weeks limit comes first (or no event date)
    return {
      shouldInclude: weeksResult.shouldInclude,
      displayUntilDate: weeksResult.displayUntilDate,
      reason: weeksResult.reason + (eventDate ? ` (wedding date: ${eventDate.toDateString()})` : '')
    }
  }

  /**
   * Custom duration based on event-specific settings
   */
  private static calculateCustomDuration(event: any, currentDate: Date): DurationCalculationResult {
    // Check if event has custom display end date
    if (event.newsletter?.customDisplayEndDate) {
      const customEndDate = new Date(event.newsletter.customDisplayEndDate)
      const shouldInclude = currentDate <= customEndDate
      
      return {
        shouldInclude,
        displayUntilDate: customEndDate,
        reason: shouldInclude
          ? `Custom display until ${customEndDate.toDateString()}`
          : `Custom display period ended on ${customEndDate.toDateString()}`
      }
    }

    // Check if event has display duration in weeks
    if (event.newsletter?.displayDuration && typeof event.newsletter.displayDuration === 'number') {
      const publishDate = event.publishDate ? new Date(event.publishDate) : currentDate
      const cutoffDate = new Date(publishDate)
      cutoffDate.setDate(cutoffDate.getDate() + (event.newsletter.displayDuration * 7))
      
      const shouldInclude = currentDate <= cutoffDate
      
      return {
        shouldInclude,
        displayUntilDate: cutoffDate,
        reason: shouldInclude
          ? `Custom ${event.newsletter.displayDuration} week display until ${cutoffDate.toDateString()}`
          : `Custom ${event.newsletter.displayDuration} week display period ended`
      }
    }

    // Default to including if no custom rules specified
    return {
      shouldInclude: true,
      reason: 'Custom duration with no specific rules - including by default'
    }
  }

  /**
   * Calculate funeral display duration
   * Rule: Show for 14 days from publishDate (guarantees 2 newsletters regardless of publish day),
   * then only show on Thursday before service (if service hasn't passed yet)
   * Used for: funeral announcements
   */
  private static calculateFuneralDuration(
    event: any,
    currentDate: Date,
    firstIncludedDate: Date | undefined
  ): DurationCalculationResult {
    const serviceDate = this.getEventDate(event)

    // Use publishDate as the start of the 2-newsletter window
    const publishDate = event.publishDate ? new Date(event.publishDate) : null

    // No publish date - include by default
    if (!publishDate) {
      return {
        shouldInclude: true,
        reason: 'No publish date - including by default'
      }
    }

    // Calculate cutoff: 14 days from publish date (guarantees 2 Thursday newsletters)
    const twoNewsletterCutoff = new Date(publishDate)
    twoNewsletterCutoff.setDate(twoNewsletterCutoff.getDate() + 14)

    // Within 2-newsletter window (14 days) - ALWAYS include, even if service has passed
    if (currentDate <= twoNewsletterCutoff) {
      return {
        shouldInclude: true,
        displayUntilDate: twoNewsletterCutoff,
        reason: `Within 2-newsletter window (until ${twoNewsletterCutoff.toDateString()})`
      }
    }

    // AFTER the 2-newsletter window - only show on Thursday before service

    // If service date has passed, exclude (window complete, no upcoming service to remind about)
    if (serviceDate && currentDate > serviceDate) {
      return {
        shouldInclude: false,
        reason: `2-newsletter window complete and service date ${serviceDate.toDateString()} has passed`
      }
    }

    // Check if this is the Thursday before service (final reminder for services scheduled far out)
    if (serviceDate) {
      const thursdayBefore = this.getThursdayBefore(serviceDate)
      const isThursdayBeforeService = this.isSameDay(currentDate, thursdayBefore)

      if (isThursdayBeforeService) {
        return {
          shouldInclude: true,
          displayUntilDate: serviceDate,
          reason: `Final reminder - Thursday before service (${serviceDate.toDateString()})`
        }
      }
    }

    // Outside 2-newsletter window, not Thursday before service, service still upcoming
    return {
      shouldInclude: false,
      reason: '2-newsletter window ended, waiting for Thursday before service'
    }
  }

  // Date helpers (getThursdayBefore / isSameDay / isUserDateOnOrBefore) now live
  // in ./date-helpers so the unified Post lifecycle engine reuses the identical
  // logic. Thin private wrappers keep the existing call sites unchanged.
  private static getThursdayBefore(date: Date): Date {
    return getThursdayBefore(date)
  }

  private static isSameDay(date1: Date, date2: Date): boolean {
    return isSameDay(date1, date2)
  }

  private static isUserDateOnOrBefore(currentDate: Date, eventDate: Date): boolean {
    return isUserDateOnOrBefore(currentDate, eventDate)
  }

  /**
   * Extract the primary event date from an event object
   */
  private static getEventDate(event: any): Date | null {
    // Try different date fields based on event type
    // Note: recurringConfig.startDate is NOT included here because it's the
    // SERIES start date, not the next occurrence. Recurring events are handled
    // by calculateRecurringSeries() instead.
    const dateFields = [
      'eventDate',
      'serviceDate',      // funeral
      'ceremonyDate',     // wedding
      'baptismDate',      // baptism
      'engagementDate',   // engagement - when the engagement occurred
      'startDate',        // general
      'dateRange.start',  // study-weekend
      'publishDate'       // fallback for events without specific dates
    ]

    for (const field of dateFields) {
      const value = this.getNestedProperty(event, field)
      if (value) {
        const date = value instanceof Date ? value : new Date(value)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }

    return null
  }

  /**
   * Extract the end date for multi-day events (e.g., fraternal gatherings, study weekends)
   */
  private static getEventEndDate(event: any): Date | null {
    const endFields = [
      'endDate',
      'dateRange.end',
    ]

    for (const field of endFields) {
      const value = this.getNestedProperty(event, field)
      if (value) {
        const date = value instanceof Date ? value : new Date(value)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }

    return null
  }

  /**
   * Get nested property value (e.g., 'dateRange.start')
   */
  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Calculate next newsletter dates for planning
   */
  static getNextNewsletterDates(currentDate: Date = new Date(), count: number = 4): Date[] {
    const dates: Date[] = []
    const nextThursday = this.getNextThursday(currentDate)
    
    for (let i = 0; i < count; i++) {
      const date = new Date(nextThursday)
      date.setDate(date.getDate() + (i * 7))
      dates.push(date)
    }
    
    return dates
  }

  /**
   * Get the next Thursday from a given date
   */
  private static getNextThursday(date: Date): Date {
    const result = new Date(date)
    const dayOfWeek = result.getDay()
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7 // 4 = Thursday
    result.setDate(result.getDate() + daysUntilThursday)
    return result
  }

  /**
   * Check if an event is "new" (first time being included)
   */
  static isNewEvent(event: any): boolean {
    return !event.newsletter?.firstIncludedDate
  }

  /**
   * Mark an event as included for the first time
   */
  static markEventAsIncluded(event: any, date: Date = new Date()): any {
    return {
      ...event,
      newsletter: {
        ...event.newsletter,
        firstIncludedDate: event.newsletter?.firstIncludedDate || date
      }
    }
  }

  /**
   * Get events that are expiring soon (within next week)
   */
  static getExpiringSoon(events: any[], rules: Record<string, EventTypeRule>, currentDate: Date = new Date()): any[] {
    const oneWeekFromNow = new Date(currentDate)
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)

    return events.filter(event => {
      const rule = rules[event.type]
      if (!rule) return false

      const context: EventDurationContext = {
        event,
        rule,
        currentDate,
        firstIncludedDate: event.newsletter?.firstIncludedDate
      }

      const result = this.shouldIncludeEvent(context)
      
      return result.shouldInclude && 
             result.displayUntilDate && 
             result.displayUntilDate <= oneWeekFromNow
    })
  }

  /**
   * Get summary of event duration calculations for debugging
   */
  static getDurationSummary(events: any[], rules: Record<string, EventTypeRule>, currentDate: Date = new Date()): Array<{
    eventTitle: string
    eventType: string
    shouldInclude: boolean
    reason: string
    displayUntilDate?: Date
  }> {
    return events.map(event => {
      const rule = rules[event.type]
      if (!rule) {
        return {
          eventTitle: event.title || 'Untitled Event',
          eventType: event.type || 'unknown',
          shouldInclude: false,
          reason: 'No rule found for event type'
        }
      }

      const context: EventDurationContext = {
        event,
        rule,
        currentDate,
        firstIncludedDate: event.newsletter?.firstIncludedDate
      }

      const result = this.shouldIncludeEvent(context)
      
      return {
        eventTitle: event.title || 'Untitled Event',
        eventType: event.type,
        shouldInclude: result.shouldInclude,
        reason: result.reason,
        displayUntilDate: result.displayUntilDate
      }
    })
  }
}