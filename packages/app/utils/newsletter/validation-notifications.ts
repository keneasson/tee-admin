import { NewsletterRules, ValidationError, AssemblyValidation } from '@my/app/types/newsletter-rules'
import { NewsletterRulesValidator } from './rules-validator'

/**
 * Newsletter Validation and Notification System
 * Detects missing fields and unusual patterns, sends notifications to admin
 */
export class ValidationNotificationSystem {
  private rules: NewsletterRules
  private validator: NewsletterRulesValidator

  constructor(rules: NewsletterRules) {
    this.rules = rules
    this.validator = new NewsletterRulesValidator(rules)
  }

  /**
   * Validate newsletter content and send notifications if needed
   */
  async validateAndNotify(content: any, context: ValidationContext): Promise<ValidationResult> {
    const validation = this.validator.validateAssembledContent(content)
    const patterns = this.detectUnusualPatterns(content, context)
    
    // Combine validation errors with pattern warnings
    const allIssues = [...validation.missingFields, ...patterns.map(p => ({
      field: 'pattern_detection',
      service: 'validation',
      severity: 'warning' as const,
      message: p
    }))]

    // Send notifications if enabled and thresholds met
    if (this.shouldSendNotifications(validation, allIssues)) {
      await this.sendNotifications(validation, allIssues, context)
    }

    return {
      validation,
      unusualPatterns: patterns,
      notificationsSent: this.shouldSendNotifications(validation, allIssues),
      summary: this.createValidationSummary(validation, patterns)
    }
  }

  /**
   * Detect unusual patterns in newsletter content
   */
  private detectUnusualPatterns(content: any, context: ValidationContext): string[] {
    const patterns: string[] = []
    const enabledPatterns = this.rules.validation.notifications.unusualPatterns.patterns

    // Check for two consecutive weeks without memorial
    if (enabledPatterns.includes('no_memorial_two_weeks_consecutive')) {
      if (this.isConsecutiveWeeksWithoutMemorial(content, context)) {
        patterns.push('Two consecutive weeks without Memorial Service detected')
      }
    }

    // Check for no Bible Class scheduled
    if (enabledPatterns.includes('no_bible_class_scheduled')) {
      if (this.isNoBibleClassScheduled(content)) {
        patterns.push('No Bible Class scheduled for this week or next week')
      }
    }

    // Check for no upcoming events
    if (enabledPatterns.includes('no_events_upcoming')) {
      if (this.isNoEventsUpcoming(content)) {
        patterns.push('No upcoming events found - this may be unusual')
      }
    }

    // Check for missing Sunday School during active season
    if (this.isMissingSundaySchoolInSeason(content, context)) {
      patterns.push('Sunday School missing during active season (September-June)')
    }

    // Check for incomplete memorial service details
    if (this.isIncompleteMemorialDetails(content)) {
      patterns.push('Memorial service present but missing critical details')
    }

    // Check for unusual event concentration
    if (this.hasUnusualEventConcentration(content)) {
      patterns.push('Unusually high number of events scheduled - verify all are current')
    }

    return patterns
  }

  /**
   * Check if two consecutive weeks without memorial
   */
  private isConsecutiveWeeksWithoutMemorial(content: any, context: ValidationContext): boolean {
    const thisWeekMemorial = content.regularServices?.thisWeek?.sunday?.memorial
    const nextWeekMemorial = content.regularServices?.nextWeek?.sunday?.memorial
    
    // Also check last week if available in context
    const lastWeekMemorial = context.lastWeekContent?.regularServices?.thisWeek?.sunday?.memorial
    
    // Current week + next week
    if (!thisWeekMemorial && !nextWeekMemorial) {
      return true
    }
    
    // Last week + current week
    if (!lastWeekMemorial && !thisWeekMemorial) {
      return true
    }
    
    return false
  }

