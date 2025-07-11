import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import type { GoogleSheetTypes } from '@my/app/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scheduleType = searchParams.get('type') as GoogleSheetTypes || 'sundaySchool'
    
    // Initialize schedule service
    const scheduleService = new ScheduleService()
    
    // Get data from DynamoDB
    const dynamoData = await scheduleService.getScheduleData(scheduleType).catch(err => {
      console.error('DynamoDB error:', err)
      return null
    })

    if (!dynamoData) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    // Analyze date integrity
    const dateAnalysis = dynamoData.content.slice(0, 20).map((entry: any, index: number) => {
      const rawDate = entry.Date || entry.date
      const parsedDate = new Date(rawDate)
      
      // Convert to Toronto timezone for analysis
      const torontoDate = new Date(parsedDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
      
      return {
        index,
        rawDate,
        parsedDate: parsedDate.toISOString(),
        torontoDate: torontoDate.toISOString(),
        dayOfWeek: torontoDate.getDay(), // 0=Sunday, 1=Monday, ..., 6=Saturday
        dayName: torontoDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          timeZone: 'America/Toronto' 
        }),
        formattedDate: torontoDate.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/Toronto'
        }),
        // Check if this is the expected day for the schedule type
        isCorrectDay: getExpectedDay(scheduleType, torontoDate.getDay()),
        otherFields: Object.keys(entry).filter(key => !['Date', 'date'].includes(key)).slice(0, 3)
      }
    })

    // Summary statistics
    const summary = {
      scheduleType,
      totalEntries: dynamoData.content?.length || 0,
      correctDayCount: dateAnalysis.filter(d => d.isCorrectDay).length,
      incorrectDayCount: dateAnalysis.filter(d => !d.isCorrectDay).length,
      dayDistribution: dateAnalysis.reduce((acc, d) => {
        acc[d.dayName] = (acc[d.dayName] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json({
      scheduleType,
      expectedDay: getExpectedDayName(scheduleType),
      summary,
      sampleAnalysis: dateAnalysis,
      lastUpdated: dynamoData.lastUpdated || null
    })
    
  } catch (error) {
    console.error('Schedule data integrity check error:', error)
    
    return NextResponse.json({
      error: 'Failed to analyze schedule data integrity',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getExpectedDay(scheduleType: string, dayOfWeek: number): boolean {
  switch (scheduleType) {
    case 'memorial':
      return dayOfWeek === 0 // Sunday
    case 'sundaySchool':
      return dayOfWeek === 0 // Sunday
    case 'bibleClass':
      return dayOfWeek === 3 // Wednesday
    case 'cyc':
      return dayOfWeek === 5 // Friday
    default:
      return true // Unknown type, assume correct
  }
}

function getExpectedDayName(scheduleType: string): string {
  switch (scheduleType) {
    case 'memorial':
      return 'Sunday'
    case 'sundaySchool':
      return 'Sunday'
    case 'bibleClass':
      return 'Wednesday'
    case 'cyc':
      return 'Friday'
    default:
      return 'Unknown'
  }
}