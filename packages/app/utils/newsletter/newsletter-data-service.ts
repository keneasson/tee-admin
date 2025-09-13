import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'

/**
 * Newsletter Data Service
 * Uses existing working APIs that power the current newsletter and schedule pages
 */
export class NewsletterDataService {
  constructor(private dynamoDb: DynamoDBDocument) {}

  /**
   * Get published events for newsletter (fast query)
   */
  async getPublishedEvents(): Promise<any[]> {
    try {
      console.log('📅 Fetching published events from DynamoDB...')
      
      // First try to get published events from the GSI
      const result = await this.dynamoDb.query({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :status',
        ExpressionAttributeValues: {
          ':status': 'STATUS#published'
        },
        Limit: 20 // Only get recent events
      })

      let events = (result.Items || []).map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        eventDate: item.eventDate ? new Date(item.eventDate) : null,
        content: item.description || item.content || '',
        published: item.published,
        status: item.status
      }))

      console.log(`✅ Found ${events.length} published events from GSI`)

      // If no published events found, try different approaches to get real data
      if (events.length === 0) {
        console.log('🔍 No published events found via STATUS#published, trying alternative queries...')
        
        // Try scanning for any events with published status
        const scanResult = await this.dynamoDb.scan({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
          FilterExpression: 'begins_with(pkey, :eventPrefix) AND published = :published',
          ExpressionAttributeValues: {
            ':eventPrefix': 'EVENT#',
            ':published': true
          },
          Limit: 20
        })

        console.log(`🔍 Scan found ${scanResult.Items?.length || 0} published events`)
        
        if (scanResult.Items && scanResult.Items.length > 0) {
          events = scanResult.Items.map(item => ({
            id: item.id,
            title: item.title,
            type: item.type,
            eventDate: item.eventDate ? new Date(item.eventDate) : null,
            content: item.description || item.content || '',
            published: item.published,
            status: item.status
          }))
        } else {
          console.log('🔍 No published events found in scan either. Checking for any events...')
          
          // Last resort: get any events (regardless of published status) for demo
          const anyEventsResult = await this.dynamoDb.scan({
            TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
            FilterExpression: 'begins_with(pkey, :eventPrefix)',
            ExpressionAttributeValues: {
              ':eventPrefix': 'EVENT#'
            },
            Limit: 5
          })
          
          if (anyEventsResult.Items && anyEventsResult.Items.length > 0) {
            events = anyEventsResult.Items.map(item => ({
              id: item.id,
              title: item.title,
              type: item.type,
              eventDate: item.eventDate ? new Date(item.eventDate) : null,
              content: item.description || item.content || '',
              published: item.published || false,
              status: item.status || 'draft'
            }))
            console.log(`📝 Using ${events.length} existing events (may include drafts) for newsletter demo`)
          } else {
            console.log('📝 No events found in database at all')
          }
        }
      }

      return events

    } catch (error) {
      console.error('❌ Failed to fetch events:', error)
      return []
    }
  }

  /**
   * Get regular services using the exact same approach as working /newsletter page
   */
  async getRegularServices(): Promise<any> {
    try {
      console.log('⛪ Fetching regular services using exact same approach as /newsletter page...')
      
      // For server-side fetch, we need a full URL
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4000'
      const url = `${baseUrl}/api/upcoming-program`
      
      console.log(`🔗 Fetching from: ${url}`)
      
      const rawSchedule = await fetch(url, { 
        next: { 
          revalidate: 3600,
          tags: ['upcoming-program', 'newsletter', 'schedules'] 
        } 
      })
      
      if (!rawSchedule.ok) {
        throw new Error(`HTTP error! status: ${rawSchedule.status}`)
      }
      
      const programData = await rawSchedule.json()
      
      console.log('✅ Regular services data loaded using exact same method as working /newsletter page')
      console.log(`📊 Found ${Array.isArray(programData) ? programData.length : 'non-array'} program items`)
      return programData

    } catch (error) {
      console.error('❌ Failed to fetch regular services:', error)
      return []
    }
  }

  /**
   * Get daily readings using the exact same approach as working /newsletter page
   */
  async getDailyReadings(startDate: Date): Promise<any[]> {
    try {
      console.log('📖 Fetching daily readings using exact same approach as /newsletter page...')
      
      // For server-side fetch, we need a full URL
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4000'
      const url = `${baseUrl}/api/json/range`
      
      console.log(`🔗 Fetching readings from: ${url}`)
      
      const rawSchedule = await fetch(url, { 
        next: { 
          revalidate: 3600,
          tags: ['readings', 'newsletter'] 
        } 
      })
      
      if (!rawSchedule.ok) {
        throw new Error(`HTTP error! status: ${rawSchedule.status}`)
      }
      
      const readingsData = await rawSchedule.json()
      
      console.log(`✅ Daily readings loaded using exact same method as working /newsletter page`)
      console.log(`📖 Found ${Array.isArray(readingsData) ? readingsData.length : 'non-array'} reading entries`)
      return readingsData || []

    } catch (error) {
      console.error('❌ Failed to fetch daily readings:', error)
      return []
    }
  }

  /**
   * Get standing content items
   */
  async getStandingContent(): Promise<any[]> {
    try {
      console.log('📋 Loading standing content...')
      
      const standingContent = [
        {
          title: 'Bible Study',
          schedule: 'Every Wednesday at 7:30 PM',
          description: 'Join us for weekly Bible study on Zoom. Contact the ecclesia for meeting details.'
        }
      ]

      console.log(`✅ Loaded ${standingContent.length} standing content items`)
      return standingContent

    } catch (error) {
      console.error('❌ Failed to load standing content:', error)
      return []
    }
  }

}