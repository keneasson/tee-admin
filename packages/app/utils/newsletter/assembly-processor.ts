import { 
  NewsletterRules, 
  NewsletterAssembly, 
  AssembledContent, 
  AssembledEvent, 
  RegularServices, 
  StandingContent, 
  DailyReading,
  NewsletterAssemblyContext,
  AssemblyStatus
} from '@my/app/types/newsletter-rules'
import { NewsletterDataService } from './newsletter-data-service'
import { EventDurationCalculator } from './event-duration'
import { ContentOrderingEngine } from './content-ordering'
import { ValidationNotificationSystem, ValidationContext } from './validation-notifications'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { nanoid } from 'nanoid'

/**
 * Newsletter Assembly Processor
 * Core engine that assembles newsletter content from all data sources
 */
export class NewsletterAssemblyProcessor {
  private rules: NewsletterRules
  private dataService: NewsletterDataService
  private orderingEngine: ContentOrderingEngine
  private validationSystem: ValidationNotificationSystem

  constructor(
    rules: NewsletterRules,
    dynamoDb: DynamoDBDocument
  ) {
    this.rules = rules
    this.dataService = new NewsletterDataService(dynamoDb)
    this.orderingEngine = new ContentOrderingEngine(rules)
    this.validationSystem = new ValidationNotificationSystem(rules)
  }

  /**
   * Assemble complete newsletter for a given date
   */
  async assembleNewsletter(newsletterDate: Date, options: AssemblyOptions = {}): Promise<NewsletterAssembly> {
    const assemblyId = nanoid()
    const currentDate = new Date()
    
    console.log(`📰 Starting newsletter assembly for ${newsletterDate.toDateString()}`)
    
    try {
      // Create assembly context
      const context: NewsletterAssemblyContext = {
        rules: this.rules,
        currentDate,
        newsletterDate,
        dataSource: options.dataSource || 'production'
      }

      // Step 1: Gather all content from data sources
      const rawContent = await this.gatherRawContent(context, options)
      
      // Step 2: Apply rules-based filtering and processing
      const processedContent = await this.processContent(rawContent, context)
      
      // Step 3: Order content according to rules
      const orderedContent = this.orderingEngine.orderContent(processedContent)
      
      // Step 4: Validate content and check completeness
      const validationContext: ValidationContext = {
        currentDate,
        newsletterDate,
        generatedAt: currentDate,
        dataSource: context.dataSource
      }
      
      const validationResult = await this.validationSystem.validateAndNotify(orderedContent, validationContext)
      
      // Step 5: Create assembly object
      const assembly: NewsletterAssembly = {
        id: assemblyId,
        date: newsletterDate,
        assemblyDate: currentDate,
        status: this.determineAssemblyStatus(validationResult.validation),
        content: orderedContent,
        overrides: [], // No manual overrides in auto-assembly
        validation: validationResult.validation
      }

      console.log(`✅ Newsletter assembly completed - ID: ${assemblyId}, Status: ${assembly.status}, Score: ${assembly.validation.completenessScore}%`)
      
      return assembly
      
    } catch (error) {
      console.error('❌ Newsletter assembly failed:', error)
      
      // Return failed assembly with error information
      return {
        id: assemblyId,
        date: newsletterDate,
        assemblyDate: currentDate,
        status: 'failed',
        content: this.createEmptyContent(),
        overrides: [],
        validation: {
          completenessScore: 0,
          missingFields: [{
            field: 'assembly_process',
            service: 'assembly',
            severity: 'error',
            message: error instanceof Error ? error.message : 'Unknown assembly error'
          }],
          warnings: [],
          readyToSend: false,
          lastValidated: currentDate
        }
      }
    }
  }

  /**
   * Gather raw content from all data sources
   */
  private async gatherRawContent(context: NewsletterAssemblyContext, options: AssemblyOptions): Promise<RawContent> {
    const { newsletterDate } = context
    
    console.log('📊 Gathering raw content from data sources...')
    
    // Calculate date ranges for content gathering
    const thisWeekStart = this.getWeekStart(newsletterDate)
    const thisWeekEnd = this.getWeekEnd(newsletterDate)
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    const nextWeekEnd = new Date(thisWeekEnd)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

    // Gather content using existing working APIs
    const [events, regularServices, dailyReadings, standingContent] = await Promise.all([
      this.gatherEvents(context),
      this.dataService.getRegularServices(),
      this.dataService.getDailyReadings(nextWeekEnd),
      this.gatherStandingContent()
    ])

    return {
      events,
      regularServices,
      dailyReadings,
      standingContent
    }
  }

