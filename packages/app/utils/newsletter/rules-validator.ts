import { NewsletterRules, ValidationError, AssemblyValidation } from '@my/app/types/newsletter-rules'
import newsletterRulesJson from '@my/app/config/newsletter-rules.json'

/**
 * Newsletter Rules Validator
 * Validates newsletter rules configuration and assembled content
 */
export class NewsletterRulesValidator {
  private rules: NewsletterRules

  constructor(rules?: NewsletterRules) {
    this.rules = rules || (newsletterRulesJson as NewsletterRules)
  }

  /**
   * Validate the newsletter rules configuration itself
   */
  validateRulesConfiguration(): ValidationError[] {
    const errors: ValidationError[] = []

    // Validate version format
    if (!this.rules.version || !this.isValidSemver(this.rules.version)) {
      errors.push({
        field: 'version',
        service: 'rules_config',
        severity: 'error',
        message: 'Invalid or missing version number. Must be valid semver (e.g., "1.0.0")'
      })
    }

    // Validate mandatory content structure
    if (!this.rules.mandatoryContent) {
      errors.push({
        field: 'mandatoryContent',
        service: 'rules_config',
        severity: 'error',
        message: 'Missing mandatoryContent configuration'
      })
    } else {
      errors.push(...this.validateMandatoryContentRules())
    }

    // Validate event types
    if (!this.rules.eventTypes || Object.keys(this.rules.eventTypes).length === 0) {
      errors.push({
        field: 'eventTypes',
        service: 'rules_config',
        severity: 'error',
        message: 'Missing or empty eventTypes configuration'
      })
    } else {
      errors.push(...this.validateEventTypeRules())
    }

    // Validate content ordering
    if (!this.rules.contentOrdering || this.rules.contentOrdering.length === 0) {
      errors.push({
        field: 'contentOrdering',
        service: 'rules_config',
        severity: 'warning',
        message: 'Missing content ordering configuration - default order will be used'
      })
    }

    return errors
  }

  /**
   * Validate mandatory content rules
   */
  private validateMandatoryContentRules(): ValidationError[] {
    const errors: ValidationError[] = []
    const { mandatoryContent } = this.rules

    // Validate memorial rules
    if (!mandatoryContent.sunday?.memorial) {
      errors.push({
        field: 'sunday.memorial',
        service: 'mandatory_content',
        severity: 'error',
        message: 'Missing memorial service configuration'
      })
    } else {
      const memorial = mandatoryContent.sunday.memorial
      if (!memorial.requiredFields || memorial.requiredFields.length === 0) {
        errors.push({
          field: 'sunday.memorial.requiredFields',
          service: 'mandatory_content',
          severity: 'warning',
          message: 'No required fields specified for memorial service'
        })
      }
    }

    // Validate Sunday School rules
    if (!mandatoryContent.sunday?.sundaySchool) {
      errors.push({
        field: 'sunday.sundaySchool',
        service: 'mandatory_content',
        severity: 'error',
        message: 'Missing Sunday School configuration'
      })
    } else {
      const ss = mandatoryContent.sunday.sundaySchool
      if (!ss.seasonalRules?.active?.months || !ss.seasonalRules?.inactive?.months) {
        errors.push({
          field: 'sunday.sundaySchool.seasonalRules',
          service: 'mandatory_content',
          severity: 'error',
          message: 'Missing or incomplete seasonal rules for Sunday School'
        })
      }
    }

    // Validate Bible Class rules
    if (!mandatoryContent.bibleClass) {
      errors.push({
        field: 'bibleClass',
        service: 'mandatory_content',
        severity: 'error',
        message: 'Missing Bible Class configuration'
      })
    }

    return errors
  }

  /**
   * Validate event type rules
   */
  private validateEventTypeRules(): ValidationError[] {
    const errors: ValidationError[] = []

    Object.entries(this.rules.eventTypes).forEach(([eventType, rule]) => {
      // Validate priority range
      if (rule.priority < 1 || rule.priority > 10) {
        errors.push({
          field: `eventTypes.${eventType}.priority`,
          service: 'event_types',
          severity: 'warning',
          message: `Priority ${rule.priority} outside recommended range 1-10`
        })
      }

      // Validate summary configuration
      if (rule.includeInSummary && !rule.maxSummaryLength) {
        errors.push({
          field: `eventTypes.${eventType}.maxSummaryLength`,
          service: 'event_types',
          severity: 'warning',
          message: 'includeInSummary is true but maxSummaryLength is not specified'
        })
      }

      // Validate CTA configuration
      if (rule.requiresCTA && !rule.ctaText) {
        errors.push({
          field: `eventTypes.${eventType}.ctaText`,
          service: 'event_types',
          severity: 'warning',
          message: 'requiresCTA is true but ctaText is not specified'
        })
      }

      // Validate display duration
      const validDurations = [
        'until_event_date',
        '1_week_after_event',
        '2_weeks_after_event', 
        '3_weeks_after_event',
        '3_weeks_from_first_inclusion',
        '3_weeks_or_until_event_date',
        'custom'
      ]
      if (!validDurations.includes(rule.displayDuration)) {
        errors.push({
          field: `eventTypes.${eventType}.displayDuration`,
          service: 'event_types',
          severity: 'error',
          message: `Invalid displayDuration "${rule.displayDuration}". Must be one of: ${validDurations.join(', ')}`
        })
      }
    })

    return errors
  }

