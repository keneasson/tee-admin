import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'

/**
 * Health check endpoint for EventBridge monitoring
 *
 * This endpoint can be used to:
 * 1. Verify the API is reachable
 * 2. Test DynamoDB connectivity
 * 3. Monitor system health
 *
 * No authentication required for basic health checks
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  const searchParams = req.nextUrl.searchParams
  const checkDb = searchParams.get('checkDb') === 'true'

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'tee-admin-email-queue',
      checks: {
        api: true,
        database: null as boolean | null,
      },
      responseTime: 0,
    }

    // Optional: Check DynamoDB connectivity
    if (checkDb) {
      try {
        // Quick check - get schedules (should be fast)
        await sendQueueRepo.getAllSchedules()
        health.checks.database = true
      } catch (error) {
        health.checks.database = false
        health.status = 'degraded'
        console.error('❌ Database health check failed:', error)
      }
    }

    health.responseTime = Date.now() - startTime

    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      },
      { status: 503 }
    )
  }
}

// Support HEAD requests for simple up/down checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