  /**
   * Gather events from Event Service with newsletter filtering
   */
  private async gatherEvents(context: NewsletterAssemblyContext): Promise<any[]> {
    try {
      console.log('📅 Gathering events from Newsletter Data Service...')
      
      // Get newsletter-suitable events
      const allEvents = await this.dataService.getPublishedEvents()
      
      // Filter events based on duration rules
      const filteredEvents = allEvents.filter(event => {
        const rule = this.rules.eventTypes[event.type]
        if (!rule) {
          console.warn(`No rule found for event type: ${event.type}`)
          return false
        }

        const durationContext = {
          event,
          rule,
          currentDate: context.currentDate,
          firstIncludedDate: event.newsletter?.firstIncludedDate
        }

        const result = EventDurationCalculator.shouldIncludeEvent(durationContext)
        
        if (!result.shouldInclude) {
          console.log(`⏭️ Excluding event "${event.title}": ${result.reason}`)
        }
        
        return result.shouldInclude
      })

      // Mark new events as included
      const eventsWithInclusionDates = filteredEvents.map(event => 
        EventDurationCalculator.markEventAsIncluded(event, context.currentDate)
      )

      console.log(`📅 Found ${eventsWithInclusionDates.length} events for newsletter (${allEvents.length} total available)`)
      return eventsWithInclusionDates
      
    } catch (error) {
      console.error('❌ Failed to gather events:', error)
      return []
    }
  }

  /**
   * Gather regular services (Memorial, Sunday School, Bible Class)
   */
  private async gatherRegularServices(thisWeekStart: Date, nextWeekEnd: Date, options: AssemblyOptions): Promise<any> {
    try {
      console.log('⛪ Gathering regular services from fast data service...')
      
      // Use fast data service instead of external API calls
      const servicesData = await this.dataService.getRegularServices()
      
      console.log('✅ Regular services data loaded from fast service')
      return servicesData
      
    } catch (error) {
      console.error('❌ Failed to gather regular services:', error)
      
      // Return structure with missing data indicators
      return {
        thisWeek: { sunday: {}, bibleClass: null },
        nextWeek: { sunday: {}, bibleClass: null }
      }
    }
  }

  /**
   * Fetch services for a specific week
   */
  private async fetchWeekServices(weekStart: Date, weekType: string, options: AssemblyOptions): Promise<any> {
    try {
      // Calculate specific dates for the week
      const sunday = this.getNextDayOfWeek(weekStart, 0) // Sunday
      const wednesday = this.getNextDayOfWeek(weekStart, 3) // Wednesday
      const thursday = this.getNextDayOfWeek(weekStart, 4) // Thursday
      
      // Determine Bible Class date (Wednesday or Thursday based on week)
      const bibleClassDate = this.getBibleClassDate(weekStart)
      
      // Fetch services (this will integrate with existing APIs)
      const [memorial, sundaySchool, bibleClass] = await Promise.all([
        this.fetchMemorialService(sunday, options),
        this.fetchSundaySchoolService(sunday, options),
        this.fetchBibleClassService(bibleClassDate, options)
      ])

      return {
        sunday: {
          memorial,
          sundaySchool: this.processSundaySchool(sundaySchool, sunday)
        },
        bibleClass
      }
      
    } catch (error) {
      console.error(`❌ Failed to fetch ${weekType} services:`, error)
      return { sunday: {}, bibleClass: null }
    }
  }

