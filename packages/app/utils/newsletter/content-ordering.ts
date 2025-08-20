import { NewsletterRules, AssembledContent, AssembledEvent, RegularServices, StandingContent, DailyReading } from '@my/app/types/newsletter-rules'

/**
 * Content Ordering Engine
 * Orders newsletter content sections according to rules configuration
 */
export class ContentOrderingEngine {
  private rules: NewsletterRules

  constructor(rules: NewsletterRules) {
    this.rules = rules
  }

  /**
   * Order all newsletter content according to rules
   */
  orderContent(content: AssembledContent): AssembledContent {
    const orderedSections: any[] = []
    
    // Process each section in the defined order
    this.rules.contentOrdering.forEach(sectionKey => {
      switch (sectionKey) {
        case 'daily_readings':
          if (content.dailyReadings?.length > 0) {
            orderedSections.push({
              type: 'daily_readings',
              content: this.orderDailyReadings(content.dailyReadings)
            })
          }
          break

        case 'this_week_bible_class':
          if (content.regularServices?.thisWeek?.bibleClass) {
            orderedSections.push({
              type: 'this_week_bible_class',
              content: content.regularServices.thisWeek.bibleClass
            })
          }
          break

        case 'next_week_bible_class':
          if (content.regularServices?.nextWeek?.bibleClass) {
            orderedSections.push({
              type: 'next_week_bible_class',
              content: content.regularServices.nextWeek.bibleClass
            })
          }
          break

        case 'this_sunday_services':
          if (content.regularServices?.thisWeek?.sunday) {
            orderedSections.push({
              type: 'this_sunday_services',
              content: this.orderSundayServices(content.regularServices.thisWeek.sunday)
            })
          }
          break

        case 'next_sunday_services':
          if (content.regularServices?.nextWeek?.sunday) {
            orderedSections.push({
              type: 'next_sunday_services',
              content: this.orderSundayServices(content.regularServices.nextWeek.sunday)
            })
          }
          break

        case 'priority_events_desc':
          if (content.events?.length > 0) {
            orderedSections.push({
              type: 'priority_events',
              content: this.orderEventsByPriority(content.events, 'desc')
            })
          }
          break

        case 'priority_events_asc':
          if (content.events?.length > 0) {
            orderedSections.push({
              type: 'priority_events',
              content: this.orderEventsByPriority(content.events, 'asc')
            })
          }
          break

        case 'standing_events':
          if (content.standingContent?.length > 0) {
            orderedSections.push({
              type: 'standing_events',
              content: this.orderStandingContent(content.standingContent)
            })
          }
          break

        default:
          console.warn(`Unknown content ordering section: ${sectionKey}`)
      }
    })

    // Reconstruct content with proper ordering
    return this.reconstructOrderedContent(orderedSections, content)
  }

  /**
   * Order daily readings (Friday to Thursday)
   */
  private orderDailyReadings(readings: DailyReading[]): DailyReading[] {
    const startDay = this.rules.displayRules.bibleReadings.startDay
    const dayOrder = this.getDayOrder(startDay)
    
    return readings.sort((a, b) => {
      const aIndex = dayOrder.indexOf((a.day || a.dayName || '').toLowerCase())
      const bIndex = dayOrder.indexOf((b.day || b.dayName || '').toLowerCase())
      
      // If day names don't match expected format, sort by date
      if (aIndex === -1 || bIndex === -1) {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      }
      
      return aIndex - bIndex
    })
  }

  /**
   * Get day ordering array starting from specified day
   */
  private getDayOrder(startDay: string): string[] {
    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const startIndex = allDays.indexOf(startDay.toLowerCase())
    
    if (startIndex === -1) {
      return allDays // Default order if start day not found
    }
    
    // Reorder array to start from specified day
    return [...allDays.slice(startIndex), ...allDays.slice(0, startIndex)]
  }

  /**
   * Order Sunday services (Sunday School before Memorial)
   */
  private orderSundayServices(sunday: any): any {
    const orderedServices: any = {}
    
    // Always put Sunday School first (9:30 AM)
    if (sunday.sundaySchool) {
      orderedServices.sundaySchool = sunday.sundaySchool
    }
    
    // Then Memorial Service (11:00 AM)
    if (sunday.memorial) {
      orderedServices.memorial = sunday.memorial
    }
    
    return orderedServices
  }

  /**
   * Order events by priority (high to low or low to high)
   */
  private orderEventsByPriority(events: AssembledEvent[], direction: 'asc' | 'desc' = 'desc'): AssembledEvent[] {
    const sorted = [...events].sort((a, b) => {
      // Primary sort: Priority
      const priorityDiff = direction === 'desc' 
        ? b.priority - a.priority 
        : a.priority - b.priority
      
      if (priorityDiff !== 0) return priorityDiff
      
      // Secondary sort: Event date (earlier events first)
      if (a.eventDate && b.eventDate) {
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      }
      
      // Tertiary sort: Title alphabetically
      return a.title.localeCompare(b.title)
    })
    
    return sorted
  }

