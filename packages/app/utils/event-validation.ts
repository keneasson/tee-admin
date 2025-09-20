import { Event, EventType, EventValidationResult, EventValidationError } from '@my/app/types/events'

/**
 * Event validation utilities supporting progressive/draft validation
 * For save-the-date events with minimal information
 */

export interface ValidationOptions {
  mode: 'draft' | 'publish' | 'minimal'
  allowIncomplete?: boolean
  requiredFields?: string[]
}

export class EventValidator {
  /**
   * Validate an event based on its status and completion level
   */
  static validateEvent(event: Partial<Event>, options: ValidationOptions = { mode: 'draft' }): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Always require these basic fields
    if (!event.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Event title is required',
        code: 'REQUIRED_FIELD'
      })
    }

    if (!event.type) {
      errors.push({
        field: 'type',
        message: 'Event type is required',
        code: 'REQUIRED_FIELD'
      })
    }

    // Type-specific validation based on mode
    if (event.type && options.mode !== 'minimal') {
      const typeValidation = this.validateByType(event, options)
      errors.push(...typeValidation.errors)
      warnings.push(...typeValidation.warnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate minimum requirements for a save-the-date event
   */
  static validateSaveTheDate(event: Partial<Event>): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Basic requirements for save-the-date
    if (!event.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Event title is required for save-the-date',
        code: 'REQUIRED_FIELD'
      })
    }

    if (!event.type) {
      errors.push({
        field: 'type',
        message: 'Event type is required',
        code: 'REQUIRED_FIELD'
      })
    }

    // Date validation based on event type
    if (event.type) {
      const dateValidation = this.validateMinimalDates(event as Event)
      errors.push(...dateValidation.errors)
      warnings.push(...dateValidation.warnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Check if event has sufficient data for draft saving
   */
  static canSaveAsDraft(event: Partial<Event>): boolean {
    // Very minimal requirements for draft saving
    return Boolean(
      event.title?.trim() || 
      event.type ||
      (event as any).theme?.trim() ||
      (event as any).candidate?.firstName?.trim() ||
      (event as any).couple?.bride?.firstName?.trim() ||
      (event as any).deceased?.firstName?.trim()
    )
  }

  /**
   * Check if event is ready for publishing
   */
  static canPublish(event: Partial<Event>): EventValidationResult {
    return this.validateEvent(event, { mode: 'publish' })
  }

  private static validateMinimalDates(event: Event): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    switch (event.type) {
      case 'study-weekend':
        const swEvent = event as any
        if (!swEvent.dateRange?.start) {
          errors.push({
            field: 'dateRange.start',
            message: 'Start date is required for study weekend save-the-date',
            code: 'REQUIRED_DATE'
          })
        }
        if (!swEvent.dateRange?.end) {
          warnings.push({
            field: 'dateRange.end', 
            message: 'End date recommended for study weekend',
            code: 'RECOMMENDED_DATE'
          })
        }
        break

      case 'wedding':
        const wEvent = event as any
        if (!wEvent.ceremonyDate) {
          errors.push({
            field: 'ceremonyDate',
            message: 'Ceremony date is required for wedding save-the-date',
            code: 'REQUIRED_DATE'
          })
        }
        break

      case 'baptism':
        const bEvent = event as any
        if (!bEvent.baptismDate) {
          errors.push({
            field: 'baptismDate',
            message: 'Baptism date is required for baptism save-the-date',
            code: 'REQUIRED_DATE'
          })
        }
        break

      case 'funeral':
        const fEvent = event as any
        if (!fEvent.serviceDate) {
          errors.push({
            field: 'serviceDate',
            message: 'Service date is required for funeral save-the-date',
            code: 'REQUIRED_DATE'
          })
        }
        break

      case 'general':
        const gEvent = event as any
        if (!gEvent.startDate) {
          warnings.push({
            field: 'startDate',
            message: 'Start date recommended for general event',
            code: 'RECOMMENDED_DATE'
          })
        }
        break

      case 'recurring':
        const rEvent = event as any
        if (!rEvent.recurringConfig?.startDate && !rEvent.recurringConfig?.dateRange?.start) {
          errors.push({
            field: 'recurringConfig.startDate',
            message: 'Start date is required for recurring event',
            code: 'REQUIRED_DATE'
          })
        }
        break
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  private static validateByType(event: Partial<Event>, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    switch (event.type) {
      case 'study-weekend':
        return this.validateStudyWeekend(event as any, options)
      case 'wedding':
        return this.validateWedding(event as any, options)
      case 'baptism':
        return this.validateBaptism(event as any, options)
      case 'funeral':
        return this.validateFuneral(event as any, options)
      case 'general':
        return this.validateGeneral(event as any, options)
      case 'recurring':
        return this.validateRecurring(event as any, options)
    }

    return { isValid: true, errors, warnings }
  }

  private static validateStudyWeekend(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Draft mode - minimal requirements
    if (options.mode === 'draft') {
      if (!event.dateRange?.start) {
        warnings.push({
          field: 'dateRange.start',
          message: 'Start date is recommended',
          code: 'RECOMMENDED_FIELD'
        })
      }
      
      if (!event.theme?.trim()) {
        warnings.push({
          field: 'theme',
          message: 'Theme helps identify the event',
          code: 'RECOMMENDED_FIELD'
        })
      }

      return { isValid: true, errors, warnings }
    }

    // Publish mode - full requirements
    if (options.mode === 'publish') {
      if (!event.dateRange?.start || !event.dateRange?.end) {
        errors.push({
          field: 'dateRange',
          message: 'Start and end dates are required for published events',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.theme?.trim()) {
        errors.push({
          field: 'theme',
          message: 'Theme is required for published study weekend',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.hostingEcclesia?.name?.trim()) {
        errors.push({
          field: 'hostingEcclesia.name',
          message: 'Hosting ecclesia is required for published events',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.location?.name?.trim()) {
        errors.push({
          field: 'location.name',
          message: 'Location name is required for published events',
          code: 'REQUIRED_FIELD'
        })
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  private static validateWedding(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Draft mode
    if (options.mode === 'draft') {
      if (!event.ceremonyDate) {
        warnings.push({
          field: 'ceremonyDate',
          message: 'Ceremony date is recommended',
          code: 'RECOMMENDED_FIELD'
        })
      }

      if (!event.couple?.bride?.firstName?.trim() && !event.couple?.groom?.firstName?.trim()) {
        warnings.push({
          field: 'couple',
          message: 'Couple names help identify the event',
          code: 'RECOMMENDED_FIELD'
        })
      }

      return { isValid: true, errors, warnings }
    }

    // Publish mode
    if (options.mode === 'publish') {
      if (!event.ceremonyDate) {
        errors.push({
          field: 'ceremonyDate',
          message: 'Ceremony date is required for published wedding',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.couple?.bride?.firstName?.trim() || !event.couple?.bride?.lastName?.trim()) {
        errors.push({
          field: 'couple.bride',
          message: 'Bride\'s full name is required for published wedding',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.couple?.groom?.firstName?.trim() || !event.couple?.groom?.lastName?.trim()) {
        errors.push({
          field: 'couple.groom',
          message: 'Groom\'s full name is required for published wedding',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.hostingEcclesia?.name?.trim()) {
        errors.push({
          field: 'hostingEcclesia.name',
          message: 'Hosting ecclesia is required for published wedding',
          code: 'REQUIRED_FIELD'
        })
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  private static validateBaptism(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Draft mode
    if (options.mode === 'draft') {
      if (!event.baptismDate) {
        warnings.push({
          field: 'baptismDate',
          message: 'Baptism date is recommended',
          code: 'RECOMMENDED_FIELD'
        })
      }

      if (!event.candidate?.firstName?.trim()) {
        warnings.push({
          field: 'candidate.firstName',
          message: 'Candidate name helps identify the event',
          code: 'RECOMMENDED_FIELD'
        })
      }

      return { isValid: true, errors, warnings }
    }

    // Publish mode
    if (options.mode === 'publish') {
      if (!event.baptismDate) {
        errors.push({
          field: 'baptismDate',
          message: 'Baptism date is required for published baptism',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.candidate?.firstName?.trim() || !event.candidate?.lastName?.trim()) {
        errors.push({
          field: 'candidate',
          message: 'Candidate\'s full name is required for published baptism',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.hostingEcclesia?.name?.trim()) {
        errors.push({
          field: 'hostingEcclesia.name',
          message: 'Hosting ecclesia is required for published baptism',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.location?.name?.trim()) {
        errors.push({
          field: 'location.name',
          message: 'Location name is required for published baptism',
          code: 'REQUIRED_FIELD'
        })
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  private static validateFuneral(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Draft mode
    if (options.mode === 'draft') {
      if (!event.serviceDate) {
        warnings.push({
          field: 'serviceDate',
          message: 'Service date is recommended',
          code: 'RECOMMENDED_FIELD'
        })
      }

      if (!event.deceased?.firstName?.trim()) {
        warnings.push({
          field: 'deceased.firstName',
          message: 'Deceased name helps identify the event',
          code: 'RECOMMENDED_FIELD'
        })
      }

      return { isValid: true, errors, warnings }
    }

    // Publish mode
    if (options.mode === 'publish') {
      if (!event.serviceDate) {
        errors.push({
          field: 'serviceDate',
          message: 'Service date is required for published funeral',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.deceased?.firstName?.trim() || !event.deceased?.lastName?.trim()) {
        errors.push({
          field: 'deceased',
          message: 'Deceased\'s full name is required for published funeral',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.locations?.service?.name?.trim()) {
        errors.push({
          field: 'locations.service.name',
          message: 'Service location is required for published funeral',
          code: 'REQUIRED_FIELD'
        })
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  private static validateGeneral(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // General events are very flexible - minimal requirements even for publish
    if (options.mode === 'publish') {
      if (!event.startDate && !event.description?.trim()) {
        warnings.push({
          field: 'startDate',
          message: 'Start date or detailed description recommended for published general event',
          code: 'RECOMMENDED_FIELD'
        })
      }
    }

    return { isValid: true, errors, warnings }
  }

  private static validateRecurring(event: any, options: ValidationOptions): EventValidationResult {
    const errors: EventValidationError[] = []
    const warnings: EventValidationError[] = []

    // Draft mode
    if (options.mode === 'draft') {
      if (!event.recurringConfig?.startDate && !event.recurringConfig?.dateRange?.start) {
        warnings.push({
          field: 'recurringConfig.startDate',
          message: 'Start date is recommended for recurring event',
          code: 'RECOMMENDED_FIELD'
        })
      }

      return { isValid: true, errors, warnings }
    }

    // Publish mode
    if (options.mode === 'publish') {
      if (!event.recurringConfig?.startDate && !event.recurringConfig?.dateRange?.start) {
        errors.push({
          field: 'recurringConfig.startDate',
          message: 'Start date is required for published recurring event',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.recurringConfig?.startTime || !event.recurringConfig?.endTime) {
        errors.push({
          field: 'recurringConfig.time',
          message: 'Start and end times are required for published recurring event',
          code: 'REQUIRED_FIELD'
        })
      }

      if (!event.recurringConfig?.daysOfWeek || event.recurringConfig.daysOfWeek.length === 0) {
        errors.push({
          field: 'recurringConfig.daysOfWeek',
          message: 'Days of week are required for published recurring event',
          code: 'REQUIRED_FIELD'
        })
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  /**
   * Get validation status for display
   */
  static getValidationStatus(event: Partial<Event>): {
    status: 'incomplete' | 'draft-ready' | 'publish-ready'
    message: string
    canSave: boolean
    canPublish: boolean
  } {
    if (!this.canSaveAsDraft(event)) {
      return {
        status: 'incomplete',
        message: 'Add basic information to save as draft',
        canSave: false,
        canPublish: false
      }
    }

    const publishValidation = this.canPublish(event)
    if (publishValidation.isValid) {
      return {
        status: 'publish-ready',
        message: 'Ready to publish',
        canSave: true,
        canPublish: true
      }
    }

    return {
      status: 'draft-ready',
      message: 'Saved as draft - add more details to publish',
      canSave: true,
      canPublish: false
    }
  }
}

export default EventValidator