  /**
   * Check if no Bible Class scheduled
   */
  private isNoBibleClassScheduled(content: any): boolean {
    const thisWeekBC = content.regularServices?.thisWeek?.bibleClass
    const nextWeekBC = content.regularServices?.nextWeek?.bibleClass
    
    return !thisWeekBC && !nextWeekBC
  }

  /**
   * Check if no events upcoming
   */
  private isNoEventsUpcoming(content: any): boolean {
    return !content.events || content.events.length === 0
  }

  /**
   * Check if missing Sunday School during active season
   */
  private isMissingSundaySchoolInSeason(content: any, context: ValidationContext): boolean {
    const currentMonth = context.currentDate.getMonth() + 1
    const activeMonths = this.rules.mandatoryContent.sunday.sundaySchool.seasonalRules.active.months
    
    if (!activeMonths.includes(currentMonth)) {
      return false // Not in active season
    }
    
    const thisSundaySchool = content.regularServices?.thisWeek?.sunday?.sundaySchool
    return !thisSundaySchool || !thisSundaySchool.isActive
  }

  /**
   * Check for incomplete memorial details
   */
  private isIncompleteMemorialDetails(content: any): boolean {
    const memorial = content.regularServices?.thisWeek?.sunday?.memorial
    if (!memorial) return false
    
    const requiredFields = this.rules.mandatoryContent.sunday.memorial.requiredFields
    const missingCount = requiredFields.filter(field => !memorial[field] || memorial[field].trim() === '').length
    
    // Consider incomplete if more than 2 required fields missing
    return missingCount > 2
  }

  /**
   * Check for unusual event concentration
   */
  private hasUnusualEventConcentration(content: any): boolean {
    if (!content.events) return false
    
    // More than 5 events might be unusual
    return content.events.length > 5
  }

  /**
   * Determine if notifications should be sent
   */
  private shouldSendNotifications(validation: AssemblyValidation, allIssues: ValidationError[]): boolean {
    const missingFieldsConfig = this.rules.validation.notifications.missingFields
    const unusualPatternsConfig = this.rules.validation.notifications.unusualPatterns
    
    // Check missing fields notification threshold
    if (missingFieldsConfig.enabled) {
      const errors = allIssues.filter(issue => issue.severity === 'error')
      
      if (missingFieldsConfig.threshold === 'any_missing' && errors.length > 0) {
        return true
      }
      
      if (missingFieldsConfig.threshold === 'critical_only') {
        const criticalErrors = errors.filter(error => 
          error.service === 'memorial' || 
          error.service === 'bible_class' ||
          error.field.includes('requiredFields')
        )
        if (criticalErrors.length > 0) {
          return true
        }
      }
    }
    
    // Check unusual patterns notification
    if (unusualPatternsConfig.enabled) {
      const patternWarnings = allIssues.filter(issue => issue.field === 'pattern_detection')
      if (patternWarnings.length > 0) {
        return true
      }
    }
    
    // Check completeness score
    if (validation.completenessScore < this.rules.validation.completenessThresholds.acceptable) {
      return true
    }
    
    return false
  }

