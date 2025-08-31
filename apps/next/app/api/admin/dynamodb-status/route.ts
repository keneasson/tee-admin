import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'

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

    console.log('📊 DynamoDB status check requested by:', session.user.email)

    const scheduleService = new ScheduleService()
    const scheduleTypes = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']
    
    // Check sync status for each type
    const syncStatuses = await Promise.all(
      scheduleTypes.map(async (type) => {
        const syncStatus = await scheduleService.getSyncStatus(type)
        return { type, ...syncStatus }
      })
    )

    // Check actual data availability
    const dataStatuses = await Promise.all(
      scheduleTypes.map(async (type) => {
        try {
          const data = await scheduleService.getScheduleData(type as any)
          return {
            type,
            hasData: !!data,
            recordCount: data?.content?.length || 0,
            lastUpdated: data?.lastUpdated,
            error: null
          }
        } catch (error) {
          return {
            type,
            hasData: false,
            recordCount: 0,
            lastUpdated: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scheduleTypes,
      syncStatuses,
      dataStatuses,
      summary: {
        totalTypes: scheduleTypes.length,
        syncedTypes: syncStatuses.filter(s => s.status === 'synced').length,
        typesWithData: dataStatuses.filter(d => d.hasData).length,
        totalRecords: dataStatuses.reduce((sum, d) => sum + d.recordCount, 0)
      }
    })

  } catch (error) {
    console.error('❌ DynamoDB status check failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check DynamoDB status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}