  /**
   * Validate assembled newsletter content against rules
   */
  validateAssembledContent(content: any): AssemblyValidation {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let completenessScore = 100

    // Validate regular services
    const serviceValidation = this.validateRegularServices(content.regularServices)
    errors.push(...serviceValidation.errors)
    warnings.push(...serviceValidation.warnings)
    completenessScore -= serviceValidation.penaltyPoints

    // Validate events
    const eventValidation = this.validateEvents(content.events)
    errors.push(...eventValidation.errors)
    warnings.push(...eventValidation.warnings)
    completenessScore -= eventValidation.penaltyPoints

    // Validate daily readings
    if (!content.dailyReadings || content.dailyReadings.length === 0) {
      errors.push({
        field: 'dailyReadings',
        service: 'content_validation',
        severity: 'error',
        message: 'Missing daily readings'
      })
      completenessScore -= 10
    } else if (content.dailyReadings.length !== 7) {
      warnings.push(`Daily readings has ${content.dailyReadings.length} days instead of expected 7 days`)
      completenessScore -= 5
    }

    // Calculate final completeness score
    completenessScore = Math.max(0, Math.min(100, completenessScore))
    
    const readyToSend = errors.filter(e => e.severity === 'error').length === 0 && 
                       completenessScore >= this.rules.validation.completenessThresholds.acceptable

    return {
      completenessScore,
      missingFields: errors,
      warnings,
      readyToSend,
      lastValidated: new Date()
    }
  }

  /**
   * Validate regular services content
   */
  private validateRegularServices(services: any): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    if (!services) {
      errors.push({
        field: 'regularServices',
        service: 'content_validation',
        severity: 'error',
        message: 'Missing regular services content'
      })
      return { errors, warnings, penaltyPoints: 50 }
    }

    // Check if services is an array (actual API format) or hierarchical object (expected format)
    if (Array.isArray(services)) {
      // Working with actual API data structure - array of ProgramTypes
      const validation = this.validateProgramTypesArray(services)
      errors.push(...validation.errors)
      warnings.push(...validation.warnings)
      penaltyPoints += validation.penaltyPoints
    } else {
      // Legacy validation for hierarchical structure
      // Validate this week's services
      if (!services.thisWeek) {
        errors.push({
          field: 'regularServices.thisWeek',
          service: 'content_validation',
          severity: 'error',
          message: 'Missing this week\'s services'
        })
        penaltyPoints += 25
      } else {
        const thisWeekValidation = this.validateWeekServices(services.thisWeek, 'thisWeek')
        errors.push(...thisWeekValidation.errors)
        warnings.push(...thisWeekValidation.warnings)
        penaltyPoints += thisWeekValidation.penaltyPoints
      }

      // Validate next week's services (less critical)
      if (!services.nextWeek) {
        warnings.push('Missing next week\'s services preview')
        penaltyPoints += 5
      } else {
        const nextWeekValidation = this.validateWeekServices(services.nextWeek, 'nextWeek')
        // Reduce penalty for next week issues
        errors.push(...nextWeekValidation.errors.map(e => ({ ...e, severity: 'warning' as const })))
        warnings.push(...nextWeekValidation.warnings)
        penaltyPoints += Math.floor(nextWeekValidation.penaltyPoints / 2)
      }
    }

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate ProgramTypes array (actual API format)
   */
  private validateProgramTypesArray(services: any[]): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    // Group services by type for validation
    const servicesByType = {
      memorial: services.filter(s => s.Key === 'memorial'),
      sundaySchool: services.filter(s => s.Key === 'sundaySchool'),
      bibleClass: services.filter(s => s.Key === 'bibleClass')
    }

    // Validate Memorial Service
    if (this.rules.mandatoryContent.sunday.memorial.alwaysInclude) {
      if (servicesByType.memorial.length === 0) {
        errors.push({
          field: 'regularServices.memorial',
          service: 'memorial',
          severity: 'error',
          message: 'Missing memorial service (required)'
        })
        penaltyPoints += 15
      } else {
        // Check if memorial services have required data
        servicesByType.memorial.forEach((memorial, index) => {
          const memorialValidation = this.validateProgramTypeItem(memorial, 'memorial', index)
          errors.push(...memorialValidation.errors)
          warnings.push(...memorialValidation.warnings)
          penaltyPoints += memorialValidation.penaltyPoints
        })
      }
    }