  /**
   * Send notifications to admin
   */
  private async sendNotifications(validation: AssemblyValidation, issues: ValidationError[], context: ValidationContext): Promise<void> {
    const notifications: NotificationMessage[] = []
    
    // Create notification message
    const message = this.createNotificationMessage(validation, issues, context)
    
    // Send based on configured methods
    const methods = new Set([
      this.rules.validation.notifications.missingFields.method,
      this.rules.validation.notifications.unusualPatterns.method
    ])
    
    for (const method of methods) {
      try {
        switch (method) {
          case 'email_admin':
            await this.sendEmailNotification(message, context)
            break
          case 'slack':
            await this.sendSlackNotification(message, context)
            break
          case 'dashboard':
            await this.sendDashboardNotification(message, context)
            break
        }
        
        notifications.push({
          method,
          sent: true,
          sentAt: new Date(),
          message: message.summary
        })
      } catch (error) {
        console.error(`Failed to send ${method} notification:`, error)
        notifications.push({
          method,
          sent: false,
          sentAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Log notification attempts
    console.log('Newsletter validation notifications sent:', notifications)
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(message: NotificationMessage, context: ValidationContext): Promise<void> {
    // This will integrate with the existing email system
    // For now, just log the notification
    console.log('📧 EMAIL NOTIFICATION:', {
      to: 'admin@torontoeast.ca',
      subject: message.subject,
      body: message.body,
      context: {
        newsletterDate: context.newsletterDate,
        generatedAt: context.generatedAt
      }
    })
    
    // TODO: Integrate with actual email sending system
    // await emailService.send({
    //   to: process.env.ADMIN_EMAIL,
    //   subject: message.subject,
    //   html: message.body
    // })
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(message: NotificationMessage, context: ValidationContext): Promise<void> {
    // TODO: Implement Slack webhook integration
    console.log('💬 SLACK NOTIFICATION:', {
      text: message.summary,
      attachments: [{
        color: message.severity === 'error' ? 'danger' : 'warning',
        fields: [
          { title: 'Newsletter Date', value: context.newsletterDate.toDateString(), short: true },
          { title: 'Completeness Score', value: `${message.completenessScore}%`, short: true }
        ]
      }]
    })
  }

  /**
   * Send dashboard notification
   */
  private async sendDashboardNotification(message: NotificationMessage, context: ValidationContext): Promise<void> {
    // TODO: Implement dashboard notification system
    console.log('📊 DASHBOARD NOTIFICATION:', {
      type: 'newsletter_validation',
      severity: message.severity,
      message: message.summary,
      details: message.details,
      timestamp: new Date()
    })
  }

  /**
   * Create notification message
   */
  private createNotificationMessage(validation: AssemblyValidation, issues: ValidationError[], context: ValidationContext): NotificationMessage {
    const errors = issues.filter(i => i.severity === 'error')
    const warnings = issues.filter(i => i.severity === 'warning')
    
    const severity = errors.length > 0 ? 'error' : 'warning'
    const scoreLevel = this.validator.getCompletenessLevel(validation.completenessScore)
    
    const subject = `Newsletter Validation Alert - ${context.newsletterDate.toDateString()}`
    const summary = `Newsletter validation found ${errors.length} errors and ${warnings.length} warnings (${validation.completenessScore}% complete)`
    
    const body = this.createEmailBody(validation, issues, context)
    
    return {
      subject,
      summary,
      body,
      severity,
      completenessScore: validation.completenessScore,
      details: {
        errors: errors.length,
        warnings: warnings.length,
        scoreLevel,
        readyToSend: validation.readyToSend
      }
    }
  }

  /**
   * Create detailed email body
   */
  private createEmailBody(validation: AssemblyValidation, issues: ValidationError[], context: ValidationContext): string {
    const errors = issues.filter(i => i.severity === 'error')
    const warnings = issues.filter(i => i.severity === 'warning')
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Newsletter Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
    .error { color: #d73527; }
    .warning { color: #f57c00; }
    .success { color: #388e3c; }
    .score { font-size: 18px; font-weight: bold; }
    ul { margin: 10px 0; }
    li { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Newsletter Validation Report</h2>
    <p><strong>Newsletter Date:</strong> ${context.newsletterDate.toDateString()}</p>
    <p><strong>Generated:</strong> ${context.generatedAt.toLocaleString()}</p>
    <p class="score"><strong>Completeness Score:</strong> 
      <span class="${validation.completenessScore >= 85 ? 'success' : validation.completenessScore >= 75 ? 'warning' : 'error'}">
        ${validation.completenessScore}%
      </span>
    </p>
    <p><strong>Ready to Send:</strong> ${validation.readyToSend ? '✅ Yes' : '❌ No'}</p>
  </div>

  ${errors.length > 0 ? `
  <h3 class="error">❌ Errors (${errors.length})</h3>
  <ul>
    ${errors.map(error => `<li class="error"><strong>${error.service}:</strong> ${error.message}</li>`).join('')}
  </ul>
  ` : ''}

  ${warnings.length > 0 ? `
  <h3 class="warning">⚠️ Warnings (${warnings.length})</h3>
  <ul>
    ${warnings.map(warning => `<li class="warning"><strong>${warning.service}:</strong> ${warning.message}</li>`).join('')}
  </ul>
  ` : ''}

  ${validation.warnings.length > 0 ? `
  <h3>ℹ️ Additional Notes</h3>
  <ul>
    ${validation.warnings.map(warning => `<li>${warning}</li>`).join('')}
  </ul>
  ` : ''}

  <hr>
  <p><small>This is an automated message from the Newsletter Assembly System. 
  Please review the newsletter content at <a href="${process.env.BASE_URL}/admin/newsletter/curate">/admin/newsletter/curate</a></small></p>
</body>
</html>
    `.trim()
  }

  /**
   * Create validation summary for dashboard
   */
  private createValidationSummary(validation: AssemblyValidation, patterns: string[]): ValidationSummary {
    const errors = validation.missingFields.filter(f => f.severity === 'error')
    const warnings = validation.missingFields.filter(f => f.severity === 'warning')
    
    return {
      completenessScore: validation.completenessScore,
      scoreLevel: this.validator.getCompletenessLevel(validation.completenessScore),
      readyToSend: validation.readyToSend,
      totalIssues: errors.length + warnings.length + patterns.length,
      breakdown: {
        errors: errors.length,
        warnings: warnings.length,
        patterns: patterns.length
      },
      mostCriticalIssues: [
        ...errors.slice(0, 3).map(e => e.message),
        ...patterns.slice(0, 2)
      ].slice(0, 5),
      recommendedActions: this.getRecommendedActions(validation, patterns)
    }
  }

  /**
   * Get recommended actions based on validation results
   */
  private getRecommendedActions(validation: AssemblyValidation, patterns: string[]): string[] {
    const actions: string[] = []
    
    if (validation.completenessScore < 50) {
      actions.push('Review and complete missing required fields before sending')
    }
    
    if (validation.missingFields.some(f => f.service === 'memorial')) {
      actions.push('Contact hall coordinator to confirm Memorial Service arrangements')
    }
    
    if (validation.missingFields.some(f => f.service === 'bible_class')) {
      actions.push('Confirm Bible Class speaker and topic details')
    }
    
    if (patterns.some(p => p.includes('consecutive weeks'))) {
      actions.push('Verify Memorial Service schedule - two weeks without service detected')
    }
    
    if (!validation.readyToSend) {
      actions.push('Address all errors before approving newsletter for sending')
    }
    
    return actions
  }
}

// Supporting types
export interface ValidationContext {
  currentDate: Date
  newsletterDate: Date
  generatedAt: Date
  lastWeekContent?: any
  dataSource: 'production' | 'test' | 'fallback'
}

export interface ValidationResult {
  validation: AssemblyValidation
  unusualPatterns: string[]
  notificationsSent: boolean
  summary: ValidationSummary
}

export interface NotificationMessage {
  subject: string
  summary: string
  body: string
  severity: 'error' | 'warning' | 'info'
  completenessScore: number
  details: {
    errors: number
    warnings: number
    scoreLevel: string
    readyToSend: boolean
  }
}

export interface ValidationSummary {
  completenessScore: number
  scoreLevel: string
  readyToSend: boolean
  totalIssues: number
  breakdown: {
    errors: number
    warnings: number
    patterns: number
  }
  mostCriticalIssues: string[]
  recommendedActions: string[]
}

interface NotificationMessage {
  method: string
  sent: boolean
  sentAt: Date
  message?: string
  error?: string
}