  /**
   * Fetch Memorial Service data
   */
  private async fetchMemorialService(date: Date, options: AssemblyOptions): Promise<any> {
    try {
      // TODO: Integrate with existing schedule API
      // For now, create placeholder based on expected structure
      
      const memorial = {
        date,
        preside: '', // Will be populated from schedule
        exhort: '',
        organist: '',
        steward: '',
        doorkeeper: '',
        collection: '',
        lunch: '',
        hymns: {
          opening: '',
          exhortation: '',
          memorial: '',
          closing: ''
        },
        readings: {
          reading1: '',
          reading2: ''
        },
        specialEvents: '',
        isException: false,
        exceptionMessage: ''
      }

      // Check for exceptions based on rules
      const exceptions = this.rules.mandatoryContent.sunday.memorial.exceptions
      for (const exception of exceptions) {
        if (this.isExceptionDate(date, exception.datePattern)) {
          memorial.isException = true
          memorial.exceptionMessage = exception.alternateMessage
          break
        }
      }

      console.log(`⛪ Memorial service for ${date.toDateString()}: ${memorial.isException ? 'Exception - ' + memorial.exceptionMessage : 'Regular service'}`)
      return memorial
      
    } catch (error) {
      console.error('❌ Failed to fetch memorial service:', error)
      return null
    }
  }

  /**
   * Fetch Sunday School data
   */
  private async fetchSundaySchoolService(date: Date, options: AssemblyOptions): Promise<any> {
    try {
      // TODO: Integrate with existing schedule API
      const sundaySchool = {
        date,
        refreshments: '', // Will be populated from schedule
        notes: '',
        specialEvents: ''
      }

      console.log(`👥 Sunday School for ${date.toDateString()}`)
      return sundaySchool
      
    } catch (error) {
      console.error('❌ Failed to fetch Sunday School service:', error)
      return null
    }
  }

  /**
   * Fetch Bible Class data
   */
  private async fetchBibleClassService(date: Date, options: AssemblyOptions): Promise<any> {
    try {
      // TODO: Integrate with existing schedule API
      const bibleClass = {
        date,
        speaker: '', // Will be populated from schedule
        topic: '',
        presider: '',
        notes: '',
        location: this.rules.mandatoryContent.bibleClass.defaultLocation
      }

      console.log(`📖 Bible Class for ${date.toDateString()}`)
      return bibleClass
      
    } catch (error) {
      console.error('❌ Failed to fetch Bible Class service:', error)
      return null
    }
  }

  /**
   * Process Sunday School based on seasonal rules
   */
  private processSundaySchool(sundaySchool: any, date: Date): any {
    if (!sundaySchool) return null

    const month = date.getMonth() + 1
    const activeMonths = this.rules.mandatoryContent.sunday.sundaySchool.seasonalRules.active.months
    const isActive = activeMonths.includes(month)

    return {
      ...sundaySchool,
      isActive,
      inactiveMessage: isActive ? null : this.rules.mandatoryContent.sunday.sundaySchool.seasonalRules.inactive.message
    }
  }

  /**
   * Gather daily readings
   */
  private async gatherDailyReadings(newsletterDate: Date, options: AssemblyOptions): Promise<DailyReading[]> {
    try {
      console.log('📖 Gathering daily readings from fast data service...')
      
      // Calculate reading dates (7 days starting from Friday after newsletter)
      const startDate = this.getNextFriday(newsletterDate)
      
      // Use fast data service instead of external API calls
      const readings = await this.dataService.getDailyReadings(startDate)

      console.log(`📖 Generated ${readings.length} daily readings starting from ${startDate.toDateString()}`)
      return readings
      
    } catch (error) {
      console.error('❌ Failed to gather daily readings:', error)
      return []
    }
  }

  /**
   * Fetch daily reading for specific date
   */
  private async fetchDailyReading(date: Date, options: AssemblyOptions): Promise<DailyReading> {
    try {
      // TODO: Integrate with existing readings API
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[date.getDay()]

      return {
        date,
        dayName,
        reading1: '', // Will be populated from readings API
        reading2: '',
        reading3: ''
      }
      
    } catch (error) {
      console.error(`❌ Failed to fetch reading for ${date.toDateString()}:`, error)
      
      // Return placeholder
      return {
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        reading1: 'TBD',
        reading2: 'TBD',
        reading3: 'TBD'
      }
    }
  }

