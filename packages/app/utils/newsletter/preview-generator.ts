import { 
  NewsletterRules, 
  NewsletterAssembly, 
  AssembledContent,
  EmailSection
} from '@my/app/types/newsletter-rules'
import { NewsletterAssemblyProcessor } from './assembly-processor'
import { ContentOrderingEngine } from './content-ordering'
import { BibleReadingsEmail, BibleReadingsWeb, generateWeekRange, generatePlainTextReadings, bibleReadingsEmailCSS } from './bible-readings-layout'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import newsletterRulesJson from '@my/app/config/newsletter-rules.json'

/**
 * Newsletter Preview Generator
 * Creates 90% complete newsletter previews in multiple formats
 */
export class NewsletterPreviewGenerator {
  private processor: NewsletterAssemblyProcessor
  private orderingEngine: ContentOrderingEngine
  private rules: NewsletterRules

  constructor(dynamoDb: DynamoDBDocument) {
    this.rules = newsletterRulesJson as NewsletterRules
    this.processor = new NewsletterAssemblyProcessor(this.rules, dynamoDb)
    this.orderingEngine = new ContentOrderingEngine(this.rules)
  }

  /**
   * Generate complete newsletter preview for a given date
   */
  async generatePreview(newsletterDate: Date, format: PreviewFormat = 'both'): Promise<NewsletterPreview> {
    console.log(`📰 Generating newsletter preview for ${newsletterDate.toDateString()}`)
    
    try {
      // Assemble the newsletter content
      const assembly = await this.processor.assembleNewsletter(newsletterDate)
      
      // Generate previews in requested formats
      const previews: NewsletterPreview = {
        assembly,
        metadata: this.generateMetadata(assembly),
        formats: {}
      }

      if (format === 'email' || format === 'both') {
        previews.formats.email = await this.generateEmailPreview(assembly)
      }

      if (format === 'web' || format === 'both') {
        previews.formats.web = await this.generateWebPreview(assembly)
      }

      if (format === 'plain' || format === 'both') {
        previews.formats.plain = this.generatePlainTextPreview(assembly)
      }

      console.log(`✅ Newsletter preview generated successfully (${assembly.validation.completenessScore}% complete)`)
      return previews

    } catch (error) {
      console.error('❌ Failed to generate newsletter preview:', error)
      throw new Error(`Newsletter preview generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate email-formatted preview
   */
  private async generateEmailPreview(assembly: NewsletterAssembly): Promise<EmailPreview> {
    const { content } = assembly
    const sections = this.orderingEngine.createEmailSections(content)
    
    // Generate HTML structure
    const htmlSections = await Promise.all(
      sections.map(section => this.generateEmailSection(section, content))
    )

    const html = this.wrapEmailHTML(htmlSections.join('\n'))
    const css = this.generateEmailCSS()
    
    return {
      html,
      css,
      plainText: this.generatePlainTextPreview(assembly).content,
      subject: this.generateEmailSubject(assembly),
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        priority: s.priority,
        wordCount: this.estimateWordCount(s)
      })),
      estimatedLength: this.estimateEmailLength(html),
      deliverabilityScore: this.calculateDeliverabilityScore(html)
    }
  }

  /**
   * Generate web-formatted preview
   */
  private async generateWebPreview(assembly: NewsletterAssembly): Promise<WebPreview> {
    const { content } = assembly
    const sections = this.orderingEngine.createEmailSections(content)
    
    // Generate web-optimized HTML
    const htmlSections = await Promise.all(
      sections.map(section => this.generateWebSection(section, content))
    )

    const html = this.wrapWebHTML(htmlSections.join('\n'))
    
    return {
      html,
      css: this.generateWebCSS(),
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        priority: s.priority,
        wordCount: this.estimateWordCount(s)
      })),
      estimatedReadingTime: this.estimateReadingTime(html),
      seoScore: this.calculateSEOScore(assembly)
    }
  }

  /**
   * Generate plain text preview
   */
  private generatePlainTextPreview(assembly: NewsletterAssembly): PlainTextPreview {
    const { content } = assembly
    let text = `TORONTO EAST NEWSLETTER\n${assembly.date.toDateString()}\n\n`
    text += `This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.\nAll plans are subject to God's will.\n\n`

    // Daily Readings
    if (content.dailyReadings?.length > 0) {
      text += generatePlainTextReadings(content.dailyReadings)
      text += '\n\n'
    }

    // Regular Services
    if (content.regularServices) {
      text += this.generatePlainTextServices(content.regularServices)
      text += '\n\n'
    }

    // Events
    if (content.events?.length > 0) {
      text += 'UPCOMING EVENTS\n\n'
      content.events.forEach(event => {
        text += `${event.title}\n`
        if (event.eventDate) {
          text += `Date: ${event.eventDate.toDateString()}\n`
        }
        text += `${event.content}\n\n`
      })
    }

    // Standing Content
    if (content.standingContent?.length > 0) {
      content.standingContent.forEach(standing => {
        text += `${standing.title}\n`
        text += `${standing.schedule}\n`
        text += `${standing.description}\n\n`
      })
    }

    return {
      content: text,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length
    }
  }

  /**
   * Generate email section HTML
   */
  private async generateEmailSection(section: EmailSection, content: AssembledContent): Promise<string> {
    switch (section.type) {
      case 'readings_table':
        const BibleReadingsEmailModule = await import('./bible-readings-layout')
        const weekRange = BibleReadingsEmailModule.generateWeekRange(content.dailyReadings)
        return this.renderReactToString(
          BibleReadingsEmailModule.BibleReadingsEmail({
            readings: content.dailyReadings,
            weekRange,
            title: section.title
          })
        )

      case 'bible_class':
        return this.generateBibleClassHTML(section.content, section.title)

      case 'sunday_services':
        return this.generateSundayServicesHTML(section.content, section.title)

      case 'events':
        return this.generateEventsHTML(section.content, section.title)

      case 'standing_content':
        return this.generateStandingContentHTML(section.content, section.title)

      default:
        return `<div><h3>${section.title}</h3><p>Section type not implemented: ${section.type}</p></div>`
    }
  }

  /**
   * Generate web section HTML
   */
  private async generateWebSection(section: EmailSection, content: AssembledContent): Promise<string> {
    switch (section.type) {
      case 'readings_table':
        const BibleReadingsWebModule = await import('./bible-readings-layout')
        const weekRange = BibleReadingsWebModule.generateWeekRange(content.dailyReadings)
        return this.renderReactToString(
          BibleReadingsWebModule.BibleReadingsWeb({
            readings: content.dailyReadings,
            weekRange,
            title: section.title
          })
        )

      default:
        // For web, we can reuse email sections with different styling
        return this.generateEmailSection(section, content)
    }
  }

  /**
   * Generate Bible Class section HTML
   */
  private generateBibleClassHTML(bibleClass: any, title: string): string {
    if (!bibleClass) {
      return `<div style="margin: 20px 0;"><h3>${title}</h3><p>No Bible Class scheduled</p></div>`
    }

    return `
      <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
        <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #000; padding-bottom: 5px;">
          ${title} for ${new Date(bibleClass.date).toDateString()} at 7:30pm - on Zoom
        </h3>
        <p style="margin: 10px 0; line-height: 1.5;">
          <strong>Speaker:</strong> ${bibleClass.speaker}<br>
          <strong>Topic:</strong> ${bibleClass.topic}
          ${bibleClass.presider ? `<br><strong>Presiding:</strong> ${bibleClass.presider}` : ''}
          ${bibleClass.notes ? `<br><em>${bibleClass.notes}</em>` : ''}
        </p>
      </div>
    `
  }

  /**
   * Generate Sunday Services section HTML
   */
  private generateSundayServicesHTML(sunday: any, title: string): string {
    if (!sunday) {
      return `<div style="margin: 20px 0;"><h3>${title}</h3><p>No services scheduled</p></div>`
    }

    let html = `<div style="margin: 20px 0;"><h3 style="color: #333;">${title}</h3>`

    // Sunday School
    if (sunday.sundaySchool) {
      const ss = sunday.sundaySchool
      if (ss.isActive) {
        html += `
          <div style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #333;">Sunday School at 9:30am</h4>
            <p><strong>Refreshments:</strong> ${ss.Refreshments || 'TBD'}</p>
            ${ss['Holidays and Special Events'] ? `<p><strong>${ss['Holidays and Special Events']}</strong></p>` : ''}
          </div>
          <hr style="border: 0; height: 1px; background: #333; margin: 10px 0;">
        `
      } else {
        html += `<p style="color: #666; font-style: italic;">${ss.inactiveMessage}</p>`
      }
    }

    // Memorial Service
    if (sunday.memorial) {
      const memorial = sunday.memorial
      if (memorial.isException) {
        html += `
          <div style="margin: 15px 0; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #856404;">Memorial Service at 11:00am</h4>
            <p style="font-weight: bold; color: #856404;">${memorial.exceptionMessage}</p>
          </div>
        `
      } else {
        html += `
          <div style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
            <h4 style="margin-top: 0; color: #333;">Memorial Service at 11:00am</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 5px 0;"><strong>Presiding:</strong> ${memorial.Preside || 'TBD'}</p>
                <p style="margin: 5px 0;"><strong>Exhorting:</strong> ${memorial.Exhort || 'TBD'}</p>
                <p style="margin: 5px 0;"><strong>Keyboardist:</strong> ${memorial.Organist || 'TBD'}</p>
                <p style="margin: 5px 0;"><strong>Steward:</strong> ${memorial.Steward || 'TBD'}</p>
                <p style="margin: 5px 0;"><strong>Doorkeeper:</strong> ${memorial.Doorkeeper || 'TBD'}</p>
              </div>
              ${memorial.hymns ? `
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 5px 0;"><strong>Opening Hymn:</strong> ${memorial.hymns.opening}</p>
                <p style="margin: 5px 0;"><strong>Exhortation Hymn:</strong> ${memorial.hymns.exhortation}</p>
                <p style="margin: 5px 0;"><strong>Memorial Hymn:</strong> ${memorial.hymns.memorial}</p>
                <p style="margin: 5px 0;"><strong>Closing Hymn:</strong> ${memorial.hymns.closing}</p>
              </div>
              ` : ''}
            </div>
            ${memorial.collection ? `<p style="margin: 10px 0 5px 0;"><strong>Second Collection for:</strong> ${memorial.collection}</p>` : '<p style="margin: 10px 0 5px 0;">No Second Collection</p>'}
            ${memorial.lunch ? `<p style="margin: 5px 0; font-weight: bold;">${memorial.lunch}</p>` : ''}
          </div>
        `
      }
    }

    html += '</div>'
    return html
  }

  /**
   * Generate Events section HTML
   */
  private generateEventsHTML(events: any[], title: string): string {
    if (!events || events.length === 0) {
      return ''
    }

    let html = `<div style="margin: 20px 0;"><h3 style="color: #333;">${title}</h3>`

    events.forEach(event => {
      html += `
        <div style="margin: 15px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 0 5px 5px 0;">
          <h4 style="margin-top: 0; color: #007bff;">${event.title}</h4>
          ${event.eventDate ? `<p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Date:</strong> ${new Date(event.eventDate).toDateString()}</p>` : ''}
          <div style="margin: 10px 0;">
            ${event.displayType === 'summary' && event.summary ? event.summary : event.content}
          </div>
          ${event.ctaButton ? `
            <div style="margin: 10px 0;">
              <a href="${event.ctaButton.url}" style="display: inline-block; padding: 8px 16px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                ${event.ctaButton.text}
              </a>
            </div>
          ` : ''}
        </div>
      `
    })

    html += '</div>'
    return html
  }

  /**
   * Generate Standing Content section HTML
   */
  private generateStandingContentHTML(standingContent: any[], title: string): string {
    if (!standingContent || standingContent.length === 0) {
      return ''
    }

    let html = `<div style="margin: 20px 0;"><h3 style="color: #333;">${title}</h3>`

    standingContent.forEach(content => {
      html += `
        <div style="margin: 15px 0; padding: 15px; background-color: #f0f8ff; border-radius: 5px;">
          <h4 style="margin-top: 0; color: #333;">${content.title}</h4>
          <p style="margin: 5px 0; font-weight: bold; color: #666;">${content.schedule}</p>
          <p style="margin: 10px 0;">${content.description}</p>
        </div>
      `
    })

    html += '</div>'
    return html
  }

  /**
   * Generate plain text services section
   */
  private generatePlainTextServices(services: any): string {
    let text = 'REGULAR SERVICES\n\n'

    // This Week
    if (services.thisWeek) {
      text += 'This Week:\n'
      
      if (services.thisWeek.sunday?.memorial) {
        const memorial = services.thisWeek.sunday.memorial
        text += `Memorial Service - ${new Date(memorial.date).toDateString()} at 11:00am\n`
        if (memorial.isException) {
          text += `  ${memorial.exceptionMessage}\n`
        } else {
          text += `  Presiding: ${memorial.preside}\n`
          text += `  Exhorting: ${memorial.exhort}\n`
        }
        text += '\n'
      }

      if (services.thisWeek.bibleClass) {
        const bc = services.thisWeek.bibleClass
        text += `Bible Class - ${new Date(bc.date).toDateString()} at 7:30pm on Zoom\n`
        text += `  Speaker: ${bc.speaker}\n`
        text += `  Topic: ${bc.topic}\n\n`
      }
    }

    return text
  }

  /**
   * Wrap email HTML with proper structure
   */
  private wrapEmailHTML(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toronto East Newsletter</title>
  <style>${bibleReadingsEmailCSS}</style>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
      <h1 style="color: #333; margin: 0 0 10px 0;">Toronto East Newsletter</h1>
      <p style="color: #666; margin: 0; font-size: 14px;">${new Date().toDateString()}</p>
      <p style="color: #666; margin: 10px 0 0 0; font-size: 14px; font-style: italic;">
        This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.<br>
        All plans are subject to God's will.
      </p>
    </div>
    
    ${content}
    
    <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0;">Toronto East Christadelphian Ecclesia</p>
      <p style="margin: 5px 0 0 0;">1344 Danforth Ave, Toronto, ON M4J 1M9</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Wrap web HTML with proper structure
   */
  private wrapWebHTML(content: string): string {
    return `
<div class="newsletter-web-container">
  <div class="newsletter-header">
    <h1>Toronto East Newsletter</h1>
    <p class="newsletter-date">${new Date().toDateString()}</p>
    <p class="newsletter-subtitle">
      This newsletter is for Christadelphians and friends, whether we meet in person or on Zoom.<br>
      All plans are subject to God's will.
    </p>
  </div>
  
  <div class="newsletter-content">
    ${content}
  </div>
</div>
    `.trim()
  }

  /**
   * Generate email CSS
   */
  private generateEmailCSS(): string {
    return bibleReadingsEmailCSS + `
/* Additional email-specific styles */
.email-container {
  max-width: 600px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
}

@media only screen and (max-width: 600px) {
  .email-container {
    padding: 10px !important;
  }
}
    `
  }

  /**
   * Generate web CSS
   */
  private generateWebCSS(): string {
    return `
.newsletter-web-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

.newsletter-header {
  text-align: center;
  margin-bottom: 40px;
  padding: 30px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 10px;
}

.newsletter-header h1 {
  color: #212529;
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  font-weight: 700;
}

.newsletter-date {
  color: #6c757d;
  font-size: 1.1rem;
  margin: 0 0 15px 0;
}

.newsletter-subtitle {
  color: #495057;
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
  font-style: italic;
}

.newsletter-content {
  margin: 20px 0;
}

@media (max-width: 768px) {
  .newsletter-header h1 {
    font-size: 2rem;
  }
  
  .newsletter-web-container {
    padding: 15px;
  }
}
    `
  }

  /**
   * Generate metadata about the newsletter
   */
  private generateMetadata(assembly: NewsletterAssembly): NewsletterMetadata {
    const { content, validation } = assembly
    
    return {
      generatedAt: assembly.assemblyDate,
      newsletterDate: assembly.date,
      status: assembly.status,
      completenessScore: validation.completenessScore,
      readyToSend: validation.readyToSend,
      contentSummary: {
        totalEvents: content.events?.length || 0,
        hasRegularServices: !!(content.regularServices?.thisWeek),
        hasReadings: !!(content.dailyReadings?.length),
        hasStandingContent: !!(content.standingContent?.length),
        estimatedWordCount: this.estimateContentWordCount(content)
      },
      validationSummary: {
        errorCount: validation.missingFields.filter(f => f.severity === 'error').length,
        warningCount: validation.missingFields.filter(f => f.severity === 'warning').length,
        criticalIssues: validation.missingFields
          .filter(f => f.severity === 'error')
          .slice(0, 3)
          .map(f => f.message)
      }
    }
  }

  /**
   * Generate email subject line
   */
  private generateEmailSubject(assembly: NewsletterAssembly): string {
    const date = assembly.date
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    
    return `Toronto East Newsletter - ${formattedDate}`
  }

  // Utility methods
  private renderReactToString(component: any): string {
    // For now, return a placeholder - in production this would use server-side rendering
    return `<div>React component render placeholder</div>`
  }

  private estimateWordCount(section: EmailSection): number {
    // Rough estimation based on section type
    switch (section.type) {
      case 'readings_table': return 50
      case 'bible_class': return 30
      case 'sunday_services': return 80
      case 'events': return Array.isArray(section.content) ? section.content.length * 40 : 40
      case 'standing_content': return Array.isArray(section.content) ? section.content.length * 25 : 25
      default: return 20
    }
  }

  private estimateEmailLength(html: string): { characters: number, estimatedKB: number } {
    const characters = html.length
    const estimatedKB = Math.round(characters / 1024 * 100) / 100
    return { characters, estimatedKB }
  }

  private estimateReadingTime(html: string): number {
    const wordCount = html.replace(/<[^>]*>/g, '').split(/\s+/).length
    return Math.ceil(wordCount / 200) // 200 words per minute
  }

  private estimateContentWordCount(content: AssembledContent): number {
    let total = 0
    total += content.events?.reduce((sum, event) => sum + (event.content?.split(/\s+/).length || 0), 0) || 0
    total += content.standingContent?.reduce((sum, standing) => sum + (standing.description?.split(/\s+/).length || 0), 0) || 0
    total += 100 // Estimate for regular services
    total += 50  // Estimate for readings
    return total
  }

  private calculateDeliverabilityScore(html: string): number {
    let score = 100
    
    // Penalize for very long emails
    if (html.length > 100000) score -= 20
    
    // Penalize for many images (not implemented in our layout)
    // Penalize for spam words (basic check)
    const spamWords = ['free', 'urgent', 'limited time', '!!!']
    const spamCount = spamWords.reduce((count, word) => 
      count + (html.toLowerCase().split(word).length - 1), 0)
    score -= spamCount * 5
    
    return Math.max(20, score)
  }

  private calculateSEOScore(assembly: NewsletterAssembly): number {
    let score = 100
    
    // Check for proper heading structure
    if (!assembly.content.events?.length) score -= 10
    
    // Check for meta information
    if (!assembly.content.regularServices) score -= 20
    
    return Math.max(0, score)
  }
}

// Supporting types
export type PreviewFormat = 'email' | 'web' | 'plain' | 'both'

export interface NewsletterPreview {
  assembly: NewsletterAssembly
  metadata: NewsletterMetadata
  formats: {
    email?: EmailPreview
    web?: WebPreview
    plain?: PlainTextPreview
  }
}

export interface EmailPreview {
  html: string
  css: string
  plainText: string
  subject: string
  sections: Array<{
    id: string
    title: string
    type: string
    priority: number
    wordCount: number
  }>
  estimatedLength: { characters: number, estimatedKB: number }
  deliverabilityScore: number
}

export interface WebPreview {
  html: string
  css: string
  sections: Array<{
    id: string
    title: string
    type: string
    priority: number
    wordCount: number
  }>
  estimatedReadingTime: number
  seoScore: number
}

export interface PlainTextPreview {
  content: string
  wordCount: number
  characterCount: number
}

export interface NewsletterMetadata {
  generatedAt: Date
  newsletterDate: Date
  status: string
  completenessScore: number
  readyToSend: boolean
  contentSummary: {
    totalEvents: number
    hasRegularServices: boolean
    hasReadings: boolean
    hasStandingContent: boolean
    estimatedWordCount: number
  }
  validationSummary: {
    errorCount: number
    warningCount: number
    criticalIssues: string[]
  }
}