import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { triggerSheetSync } from '../../../../../utils/multi-sheet-sync/service'

export async function POST(request: NextRequest) {
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

    const { sheetId, sheetType } = await request.json()

    if (!sheetId || !sheetType) {
      return NextResponse.json({ 
        error: 'Missing required fields: sheetId and sheetType' 
      }, { status: 400 })
    }

    console.log(`🔄 Manual sheet sync triggered by ${session.user.email} for ${sheetType}: ${sheetId}`)

    // Trigger the sync
    const result = await triggerSheetSync(sheetId, sheetType)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      sheetId,
      sheetType,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Multi-sheet sync trigger failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Sync trigger failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}