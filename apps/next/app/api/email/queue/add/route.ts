/**
 * Add Job to Email Queue API
 * Allows adding new email jobs to the queue
 */

import { NextRequest, NextResponse } from 'next/server'
import { EmailQueueProcessor } from '@/utils/email'

interface AddJobRequest {
  type: 'bible-class' | 'recap' | 'newsletter-draft' | 'newsletter-qa' | 'newsletter-final'
  scheduledFor: string  // ISO date string
  priority: number
  recipients: string[]
  template: string
  templateData: Record<string, any>
  maxAttempts?: number
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const body: AddJobRequest = await request.json()

    // Validate required fields
    if (!body.type || !body.scheduledFor || !body.priority || !body.recipients || !body.template) {
      return NextResponse.json(
        { error: 'Missing required fields: type, scheduledFor, priority, recipients, template' },
        { status: 400 }
      )
    }

    // Validate scheduledFor is a valid date
    const scheduledDate = new Date(body.scheduledFor)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduledFor date format' },
        { status: 400 }
      )
    }

    // Validate priority is within range
    if (body.priority < 1 || body.priority > 10) {
      return NextResponse.json(
        { error: 'Priority must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Validate recipients array
    if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients must be a non-empty array' },
        { status: 400 }
      )
    }

    const processor = new EmailQueueProcessor()
    const jobId = await processor.addJob({
      type: body.type,
      status: 'queued',
      priority: body.priority,
      scheduledFor: body.scheduledFor,
      scheduledHour: scheduledDate.getHours(),
      recipients: body.recipients,
      template: body.template,
      templateData: body.templateData || {},
      attempts: 0,
      maxAttempts: body.maxAttempts || 3
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: `Job ${jobId} added to queue`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[API] Add job error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add job to queue',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}