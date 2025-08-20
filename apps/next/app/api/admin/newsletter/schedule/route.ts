import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
}))

// POST /api/admin/newsletter/schedule - Schedule newsletter for sending
export async function POST(request: NextRequest) {
  try {
    const { newsletterId, scheduledFor } = await request.json()
    
    if (!newsletterId || !scheduledFor) {
      return NextResponse.json(
        { success: false, error: 'Newsletter ID and scheduled time required' },
        { status: 400 }
      )
    }

    const scheduledDate = new Date(scheduledFor)
    
    // Validate scheduling time (should be Thursday 7 PM)
    if (scheduledDate.getDay() !== 4 || scheduledDate.getHours() !== 19) {
      return NextResponse.json(
        { success: false, error: 'Newsletter must be scheduled for Thursday 7 PM' },
        { status: 400 }
      )
    }

    // Get the newsletter draft
    const { Item: draft } = await dynamoDb.get({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: 'NEWSLETTER_DRAFT',
        sk: `ID#${newsletterId}`
      }
    })

    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'Newsletter draft not found' },
        { status: 404 }
      )
    }

    // Create email queue entry
    const queueId = uuidv4()
    const queueItem = {
      pk: 'EMAIL_QUEUE',
      sk: `SCHEDULED#${scheduledDate.toISOString()}#${queueId}`,
      id: queueId,
      type: 'newsletter-final',
      scheduledFor: scheduledDate.toISOString(),
      status: 'queued',
      priority: 4, // Newsletter has priority 4 as per Phase 5 spec
      attempts: 0,
      maxAttempts: 3,
      
      // Email content
      recipients: [], // Will be populated when processing
      template: 'newsletter',
      templateData: {
        events: draft.events.map((e: any) => e.eventData)
      },
      
      // Newsletter reference
      newsletterId: draft.id,
      newsletterVersion: draft.contentVersion,
      
      // Tracking
      createdAt: new Date().toISOString(),
      createdBy: 'admin', // TODO: Get from auth context
    }

    // Save to queue
    await dynamoDb.put({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: queueItem
    })

    // Update newsletter status
    await dynamoDb.update({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: 'NEWSLETTER_DRAFT', 
        sk: `ID#${newsletterId}`
      },
      UpdateExpression: 'SET #status = :status, scheduledFor = :scheduledFor, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'scheduled',
        ':scheduledFor': scheduledDate.toISOString(),
        ':updatedAt': new Date().toISOString()
      }
    })

    // Also create QA test email if it's more than 3 hours before send time
    const now = new Date()
    const hoursUntilSend = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntilSend > 3) {
      const qaQueueId = uuidv4()
      const qaTestTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
      
      const qaQueueItem = {
        pk: 'EMAIL_QUEUE',
        sk: `SCHEDULED#${qaTestTime.toISOString()}#${qaQueueId}`,
        id: qaQueueId,
        type: 'newsletter-qa',
        scheduledFor: qaTestTime.toISOString(),
        status: 'queued',
        priority: 2, // QA has priority 2
        attempts: 0,
        maxAttempts: 2,
        
        // Email content
        recipients: ['admin@tee-admin.com'], // TODO: Get admin emails from config
        template: 'newsletter',
        templateData: {
          events: draft.events.map((e: any) => e.eventData),
          isQATest: true
        },
        
        // Newsletter reference
        newsletterId: draft.id,
        newsletterVersion: draft.contentVersion,
        
        // Tracking
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      }

      await dynamoDb.put({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: qaQueueItem
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter scheduled successfully',
      scheduledFor: scheduledDate.toISOString(),
      queueId
    })

  } catch (error) {
    console.error('Error scheduling newsletter:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to schedule newsletter' },
      { status: 500 }
    )
  }
}

// GET /api/admin/newsletter/schedule - Get scheduled newsletters
export async function GET() {
  try {
    // Query for scheduled newsletters
    const { Items: queueItems } = await dynamoDb.query({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#type IN (:newsletter_final, :newsletter_qa)',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':pk': 'EMAIL_QUEUE',
        ':newsletter_final': 'newsletter-final',
        ':newsletter_qa': 'newsletter-qa'
      }
    })

    const scheduledNewsletters = queueItems?.map(item => ({
      id: item.id,
      type: item.type,
      scheduledFor: new Date(item.scheduledFor),
      status: item.status,
      priority: item.priority,
      attempts: item.attempts,
      newsletterId: item.newsletterId,
      createdAt: new Date(item.createdAt)
    })) || []

    return NextResponse.json({
      success: true,
      scheduledNewsletters
    })

  } catch (error) {
    console.error('Error fetching scheduled newsletters:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled newsletters' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/newsletter/schedule - Cancel scheduled newsletter
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queueId = searchParams.get('queueId')
    
    if (!queueId) {
      return NextResponse.json(
        { success: false, error: 'Queue ID required' },
        { status: 400 }
      )
    }

    // Find and delete the queue item
    const { Items: queueItems } = await dynamoDb.query({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'id = :queueId',
      ExpressionAttributeValues: {
        ':pk': 'EMAIL_QUEUE',
        ':queueId': queueId
      }
    })

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Scheduled email not found' },
        { status: 404 }
      )
    }

    const queueItem = queueItems[0]
    
    // Can only cancel if not already sending or sent
    if (['sending', 'sent'].includes(queueItem.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel email that is already sending or sent' },
        { status: 400 }
      )
    }

    // Delete the queue item
    await dynamoDb.delete({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: queueItem.pk,
        sk: queueItem.sk
      }
    })

    // Update newsletter status back to draft if this was the main send
    if (queueItem.type === 'newsletter-final') {
      await dynamoDb.update({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: {
          pk: 'NEWSLETTER_DRAFT',
          sk: `ID#${queueItem.newsletterId}`
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt REMOVE scheduledFor',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'draft',
          ':updatedAt': new Date().toISOString()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled newsletter cancelled successfully'
    })

  } catch (error) {
    console.error('Error cancelling scheduled newsletter:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel scheduled newsletter' },
      { status: 500 }
    )
  }
}