  /**
   * Order standing content by priority
   */
  private orderStandingContent(standingContent: StandingContent[]): StandingContent[] {
    return [...standingContent].sort((a, b) => {
      // Primary sort: Priority (higher first)
      const priorityDiff = b.priority - a.priority
      if (priorityDiff !== 0) return priorityDiff
      
      // Secondary sort: Title alphabetically
      return a.title.localeCompare(b.title)
    })
  }

  /**
   * Group events by type for display
   */
  groupEventsByType(events: AssembledEvent[]): Record<string, AssembledEvent[]> {
    const grouped: Record<string, AssembledEvent[]> = {}
    
    events.forEach(event => {
      if (!grouped[event.type]) {
        grouped[event.type] = []
      }
      grouped[event.type].push(event)
    })
    
    // Sort each group by priority
    Object.keys(grouped).forEach(type => {
      grouped[type] = this.orderEventsByPriority(grouped[type], 'desc')
    })
    
    return grouped
  }

  /**
   * Order events by date (chronological)
   */
  orderEventsByDate(events: AssembledEvent[], direction: 'asc' | 'desc' = 'asc'): AssembledEvent[] {
    return [...events].sort((a, b) => {
      // Events with dates first
      if (a.eventDate && !b.eventDate) return -1
      if (!a.eventDate && b.eventDate) return 1
      
      // Both have dates - sort chronologically
      if (a.eventDate && b.eventDate) {
        const dateDiff = direction === 'asc'
          ? new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
          : new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        
        if (dateDiff !== 0) return dateDiff
      }
      
      // Fallback to priority then title
      const priorityDiff = b.priority - a.priority
      if (priorityDiff !== 0) return priorityDiff
      
      return a.title.localeCompare(b.title)
    })
  }

  /**
   * Create sections for email template
   */
  createEmailSections(content: AssembledContent): EmailSection[] {
    const orderedContent = this.orderContent(content)
    const sections: EmailSection[] = []
    
    // Add sections in order
    this.rules.contentOrdering.forEach(sectionKey => {
      switch (sectionKey) {
        case 'daily_readings':
          if (orderedContent.dailyReadings?.length > 0) {
            sections.push({
              id: 'daily_readings',
              title: 'Daily Bible Readings',
              type: 'readings_table',
              content: orderedContent.dailyReadings,
              priority: 10
            })
          }
          break

        case 'this_week_bible_class':
          if (orderedContent.regularServices?.thisWeek?.bibleClass) {
            sections.push({
              id: 'this_week_bible_class',
              title: 'This Week\'s Bible Class',
              type: 'bible_class',
              content: orderedContent.regularServices.thisWeek.bibleClass,
              priority: 9
            })
          }
          break

        case 'this_sunday_services':
          if (orderedContent.regularServices?.thisWeek?.sunday) {
            sections.push({
              id: 'this_sunday_services',
              title: 'This Sunday\'s Services',
              type: 'sunday_services',
              content: orderedContent.regularServices.thisWeek.sunday,
              priority: 8
            })
          }
          break

        case 'next_week_bible_class':
          if (orderedContent.regularServices?.nextWeek?.bibleClass) {
            sections.push({
              id: 'next_week_bible_class',
              title: 'Next Week\'s Bible Class',
              type: 'bible_class',
              content: orderedContent.regularServices.nextWeek.bibleClass,
              priority: 7
            })
          }
          break

        case 'next_sunday_services':
          if (orderedContent.regularServices?.nextWeek?.sunday) {
            sections.push({
              id: 'next_sunday_services',
              title: 'Next Sunday\'s Services',
              type: 'sunday_services',
              content: orderedContent.regularServices.nextWeek.sunday,
              priority: 6
            })
          }
          break

        case 'priority_events_desc':
          if (orderedContent.events?.length > 0) {
            const groupedEvents = this.groupEventsByType(orderedContent.events)
            
            // Create sections for each event type
            Object.entries(groupedEvents).forEach(([eventType, typeEvents]) => {
              const rule = this.rules.eventTypes[eventType]
              sections.push({
                id: `events_${eventType}`,
                title: this.getEventTypeDisplayTitle(eventType),
                type: 'events',
                content: typeEvents,
                priority: rule?.priority || 5
              })
            })
          }
          break

        case 'standing_events':
          if (orderedContent.standingContent?.length > 0) {
            sections.push({
              id: 'standing_events',
              title: 'Ongoing Activities',
              type: 'standing_content',
              content: orderedContent.standingContent,
              priority: 3
            })
          }
          break
      }
    })
    
    // Sort sections by priority (highest first)
    return sections.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get display title for event type
   */
  private getEventTypeDisplayTitle(eventType: string): string {
    const titleMap: Record<string, string> = {
      'study-weekend': 'Study Weekends',
      'funeral': 'In Memoriam',
      'wedding': 'Wedding Announcements',
      'baptism': 'Baptisms',
      'general': 'Announcements',
      'fraternal': 'Fraternal Gatherings',
      'bible-school': 'Bible Schools'
    }
    
    return titleMap[eventType] || eventType.charAt(0).toUpperCase() + eventType.slice(1)
  }

  /**
   * Reconstruct content object with ordered sections
   */
  private reconstructOrderedContent(orderedSections: any[], originalContent: AssembledContent): AssembledContent {
    const result: AssembledContent = {
      regularServices: originalContent.regularServices,
      events: originalContent.events,
      standingContent: originalContent.standingContent,
      dailyReadings: originalContent.dailyReadings
    }
    
    // Apply ordering from orderedSections
    orderedSections.forEach(section => {
      switch (section.type) {
        case 'daily_readings':
          result.dailyReadings = section.content
          break
        case 'priority_events':
          result.events = section.content
          break
        case 'standing_events':
          result.standingContent = section.content
          break
        // Regular services maintain their structure but with internal ordering
      }
    })
    
    return result
  }

  /**
   * Validate content ordering rules
   */
  validateOrderingRules(): string[] {
    const warnings: string[] = []
    const validSections = [
      'daily_readings',
      'this_week_bible_class',
      'next_week_bible_class',
      'this_sunday_services',
      'next_sunday_services',
      'priority_events_desc',
      'priority_events_asc',
      'standing_events'
    ]
    
    this.rules.contentOrdering.forEach(section => {
      if (!validSections.includes(section)) {
        warnings.push(`Unknown content ordering section: ${section}`)
      }
    })
    
    // Check for conflicting priority event ordering
    const hasPriorityDesc = this.rules.contentOrdering.includes('priority_events_desc')
    const hasPriorityAsc = this.rules.contentOrdering.includes('priority_events_asc')
    
    if (hasPriorityDesc && hasPriorityAsc) {
      warnings.push('Both priority_events_desc and priority_events_asc specified - desc will take precedence')
    }
    
    return warnings
  }
}

/**
 * Email section for template rendering
 */
export interface EmailSection {
  id: string
  title: string
  type: 'readings_table' | 'bible_class' | 'sunday_services' | 'events' | 'standing_content'
  content: any
  priority: number
}

/**
 * Content ordering utilities
 */
export class ContentOrderingUtils {
  