  /**
   * Gather standing content
   */
  private async gatherStandingContent(): Promise<StandingContent[]> {
    const standingContent: StandingContent[] = []
    
    Object.entries(this.rules.mandatoryContent.standingEvents).forEach(([key, rule]) => {
      if (rule.alwaysInclude) {
        standingContent.push({
          id: key,
          title: rule.title,
          schedule: rule.schedule,
          description: rule.description,
          priority: rule.priority,
          alwaysInclude: rule.alwaysInclude
        })
      }
    })

    console.log(`📋 Gathered ${standingContent.length} standing content items`)
    return standingContent
  }

  /**
   * Process gathered content according to rules
   */
  private async processContent(rawContent: RawContent, context: NewsletterAssemblyContext): Promise<AssembledContent> {
    console.log('⚙️ Processing content according to rules...')
    
    // Process events into assembled format
    const assembledEvents = await this.processEvents(rawContent.events, context)
    
    // Transform array-based regular services into the expected hierarchical structure
    const processedRegularServices = this.transformRegularServicesData(rawContent.regularServices, context.newsletterDate)
    
    return {
      regularServices: processedRegularServices,
      events: assembledEvents,
      standingContent: rawContent.standingContent,
      dailyReadings: rawContent.dailyReadings
    }
  }

  /**
   * Transform array-based regular services into hierarchical structure expected by preview generator
   */
  private transformRegularServicesData(servicesArray: any[], newsletterDate: Date): any {
    if (!Array.isArray(servicesArray)) {
      console.warn('Regular services data is not an array, returning empty structure')
      return { thisWeek: { sunday: {} }, nextWeek: { sunday: {} } }
    }

    // Calculate week boundaries
    const thisWeekStart = this.getWeekStart(newsletterDate)
    const thisWeekEnd = this.getWeekEnd(newsletterDate)
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    const nextWeekEnd = new Date(thisWeekEnd)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

    // Group services by week and type
    const result = {
      thisWeek: { sunday: {} as any, bibleClass: null as any },
      nextWeek: { sunday: {} as any, bibleClass: null as any }
    }

    servicesArray.forEach(service => {
      const serviceDate = new Date(service.Date)
      const isThisWeek = serviceDate >= thisWeekStart && serviceDate <= thisWeekEnd
      const isNextWeek = serviceDate >= nextWeekStart && serviceDate <= nextWeekEnd
      
      if (service.Key === 'memorial') {
        if (isThisWeek) {
          result.thisWeek.sunday.memorial = service
        } else if (isNextWeek) {
          result.nextWeek.sunday.memorial = service
        }
      } else if (service.Key === 'sundaySchool') {
        if (isThisWeek) {
          result.thisWeek.sunday.sundaySchool = service
        } else if (isNextWeek) {
          result.nextWeek.sunday.sundaySchool = service
        }
      } else if (service.Key === 'bibleClass') {
        if (isThisWeek) {
          result.thisWeek.bibleClass = service
        } else if (isNextWeek) {
          result.nextWeek.bibleClass = service
        }
      }
    })

    console.log('📊 Transformed services data:', JSON.stringify(result, null, 2))
    return result
  }

  /**
   * Process events into assembled format
   */
  private async processEvents(events: any[], context: NewsletterAssemblyContext): Promise<AssembledEvent[]> {
    return events.map(event => {
      const rule = this.rules.eventTypes[event.type]
      if (!rule) {
        console.warn(`No rule found for event type: ${event.type}`)
        return this.createDefaultAssembledEvent(event)
      }

      // Determine display type and content
      const displayType = this.determineDisplayType(event, rule)
      const content = this.generateEventContent(event, rule, displayType)
      const summary = this.generateEventSummary(event, rule)
      
      // Create CTA button if required
      const ctaButton = rule.requiresCTA ? {
        text: rule.ctaText || 'Learn More',
        url: this.generateEventUrl(event)
      } : undefined

      return {
        eventId: event.id,
        title: event.title,
        type: event.type,
        priority: rule.priority,
        eventDate: this.getEventDate(event),
        displayType,
        content,
        summary,
        ctaButton,
        includedByRule: `${event.type}_duration_rule`,
        overriddenByUser: false,
        firstIncludedDate: event.newsletter?.firstIncludedDate
      }
    })
  }

  /**
   * Determine display type for event
   */
  private determineDisplayType(event: any, rule: any): 'summary' | 'full' | 'title_only' {
    if (rule.showFullContent) return 'full'
    if (rule.includeInSummary) return 'summary'
    return 'title_only'
  }

