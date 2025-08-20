/**
 * Email Queue Status API
 * Provides monitoring data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { EmailQueueProcessor } from '@/utils/email'

export async function GET(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const processor = new EmailQueueProcessor()
    const monitoringData = await processor.getMonitoringData()

    return NextResponse.json({
      success: true,
      data: monitoringData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[API] Queue status error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get queue status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}