import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { getTestSyncStatus, getSheetData, getDynamoData } from '../../../../../utils/test-sync/service'

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

    // Get status and data
    const [status, sheetData, dynamoData] = await Promise.all([
      getTestSyncStatus(),
      getSheetData(),
      getDynamoData()
    ])

    return NextResponse.json({
      status,
      sheetData,
      dynamoData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get test sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}