  /**
   * Generate event content based on display type
   */
  private generateEventContent(event: any, rule: any, displayType: string): string {
    switch (displayType) {
      case 'full':
        return event.description || event.fullContent || event.title
      case 'summary':
        return this.generateEventSummary(event, rule)
      case 'title_only':
        return event.title
      default:
        return event.title
    }
  }

  /**
   * Generate event summary with length limits
   */
  private generateEventSummary(event: any, rule: any): string {
    let summary = event.newsletter?.summary || event.description || event.title
    
    if (rule.maxSummaryLength && summary.length > rule.maxSummaryLength) {
      summary = summary.substring(0, rule.maxSummaryLength - 3) + '...'
    }
    
    return summary
  }

  /**
   * Generate URL for event
   */
  private generateEventUrl(event: any): string {
    if (event.newsletter?.ctaButton?.url) {
      return event.newsletter.ctaButton.url
    }
    
    // Generate URL based on event slug or ID
    const slug = event.metadata?.slug || event.id
    return `${process.env.BASE_URL || ''}/event/${slug}`
  }

  /**
   * Get event date from event object
   */
  private getEventDate(event: any): Date | undefined {
    const dateFields = ['eventDate', 'serviceDate', 'ceremonyDate', 'baptismDate', 'startDate']
    
    for (const field of dateFields) {
      if (event[field]) {
        return new Date(event[field])
      }
    }
    
    if (event.dateRange?.start) {
      return new Date(event.dateRange.start)
    }
    
    return undefined
  }

  /**
   * Create default assembled event when no rule exists
   */
  private createDefaultAssembledEvent(event: any): AssembledEvent {
    return {
      eventId: event.id,
      title: event.title || 'Untitled Event',
      type: event.type || 'general',
      priority: 5,
      eventDate: this.getEventDate(event),
      displayType: 'summary',
      content: event.description || event.title,
      includedByRule: 'default_fallback',
      overriddenByUser: false
    }
  }

  /**
   * Determine assembly status based on validation
   */
  private determineAssemblyStatus(validation: any): AssemblyStatus {
    if (validation.completenessScore >= 95) return 'approved'
    if (validation.completenessScore >= 75 && validation.readyToSend) return 'auto_generated'
    return 'under_review'
  }

  /**
   * Create empty content structure
   */
  private createEmptyContent(): AssembledContent {
    return {
      regularServices: { thisWeek: { sunday: {} }, nextWeek: { sunday: {} } },
      events: [],
      standingContent: [],
      dailyReadings: []
    }
  }

  // Date utility methods
  private getWeekStart(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    const diff = result.getDate() - day // Sunday as start of week
    result.setDate(diff)
    result.setHours(0, 0, 0, 0)
    return result
  }

  private getWeekEnd(date: Date): Date {
    const result = this.getWeekStart(date)
    result.setDate(result.getDate() + 6)
    result.setHours(23, 59, 59, 999)
    return result
  }

  private getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
    const result = new Date(date)
    const days = (dayOfWeek - result.getDay() + 7) % 7
    result.setDate(result.getDate() + days)
    return result
  }

  private getBibleClassDate(weekStart: Date): Date {
    // Determine if Bible Class is Wednesday or Thursday for this week
    // This logic can be customized based on your schedule
    return this.getNextDayOfWeek(weekStart, 3) // Default to Wednesday
  }

  private getNextFriday(date: Date): Date {
    const result = new Date(date)
    const days = (5 - result.getDay() + 7) % 7 || 7 // Friday after the given date
    result.setDate(result.getDate() + days)
    return result
  }

  private isExceptionDate(date: Date, pattern: string): boolean {
    // TODO: Implement pattern matching for exception dates
    // For now, return false - this will be enhanced based on your specific patterns
    return false
  }
}

// Supporting interfaces
interface AssemblyOptions {
  dataSource?: 'production' | 'test' | 'fallback'
  useCache?: boolean
  includePrivateEvents?: boolean
}

interface RawContent {
  events: any[]
  regularServices: any
  dailyReadings: DailyReading[]
  standingContent: StandingContent[]
}