import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { getMultiSheetSyncStatus } from '../../../../../utils/multi-sheet-sync/service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('📊 Multi-sheet sync status requested by:', session.user.email)

    // Get comprehensive sync status
    const status = await getMultiSheetSyncStatus()

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get multi-sheet sync status:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch sync status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}