    // Validate Sunday School (seasonal)
    const currentMonth = new Date().getMonth() + 1
    const isSSActive = this.rules.mandatoryContent.sunday.sundaySchool.seasonalRules.active.months.includes(currentMonth)
    
    if (isSSActive && servicesByType.sundaySchool.length === 0) {
      errors.push({
        field: 'regularServices.sundaySchool',
        service: 'sunday_school',
        severity: 'error',
        message: 'Missing Sunday School (required during active season)'
      })
      penaltyPoints += 10
    } else if (servicesByType.sundaySchool.length > 0) {
      servicesByType.sundaySchool.forEach((ss, index) => {
        const ssValidation = this.validateProgramTypeItem(ss, 'sundaySchool', index)
        errors.push(...ssValidation.errors)
        warnings.push(...ssValidation.warnings)
        penaltyPoints += ssValidation.penaltyPoints
      })
    }

    // Validate Bible Class
    if (this.rules.mandatoryContent.bibleClass.alwaysInclude) {
      if (servicesByType.bibleClass.length === 0) {
        errors.push({
          field: 'regularServices.bibleClass',
          service: 'bible_class',
          severity: 'error',
          message: 'Missing Bible Class (required)'
        })
        penaltyPoints += 10
      } else {
        servicesByType.bibleClass.forEach((bc, index) => {
          const bcValidation = this.validateProgramTypeItem(bc, 'bibleClass', index)
          errors.push(...bcValidation.errors)
          warnings.push(...bcValidation.warnings)
          penaltyPoints += bcValidation.penaltyPoints
        })
      }
    }

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate individual ProgramType item
   */
  private validateProgramTypeItem(item: any, serviceType: string, index: number): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    // Basic validation - check if item has required structure
    if (!item) {
      errors.push({
        field: `regularServices.${serviceType}[${index}]`,
        service: serviceType,
        severity: 'error',
        message: `${serviceType} item is null or undefined`
      })
      return { errors, warnings, penaltyPoints: 5 }
    }

    // Check for basic required fields
    if (!item.Date) {
      warnings.push(`${serviceType} service missing date information`)
      penaltyPoints += 1
    }

    if (!item.Key || item.Key !== serviceType) {
      warnings.push(`${serviceType} service has incorrect or missing Key field`)
      penaltyPoints += 1
    }

    // Service-specific validation (use actual API field names with capital letters)
    switch (serviceType) {
      case 'memorial':
        if (!item.Preside && !item.Exhort) {
          warnings.push(`Memorial service missing key participant information`)
          penaltyPoints += 2
        }
        break
      case 'sundaySchool':
        // Sunday School validation is more lenient as it's seasonal
        if (!item.Refreshments && !item['Holidays and Special Events']) {
          warnings.push(`Sunday School service missing content information`)
          penaltyPoints += 1
        }
        break
      case 'bibleClass':
        if (!item.Speaker && !item.Presider) {
          warnings.push(`Bible Class missing speaker/presider information`)
          penaltyPoints += 2
        }
        if (!item.Topic) {
          warnings.push(`Bible Class missing topic information`)
          penaltyPoints += 1
        }
        break
    }

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate a week's worth of services
   */
  private validateWeekServices(week: any, weekType: string): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    // Validate Memorial Service
    if (this.rules.mandatoryContent.sunday.memorial.alwaysInclude) {
      if (!week.sunday?.memorial) {
        errors.push({
          field: `${weekType}.sunday.memorial`,
          service: 'memorial',
          severity: 'error',
          message: 'Missing memorial service (required)'
        })
        penaltyPoints += 15
      } else {
        const memorialValidation = this.validateMemorialService(week.sunday.memorial, weekType)
        errors.push(...memorialValidation.errors)
        warnings.push(...memorialValidation.warnings)
        penaltyPoints += memorialValidation.penaltyPoints
      }
    }

    // Validate Sunday School (seasonal)
    const currentMonth = new Date().getMonth() + 1
    const isSSActive = this.rules.mandatoryContent.sunday.sundaySchool.seasonalRules.active.months.includes(currentMonth)
    
    if (isSSActive && !week.sunday?.sundaySchool) {
      errors.push({
        field: `${weekType}.sunday.sundaySchool`,
        service: 'sunday_school',
        severity: 'error',
        message: 'Missing Sunday School (required during active season)'
      })
      penaltyPoints += 10
    } else if (week.sunday?.sundaySchool) {
      const ssValidation = this.validateSundaySchoolService(week.sunday.sundaySchool, weekType)
      errors.push(...ssValidation.errors)
      warnings.push(...ssValidation.warnings)
      penaltyPoints += ssValidation.penaltyPoints
    }

