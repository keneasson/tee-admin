import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { render } from '@react-email/render'
import React from 'react'
import Newsletter from '../../../../../../email-builder/emails/Newsletter'

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
}))

interface ValidationResult {
  type: 'error' | 'warning' | 'info'
  category: 'content' | 'format' | 'links' | 'performance' | 'accessibility' | 'deliverability'
  eventId?: string
  message: string
  fix?: string
  priority: 'high' | 'medium' | 'low'
}

// POST /api/admin/newsletter/validate - Comprehensive newsletter validation
export async function POST(request: NextRequest) {
  try {
    const { newsletterId } = await request.json()

    if (!newsletterId) {
      return NextResponse.json(
        { success: false, error: 'Newsletter ID is required' },
        { status: 400 }
      )
    }

    // Get newsletter draft
    const { Item: newsletter } = await dynamoDb.get({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: 'NEWSLETTER_DRAFT',
        sk: `ID#${newsletterId}`
      }
    })

    if (!newsletter) {
      return NextResponse.json(
        { success: false, error: 'Newsletter draft not found' },
        { status: 404 }
      )
    }

    // Run comprehensive validation
    const validationResults: ValidationResult[] = []

    // 1. Content Validation
    await validateContent(newsletter, validationResults)

    // 2. Format Consistency Validation
    await validateFormatConsistency(newsletter, validationResults)

    // 3. Link Validation
    await validateLinks(newsletter, validationResults)

    // 4. Performance Validation
    await validatePerformance(newsletter, validationResults)

    // 5. Accessibility Validation
    await validateAccessibility(newsletter, validationResults)

    // 6. Deliverability Validation
    await validateDeliverability(newsletter, validationResults)

    // 7. Synchronization Validation
    await validateSynchronization(newsletter, validationResults)

    // Calculate validation summary
    const summary = {
      total: validationResults.length,
      errors: validationResults.filter(r => r.type === 'error').length,
      warnings: validationResults.filter(r => r.type === 'warning').length,
      infos: validationResults.filter(r => r.type === 'info').length,
      canSend: validationResults.filter(r => r.type === 'error' && r.priority === 'high').length === 0
    }

    return NextResponse.json({
      success: true,
      validation: {
        summary,
        results: validationResults,
        validatedAt: new Date().toISOString(),
        newsletterId,
        contentVersion: newsletter.contentVersion
      }
    })

  } catch (error) {
    console.error('Error validating newsletter:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to validate newsletter' },
      { status: 500 }
    )
  }
}

// Content validation
async function validateContent(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []

  for (const event of events) {
    // Check for missing email summaries when format is summary
    if (event.emailFormat === 'summary' && !event.emailSummary) {
      results.push({
        type: 'error',
        category: 'content',
        eventId: event.id,
        message: `Event "${event.title}" is set to summary format but missing email summary`,
        fix: 'Add an email summary or change format to "full"',
        priority: 'high'
      })
    }

    // Check for missing event page when required  
    if (event.requiresEventPage && !event.eventPageSlug) {
      results.push({
        type: 'error',
        category: 'content',
        eventId: event.id,
        message: `Event "${event.title}" requires an event page but no slug is set`,
        fix: 'Create an event page or disable "Requires Event Page"',
        priority: 'high'
      })
    }

    // Check CTA button configuration
    if (event.emailCTAs && event.emailCTAs.length > 0) {
      for (const cta of event.emailCTAs) {
        if (!cta.text || !cta.url) {
          results.push({
            type: 'error',
            category: 'content',
            eventId: event.id,
            message: `Event "${event.title}" has incomplete CTA button configuration`,
            fix: 'Complete CTA button text and URL, or remove the CTA',
            priority: 'medium'
          })
        }
      }
    }

    // Check for very long titles
    if (event.title.length > 80) {
      results.push({
        type: 'warning',
        category: 'content',
        eventId: event.id,
        message: `Event title "${event.title}" is very long (${event.title.length} chars)`,
        fix: 'Consider shortening the title for better display',
        priority: 'low'
      })
    }
  }

  // Check overall content structure
  if (events.length === 0) {
    results.push({
      type: 'warning',
      category: 'content',
      message: 'Newsletter has no events - this will generate an empty newsletter',
      fix: 'Add events from the Event Manager or create custom content',
      priority: 'medium'
    })
  }
}