  /**
   * Get recommended content ordering for different newsletter types
   */
  static getRecommendedOrdering(type: 'standard' | 'special_event' | 'minimal'): string[] {
    switch (type) {
      case 'standard':
        return [
          'daily_readings',
          'this_week_bible_class',
          'this_sunday_services',
          'next_week_bible_class',
          'next_sunday_services',
          'priority_events_desc',
          'standing_events'
        ]
      
      case 'special_event':
        return [
          'priority_events_desc',
          'daily_readings',
          'this_week_bible_class',
          'this_sunday_services',
          'next_sunday_services',
          'standing_events'
        ]
      
      case 'minimal':
        return [
          'this_sunday_services',
          'this_week_bible_class',
          'priority_events_desc'
        ]
      
      default:
        return ContentOrderingUtils.getRecommendedOrdering('standard')
    }
  }

  /**
   * Estimate newsletter length based on content
   */
  static estimateNewsletterLength(content: AssembledContent): {
    estimatedWords: number
    estimatedCharacters: number
    sections: Array<{name: string, words: number, characters: number}>
  } {
    const sections: Array<{name: string, words: number, characters: number}> = []
    let totalWords = 0
    let totalCharacters = 0

    // Daily readings
    if (content.dailyReadings?.length > 0) {
      const readingsText = content.dailyReadings.map(r => 
        `${r.dayName}: ${r.reading1}, ${r.reading2}, ${r.reading3}`
      ).join(' ')
      const words = readingsText.split(/\s+/).length
      const chars = readingsText.length
      sections.push({ name: 'Daily Readings', words, characters: chars })
      totalWords += words
      totalCharacters += chars
    }

    // Events
    if (content.events?.length > 0) {
      content.events.forEach(event => {
        const eventText = event.content + (event.summary || '')
        const words = eventText.split(/\s+/).length
        const chars = eventText.length
        sections.push({ name: `Event: ${event.title}`, words, characters: chars })
        totalWords += words
        totalCharacters += chars
      })
    }

    // Regular services estimation (approximate)
    if (content.regularServices) {
      const serviceWords = 150 // Estimated words per service section
      const serviceChars = serviceWords * 6 // Estimated 6 chars per word
      sections.push({ name: 'Regular Services', words: serviceWords, characters: serviceChars })
      totalWords += serviceWords
      totalCharacters += serviceChars
    }

    // Standing content
    if (content.standingContent?.length > 0) {
      content.standingContent.forEach(standing => {
        const standingText = standing.description
        const words = standingText.split(/\s+/).length
        const chars = standingText.length
        sections.push({ name: `Standing: ${standing.title}`, words, characters: chars })
        totalWords += words
        totalCharacters += chars
      })
    }

    return {
      estimatedWords: totalWords,
      estimatedCharacters: totalCharacters,
      sections
    }
  }
}