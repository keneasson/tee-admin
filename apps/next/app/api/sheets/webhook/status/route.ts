import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { WebhookSyncService } from '@my/app/provider/sync/webhook-sync-service'
import { WebhookSecurity } from '@my/app/provider/sync/webhook-security'
import { ROLES } from '@my/app/provider/auth/auth-roles'

const syncService = new WebhookSyncService()

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin privileges
    const userRole = (session.user as any)?.role
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    // Get sync status
    const pendingSyncs = syncService.getSyncStatus()
    const rateLimitStatus = WebhookSecurity.getRateLimitStatus()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      pendingSyncs: {
        count: pendingSyncs.length,
        syncs: pendingSyncs,
      },
      rateLimits: {
        count: rateLimitStatus.length,
        limits: rateLimitStatus,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        webhookSecret: process.env.WEBHOOK_SECRET ? '***configured***' : 'NOT_SET',
        stage: process.env.STAGE,
      },
    })

  } catch (error) {
    console.error('❌ Error getting webhook status:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Trigger manual sync for a specific sheet
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin privileges
    const userRole = (session.user as any)?.role
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { sheetId } = await request.json()
    
    if (!sheetId) {
      return NextResponse.json(
        { error: 'sheetId is required' },
        { status: 400 }
      )
    }

    console.log(`🔧 Manual sync triggered by ${session.user.email} for sheet: ${sheetId}`)

    // Trigger manual sync
    const result = await syncService.triggerManualSync(sheetId)

    return NextResponse.json({
      success: true,
      message: 'Manual sync completed',
      result,
      triggeredBy: session.user.email,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ Error triggering manual sync:', error)
    
    return NextResponse.json(
      { 
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}