// Format consistency validation
async function validateFormatConsistency(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []

  for (const event of events) {
    // Check consistency between email and web formats
    if (event.emailFormat === 'link_only' && event.webFormat === 'full') {
      results.push({
        type: 'warning',
        category: 'format',
        eventId: event.id,
        message: `Event "${event.title}" has inconsistent formatting: email link-only but web full`,
        fix: 'Consider making formats more consistent for better user experience',
        priority: 'low'
      })
    }

    // Check for event page format consistency
    if (event.webFormat === 'event_page_link' && !event.requiresEventPage) {
      results.push({
        type: 'error',
        category: 'format',
        eventId: event.id,
        message: `Event "${event.title}" web format is set to event page link but event page is not required`,
        fix: 'Enable "Requires Event Page" or change web format',
        priority: 'medium'
      })
    }
  }
}

// Link validation
async function validateLinks(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []
  const linksToCheck: string[] = []

  // Collect all links from events
  for (const event of events) {
    if (event.eventPageSlug) {
      linksToCheck.push(`/event/${event.eventPageSlug}`)
    }

    if (event.emailCTAs) {
      for (const cta of event.emailCTAs) {
        if (cta.url) {
          linksToCheck.push(cta.url)
        }
      }
    }
  }

  // Check internal links
  for (const link of linksToCheck) {
    if (link.startsWith('/event/')) {
      try {
        const slug = link.replace('/event/', '')
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/events/by-slug/${slug}`)
        
        if (!response.ok) {
          const eventWithLink = events.find(e => e.eventPageSlug === slug)
          results.push({
            type: 'error',
            category: 'links',
            eventId: eventWithLink?.id,
            message: `Event page link "${link}" returns ${response.status} error`,
            fix: 'Create the event page or update the link',
            priority: 'high'
          })
        }
      } catch (error) {
        results.push({
          type: 'warning',
          category: 'links',
          message: `Could not validate internal link "${link}"`,
          fix: 'Check link manually',
          priority: 'low'
        })
      }
    }
  }
}

// Performance validation
async function validatePerformance(newsletter: any, results: ValidationResult[]) {
  try {
    // Generate email HTML for size checking
    const events = newsletter.events?.map((e: any) => e.eventData) || []
    const emailHtml = await render(React.createElement(Newsletter, { events }))
    const emailSize = Buffer.byteLength(emailHtml, 'utf8')
    const emailSizeKB = emailSize / 1024

    // Check email size limits
    if (emailSizeKB > 102) {
      results.push({
        type: 'error',
        category: 'performance',
        message: `Email size is ${emailSizeKB.toFixed(1)}KB, exceeding Gmail's 102KB limit`,
        fix: 'Reduce content, optimize images, or split into multiple emails',
        priority: 'high'
      })
    } else if (emailSizeKB > 80) {
      results.push({
        type: 'warning',
        category: 'performance',
        message: `Email size is ${emailSizeKB.toFixed(1)}KB, approaching Gmail's 102KB limit`,
        fix: 'Consider reducing content to stay well under the limit',
        priority: 'medium'
      })
    }

    // Check for excessive events
    if (newsletter.events?.length > 10) {
      results.push({
        type: 'warning',
        category: 'performance',
        message: `Newsletter has ${newsletter.events.length} events, which may be too many`,
        fix: 'Consider prioritizing the most important events',
        priority: 'low'
      })
    }

  } catch (error) {
    results.push({
      type: 'warning',
      category: 'performance',
      message: 'Could not validate email performance - email generation failed',
      fix: 'Check email template and event data',
      priority: 'medium'
    })
  }
}

