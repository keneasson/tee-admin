/**
 * Email Queue Processor API Endpoint
 * Triggered hourly by Vercel cron job
 */

import { NextRequest, NextResponse } from 'next/server'
import { EmailQueueProcessor } from '@/utils/email'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (Vercel adds this header)
    const cronSecret = request.headers.get('authorization')
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`
    
    if (cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      )
    }

    console.log('[CRON] Email queue processor triggered at:', new Date().toISOString())

    const processor = new EmailQueueProcessor()
    const result = await processor.processQueue()

    console.log('[CRON] Queue processing result:', result)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: result.stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[CRON] Email queue processor error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  try {
    // Check for admin authentication
    // TODO: Add proper admin auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    console.log('[MANUAL] Email queue processor manually triggered at:', new Date().toISOString())

    const processor = new EmailQueueProcessor()
    const result = await processor.processQueue()

    console.log('[MANUAL] Queue processing result:', result)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: result.stats,
      timestamp: new Date().toISOString(),
      trigger: 'manual'
    })

  } catch (error) {
    console.error('[MANUAL] Email queue processor error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        trigger: 'manual'
      },
      { status: 500 }
    )
  }
}