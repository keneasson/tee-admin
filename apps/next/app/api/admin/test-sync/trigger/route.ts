import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { getSheetData, syncSheetToDynamo } from '../../../../../utils/test-sync/service'

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

    console.log('🔄 Manual sync triggered by:', session.user.email)

    // Get data from Google Sheets
    const sheetData = await getSheetData()
    console.log(`📊 Retrieved ${sheetData.length} records from Google Sheets`)

    // Sync to DynamoDB
    const result = await syncSheetToDynamo(sheetData, 'manual')
    console.log('✅ Sync result:', result)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      recordsProcessed: result.recordsProcessed,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Manual sync failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}