// Accessibility validation
async function validateAccessibility(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []

  // Check for descriptive event titles
  for (const event of events) {
    if (event.title.length < 10) {
      results.push({
        type: 'warning',
        category: 'accessibility',
        eventId: event.id,
        message: `Event title "${event.title}" is very short and may not be descriptive enough`,
        fix: 'Consider adding more descriptive information to the title',
        priority: 'low'
      })
    }
  }

  // Check for proper content structure
  const memorialEvents = events.filter((e: any) => e.type === 'memorial')
  const bibleClassEvents = events.filter((e: any) => e.type === 'bibleClass')

  if (memorialEvents.length === 0 && bibleClassEvents.length === 0) {
    results.push({
      type: 'info',
      category: 'accessibility',
      message: 'Newsletter contains no regular service information',
      fix: 'Consider adding memorial service or bible class information',
      priority: 'low'
    })
  }
}

// Deliverability validation
async function validateDeliverability(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []

  // Check for spam trigger words in titles
  const spamWords = ['free', 'urgent', 'act now', 'limited time', 'call now', 'click here']
  
  for (const event of events) {
    const titleLower = event.title.toLowerCase()
    const foundSpamWords = spamWords.filter(word => titleLower.includes(word))
    
    if (foundSpamWords.length > 0) {
      results.push({
        type: 'warning',
        category: 'deliverability',
        eventId: event.id,
        message: `Event title contains potential spam trigger words: ${foundSpamWords.join(', ')}`,
        fix: 'Consider rephrasing to avoid spam filters',
        priority: 'medium'
      })
    }
  }

  // Check for too many CTAs
  const totalCTAs = events.reduce((count: number, event: any) => {
    return count + (event.emailCTAs?.length || 0)
  }, 0)

  if (totalCTAs > 5) {
    results.push({
      type: 'warning',
      category: 'deliverability',
      message: `Newsletter has ${totalCTAs} CTA buttons, which may trigger spam filters`,
      fix: 'Consider reducing the number of call-to-action buttons',
      priority: 'medium'
    })
  }

  // Check newsletter timing
  const now = new Date()
  const newsletterDate = new Date(newsletter.date)
  const isThursday = newsletterDate.getDay() === 4

  if (!isThursday) {
    results.push({
      type: 'warning',
      category: 'deliverability',
      message: 'Newsletter is not scheduled for Thursday, which may affect engagement',
      fix: 'Consider scheduling for Thursday for consistency',
      priority: 'low'
    })
  }
}

// Synchronization validation
async function validateSynchronization(newsletter: any, results: ValidationResult[]) {
  const events = newsletter.events || []

  // Check last synchronization time
  const lastSync = new Date(newsletter.lastSynchronized)
  const now = new Date()
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)

  if (hoursSinceSync > 24) {
    results.push({
      type: 'warning',
      category: 'content',
      message: `Newsletter was last synchronized ${Math.round(hoursSinceSync)} hours ago`,
      fix: 'Refresh content to ensure latest event information',
      priority: 'medium'
    })
  }

  // Check for events with inconsistent data
  for (const event of events) {
    if (event.emailFormat === 'summary' && event.webFormat === 'full') {
      // This is actually valid - just informational
      results.push({
        type: 'info',
        category: 'format',
        eventId: event.id,
        message: `Event "${event.title}" shows summary in email but full content on web`,
        fix: 'This is valid but ensure consistency is intentional',
        priority: 'low'
      })
    }
  }

  // Validate content versions are in sync
  if (newsletter.contentVersion > 10) {
    results.push({
      type: 'info',
      category: 'content',
      message: `Newsletter has ${newsletter.contentVersion} content versions - consider finalizing`,
      fix: 'Review changes and schedule for sending if ready',
      priority: 'low'
    })
  }
}