import { DisplayDuration, EventTypeRule, DurationCalculationResult, EventDurationContext } from '@my/app/types/newsletter-rules'

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
      
      case '3_weeks_from_first_inclusion':
        return this.calculateWeeksFromFirstInclusion(firstIncludedDate, currentDate, 3)
      
      case '3_weeks_or_until_event_date':
        return this.calculateWeeksOrUntilEvent(event, currentDate, firstIncludedDate, 3)
      
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
   * Include until the event date
   * Used for: study-weekend, general events, fraternals, bible-school
   */
  private static calculateUntilEventDate(event: any, currentDate: Date): DurationCalculationResult {
    const eventDate = this.getEventDate(event)
    
    if (!eventDate) {
      return {
        shouldInclude: true,
        reason: 'No event date specified - including by default'
      }
    }

    const shouldInclude = currentDate <= eventDate
    
    return {
      shouldInclude,
      displayUntilDate: eventDate,
      reason: shouldInclude 
        ? `Event is scheduled for ${eventDate.toDateString()}` 
        : `Event date ${eventDate.toDateString()} has passed`
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
   * Extract the primary event date from an event object
   */
  private static getEventDate(event: any): Date | null {
    // Try different date fields based on event type
    const dateFields = [
      'eventDate',
      'serviceDate',      // funeral
      'ceremonyDate',     // wedding
      'baptismDate',      // baptism
      'startDate',        // general
      'dateRange.start'   // study-weekend
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