    // Validate Bible Class
    if (this.rules.mandatoryContent.bibleClass.alwaysInclude) {
      if (!week.bibleClass) {
        errors.push({
          field: `${weekType}.bibleClass`,
          service: 'bible_class',
          severity: 'error',
          message: 'Missing Bible Class (required)'
        })
        penaltyPoints += 10
      } else {
        const bcValidation = this.validateBibleClassService(week.bibleClass, weekType)
        errors.push(...bcValidation.errors)
        warnings.push(...bcValidation.warnings)
        penaltyPoints += bcValidation.penaltyPoints
      }
    }

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate Memorial Service
   */
  private validateMemorialService(memorial: any, context: string): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    const requiredFields = this.rules.mandatoryContent.sunday.memorial.requiredFields

    requiredFields.forEach(field => {
      if (!memorial[field] || memorial[field].trim() === '') {
        errors.push({
          field: `${context}.memorial.${field}`,
          service: 'memorial',
          severity: 'error',
          message: `Missing required field: ${field}`
        })
        penaltyPoints += 2
      }
    })

    // Check for exception handling
    if (memorial.isException && !memorial.exceptionMessage) {
      warnings.push('Memorial service marked as exception but no exception message provided')
      penaltyPoints += 1
    }

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate Sunday School Service
   */
  private validateSundaySchoolService(sundaySchool: any, context: string): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    const requiredFields = this.rules.mandatoryContent.sunday.sundaySchool.requiredFields

    requiredFields.forEach(field => {
      if (!sundaySchool[field] || sundaySchool[field].trim() === '') {
        errors.push({
          field: `${context}.sundaySchool.${field}`,
          service: 'sunday_school',
          severity: 'error',
          message: `Missing required field: ${field}`
        })
        penaltyPoints += 1
      }
    })

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate Bible Class Service
   */
  private validateBibleClassService(bibleClass: any, context: string): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    const requiredFields = this.rules.mandatoryContent.bibleClass.requiredFields

    requiredFields.forEach(field => {
      if (!bibleClass[field] || bibleClass[field].trim() === '') {
        errors.push({
          field: `${context}.bibleClass.${field}`,
          service: 'bible_class',
          severity: 'error',
          message: `Missing required field: ${field}`
        })
        penaltyPoints += 1
      }
    })

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Validate events content
   */
  private validateEvents(events: any[]): { errors: ValidationError[], warnings: string[], penaltyPoints: number } {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let penaltyPoints = 0

    if (!events) {
      warnings.push('No events provided - this may be normal for some weeks')
      return { errors, warnings, penaltyPoints: 0 }
    }

    events.forEach((event, index) => {
      // Validate required event fields
      if (!event.title || event.title.trim() === '') {
        errors.push({
          field: `events[${index}].title`,
          service: 'events',
          severity: 'error',
          message: 'Event missing title'
        })
        penaltyPoints += 2
      }

      if (!event.type || !this.rules.eventTypes[event.type]) {
        errors.push({
          field: `events[${index}].type`,
          service: 'events',
          severity: 'error',
          message: `Event has unknown or missing type: ${event.type}`
        })
        penaltyPoints += 3
      }

      // Validate event content based on display type
      if (event.displayType === 'summary' && (!event.summary || event.summary.trim() === '')) {
        warnings.push(`Event "${event.title}" set to summary display but no summary provided`)
        penaltyPoints += 1
      }

      if (event.displayType === 'full' && (!event.content || event.content.trim() === '')) {
        errors.push({
          field: `events[${index}].content`,
          service: 'events',
          severity: 'error',
          message: `Event "${event.title}" set to full display but no content provided`
        })
        penaltyPoints += 2
      }

      // Validate CTA requirements
      if (event.type && this.rules.eventTypes[event.type]?.requiresCTA && !event.ctaButton) {
        warnings.push(`Event "${event.title}" of type "${event.type}" should have a CTA button`)
        penaltyPoints += 1
      }
    })

    return { errors, warnings, penaltyPoints }
  }

  /**
   * Check if a version string is valid semver
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
    return semverRegex.test(version)
  }

  /**
   * Get completeness level description
   */
  getCompletenessLevel(score: number): string {
    const thresholds = this.rules.validation.completenessThresholds
    
    if (score >= thresholds.excellent) return 'excellent'
    if (score >= thresholds.good) return 'good'
    if (score >= thresholds.acceptable) return 'acceptable'
    return 'poor'
  }

  /**
   * Check if newsletter is ready to send
   */
  isReadyToSend(validation: AssemblyValidation): boolean {
    return validation.readyToSend && 
           validation.completenessScore >= this.rules.validation.completenessThresholds.acceptable
  }
}