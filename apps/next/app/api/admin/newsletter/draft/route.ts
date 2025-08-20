import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { EventService } from '@/utils/events'
import { v4 as uuidv4 } from 'uuid'

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
}))

const eventService = new EventService(dynamoDb)

// Helper function to get next Thursday
function getNextThursday(): Date {
  const now = new Date()
  const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7
  const nextThursday = new Date(now)
  nextThursday.setDate(now.getDate() + daysUntilThursday)
  nextThursday.setHours(0, 0, 0, 0)
  return nextThursday
}

// GET /api/admin/newsletter/draft - Get current newsletter draft
export async function GET() {
  try {
    // Get current Thursday's date
    const thursday = getNextThursday()
    const dateKey = thursday.toISOString().split('T')[0]
    
    console.log('Looking for newsletter draft for date:', dateKey)
    console.log('Using table:', process.env.DYNAMODB_TABLE_NAME || 'tee-admin')
    
    // Try to fetch existing draft
    const result = await dynamoDb.get({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
      Key: {
        pkey: 'NEWSLETTER_DRAFT',
        skey: `DATE#${dateKey}`
      }
    })

    console.log('DynamoDB result:', result)

    if (result.Item) {
      return NextResponse.json({
        success: true,
        newsletter: {
          id: result.Item.id,
          date: new Date(result.Item.date),
          status: result.Item.status,
          events: result.Item.events || [],
          lastSynchronized: new Date(result.Item.lastSynchronized),
          contentVersion: result.Item.contentVersion || 1
        }
      })
    }

    // No existing draft found - this is normal, the frontend will handle creating one
    return NextResponse.json({
      success: false,
      message: `No draft found for ${dateKey}`,
      createNew: true
    })

  } catch (error) {
    console.error('Error fetching newsletter draft:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch newsletter draft',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/admin/newsletter/draft - Create new newsletter draft
export async function POST(request: NextRequest) {
  try {
    const { date, autoGenerate } = await request.json()
    const draftDate = new Date(date)
    const dateKey = draftDate.toISOString().split('T')[0]
    const draftId = uuidv4()

    let events = []

    if (autoGenerate) {
      // Auto-generate newsletter content from Event Manager
      events = await generateNewsletterEvents(draftDate)
    }

    // Create newsletter draft
    const newsletterDraft = {
      pkey: 'NEWSLETTER_DRAFT',
      skey: `DATE#${dateKey}`,
      id: draftId,
      date: draftDate.toISOString(),
      status: 'draft',
      events,
      lastSynchronized: new Date().toISOString(),
      contentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    console.log('Creating newsletter draft:', newsletterDraft)

    await dynamoDb.put({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
      Item: newsletterDraft
    })

    return NextResponse.json({
      success: true,
      newsletter: {
        id: draftId,
        date: draftDate,
        status: 'draft',
        events,
        lastSynchronized: new Date(),
        contentVersion: 1
      }
    })

  } catch (error) {
    console.error('Error creating newsletter draft:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create newsletter draft' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/newsletter/draft - Update newsletter draft
export async function PUT(request: NextRequest) {
  try {
    const { id, events, contentVersion } = await request.json()

    // We need to find the draft by date since that's how we store it
    const thursday = getNextThursday()
    const dateKey = thursday.toISOString().split('T')[0]
    
    // Get current draft
    const { Item: existingDraft } = await dynamoDb.get({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
      Key: {
        pkey: 'NEWSLETTER_DRAFT',
        skey: `DATE#${dateKey}`
      }
    })

    if (!existingDraft) {
      return NextResponse.json(
        { success: false, error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Update draft
    const updatedDraft = {
      ...existingDraft,
      events,
      contentVersion: contentVersion + 1,
      lastSynchronized: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await dynamoDb.put({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: updatedDraft
    })

    return NextResponse.json({
      success: true,
      newsletter: {
        id: updatedDraft.id,
        date: new Date(updatedDraft.date),
        status: updatedDraft.status,
        events: updatedDraft.events,
        lastSynchronized: new Date(updatedDraft.lastSynchronized),
        contentVersion: updatedDraft.contentVersion
      }
    })

  } catch (error) {
    console.error('Error updating newsletter draft:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update newsletter draft' },
      { status: 500 }
    )
  }
}

// Helper function to generate newsletter events from Event Manager
async function generateNewsletterEvents(date: Date) {
  try {
    // Get events for the next 2 weeks
    const startDate = new Date(date)
    const endDate = new Date(date)
    endDate.setDate(endDate.getDate() + 14)

    console.log('Fetching events from', startDate, 'to', endDate)

    // Fetch events from Event Manager
    const events = await eventService.getEventsByDateRange(startDate, endDate)
    
    console.log('Found events:', events.length)
    
    // Transform events into newsletter format
    const newsletterEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      date: event.startDate || event.eventDate || new Date(),
      type: mapEventTypeToNewsletterType(event.type),
      status: event.status || 'published',
      priority: determinePriority(event),
      
      // Default format settings
      emailFormat: getDefaultEmailFormat(event.type),
      webFormat: getDefaultWebFormat(event.type),
      
      // Content versions
      emailContent: undefined,
      webContent: undefined,
      emailSummary: event.newsletter?.emailSummary,
      
      // Event page settings
      eventPageSlug: event.slug,
      requiresEventPage: shouldRequireEventPage(event.type),
      
      // CTAs
      emailCTAs: generateDefaultCTAs(event),
      
      // Raw event data for email template
      eventData: transformEventForTemplate(event)
    }))

    return newsletterEvents

  } catch (error) {
    console.error('Error generating newsletter events:', error)
    // Return a sample event for testing if the event service fails
    return [{
      id: 'sample-1',
      title: 'Sample Newsletter Event',
      date: new Date(),
      type: 'general',
      status: 'published',
      priority: 'medium',
      emailFormat: 'summary',
      webFormat: 'full',
      emailSummary: 'This is a sample event to test the newsletter curation interface.',
      requiresEventPage: false,
      emailCTAs: [],
      eventData: {
        Key: 'general',
        Date: new Date().toLocaleDateString(),
        Title: 'Sample Newsletter Event'
      }
    }]
  }
}

// Helper functions for event transformation
function mapEventTypeToNewsletterType(eventType: string): string {
  const typeMap: { [key: string]: string } = {
    'memorial-service': 'memorial',
    'bible-class': 'bibleClass',
    'sunday-school': 'sundaySchool',
    'bible-school': 'bibleSchool',
    'fraternal': 'fraternal',
    'study-weekend': 'special',
    'baptism': 'news',
    'wedding': 'news',
    'funeral': 'news'
  }
  
  return typeMap[eventType] || 'special'
}

function determinePriority(event: any): 'high' | 'medium' | 'low' {
  if (event.featured || event.type === 'bible-school') return 'high'
  if (['fraternal', 'study-weekend'].includes(event.type)) return 'medium'
  return 'low'
}

function getDefaultEmailFormat(eventType: string): 'summary' | 'full' | 'link_only' {
  const formatMap: { [key: string]: 'summary' | 'full' | 'link_only' } = {
    'memorial-service': 'full',
    'bible-class': 'full',
    'sunday-school': 'full',
    'bible-school': 'summary',
    'fraternal': 'summary',
    'study-weekend': 'summary',
    'baptism': 'full',
    'wedding': 'full',
    'funeral': 'full'
  }
  
  return formatMap[eventType] || 'summary'
}

function getDefaultWebFormat(eventType: string): 'full' | 'summary' | 'event_page_link' {
  const formatMap: { [key: string]: 'full' | 'summary' | 'event_page_link' } = {
    'bible-school': 'event_page_link',
    'fraternal': 'event_page_link',
    'study-weekend': 'event_page_link'
  }
  
  return formatMap[eventType] || 'full'
}

function shouldRequireEventPage(eventType: string): boolean {
  return ['bible-school', 'fraternal', 'study-weekend'].includes(eventType)
}

function generateDefaultCTAs(event: any) {
  const ctas = []
  
  if (event.registrationEnabled && event.registrationUrl) {
    ctas.push({
      text: 'Register Now',
      url: event.registrationUrl,
      style: 'primary'
    })
  }
  
  if (event.slug) {
    ctas.push({
      text: 'Full Details',
      url: `/event/${event.slug}`,
      style: 'secondary'
    })
  }
  
  return ctas
}

function transformEventForTemplate(event: any) {
  // Transform Event Manager data to newsletter template format
  // This depends on your Event Manager schema
  return {
    Key: mapEventTypeToTemplateKey(event.type),
    Date: event.startDate || event.eventDate,
    ...event // Include all event data
  }
}

function mapEventTypeToTemplateKey(eventType: string): string {
  const keyMap: { [key: string]: string } = {
    'memorial-service': 'memorial',
    'bible-class': 'bibleClass',
    'sunday-school': 'sundaySchool'
  }
  
  return keyMap[eventType] || 'general'
}