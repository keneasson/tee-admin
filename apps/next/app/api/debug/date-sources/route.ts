import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import type { GoogleSheetTypes } from '@my/app/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scheduleType = (searchParams.get('type') as GoogleSheetTypes) || 'memorial'

    // Initialize schedule service
    const scheduleService = new ScheduleService()

    // Get data from both sources
    const [dynamoData, googleData] = await Promise.all([
      // DynamoDB data
      scheduleService.getScheduleData(scheduleType).catch((err) => {
        console.error('DynamoDB error:', err)
        return null
      }),

      // Google Sheets data
      (async () => {
        try {
          const { get_google_sheet } = await import('../../../utils/get-google-sheets')
          return await get_google_sheet(scheduleType)
        } catch (err) {
          console.error('Google Sheets error:', err)
          return null
        }
      })(),
    ])

    // Compare first few entries from each source
    const comparison = {
      scheduleType,
      timestamp: new Date().toISOString(),
      dynamoDbData: dynamoData
        ? {
            source: 'DynamoDB',
            totalEntries: dynamoData.content?.length || 0,
            sampleEntries:
              dynamoData.content?.slice(0, 3).map((entry: any) => ({
                rawDate: entry.Date || entry.date,
                dateType: typeof (entry.Date || entry.date),
                parsedDate: new Date(entry.Date || entry.date),
                torontoDate: new Date(entry.Date || entry.date).toLocaleString('en-US', {
                  timeZone: 'America/Toronto',
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }),
                utcDate: new Date(entry.Date || entry.date).toISOString(),
                otherFields: Object.keys(entry).filter((key) => key.toLowerCase() !== 'date'),
              })) || [],
            lastUpdated: dynamoData.lastUpdated || null,
          }
        : null,

      googleSheetsData: googleData
        ? {
            source: 'Google Sheets',
            totalEntries: googleData.content?.length || 0,
            sampleEntries:
              googleData.content?.slice(0, 3).map((entry: any) => ({
                rawDate: entry.Date || entry.date,
                dateType: typeof (entry.Date || entry.date),
                parsedDate: new Date(entry.Date || entry.date),
                torontoDate: new Date(entry.Date || entry.date).toLocaleString('en-US', {
                  timeZone: 'America/Toronto',
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }),
                utcDate: new Date(entry.Date || entry.date).toISOString(),
                otherFields: Object.keys(entry).filter((key) => key.toLowerCase() !== 'date'),
              })) || [],
            sheetId: googleData.sheetId || null,
          }
        : null,

      // Comparison analysis
      analysis: {
        bothSourcesAvailable: !!(dynamoData && googleData),
        dataMismatch:
          dynamoData && googleData
            ? dynamoData.content?.length !== googleData.content?.length
            : null,
        firstEntryComparison:
          dynamoData?.content?.[0] && googleData?.content?.[0]
            ? {
                dynamoDate: dynamoData.content[0].Date || dynamoData.content[0].date,
                googleDate: googleData.content[0].Date || googleData.content[0].date,
                datesMatch:
                  (dynamoData.content[0].Date || dynamoData.content[0].date) ===
                  (googleData.content[0].Date || googleData.content[0].date),
              }
            : null,
      },
    }

    return NextResponse.json(comparison, {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Date sources debug error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch date sources',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
