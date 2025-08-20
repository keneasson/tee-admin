import { NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/render'
import React from 'react'
import Newsletter from '../../../../../../../email-builder/emails/Newsletter'

// POST /api/admin/newsletter/preview/email - Generate email preview
export async function POST(request: NextRequest) {
  try {
    const { events, programData, readings } = await request.json()

    // Validate required data
    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: 'Events array is required' },
        { status: 400 }
      )
    }

    // Filter programData to 7-day window (Thursday to Wednesday)
    const filteredProgramData = filterProgramDataByWeek(programData)
    
    // Get cached daily readings (7-day window)
    const weeklyReadings = await getCachedReadings(readings)

    // Combine program data with custom events for email generation
    const allEventsForEmail = [
      ...(filteredProgramData || []), // Real schedule data (Memorial, Bible Class, etc.)
      ...(events || []) // Additional custom events
    ]

    // Debug logging
    console.log('📧 Email Preview Generation:')
    console.log('- Program events (filtered):', filteredProgramData?.length || 0)
    console.log('- Custom events:', events?.length || 0) 
    console.log('- Total events for email:', allEventsForEmail.length)
    console.log('- Week period:', getThursdayToWednesdayRange())
    
    if (allEventsForEmail.length > 0) {
      console.log('- Sample event:', JSON.stringify(allEventsForEmail[0], null, 2))
    }

    // Generate email HTML with real schedule data
    const emailHtml = await render(React.createElement(Newsletter, { events: allEventsForEmail }))
    
    // Also generate plain text version
    const emailText = await render(React.createElement(Newsletter, { events: allEventsForEmail }), {
      plainText: true
    })

    // Get email size for performance info
    const htmlSize = Buffer.byteLength(emailHtml, 'utf8')
    const htmlSizeKB = (htmlSize / 1024).toFixed(1)

    return NextResponse.json({
      success: true,
      html: emailHtml,
      text: emailText,
      metadata: {
        size: htmlSize,
        sizeKB: parseFloat(htmlSizeKB),
        eventCount: allEventsForEmail.length,
        programEventCount: filteredProgramData?.length || 0,
        customEventCount: events?.length || 0,
        readingsCount: weeklyReadings?.length || 0,
        generatedAt: new Date().toISOString(),
        weekPeriod: getThursdayToWednesdayRange()
      }
    })

  } catch (error) {
    console.error('Error generating email preview:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate email preview' },
      { status: 500 }
    )
  }
}

// Helper function to filter program data to Thursday-Wednesday window
function filterProgramDataByWeek(programData: any[]) {
  if (!programData || !Array.isArray(programData)) return []
  
  const { startDate, endDate } = getThursdayToWednesdayRange()
  
  return programData.filter(event => {
    const eventDate = new Date(event.Date)
    return eventDate >= startDate && eventDate <= endDate
  })
}

// Helper function to get Thursday to Wednesday date range
function getThursdayToWednesdayRange() {
  const today = new Date()
  const currentDay = today.getDay() // 0 = Sunday, 4 = Thursday
  
  // Find the most recent Thursday (or today if it's Thursday)
  let startDate = new Date(today)
  const daysToSubtract = currentDay >= 4 ? currentDay - 4 : currentDay + 3
  startDate.setDate(today.getDate() - daysToSubtract)
  startDate.setHours(0, 0, 0, 0)
  
  // Find the following Wednesday
  let endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6) // 6 days after Thursday = Wednesday
  endDate.setHours(23, 59, 59, 999)
  
  return { startDate, endDate }
}

// Helper function to get cached readings with 7-day filtering
async function getCachedReadings(readings: any[]) {
  if (!readings || !Array.isArray(readings)) return []
  
  const { startDate, endDate } = getThursdayToWednesdayRange()
  
  // Filter readings to the 7-day window
  const weeklyReadings = []
  
  for (const dailyReading of readings) {
    for (const [date, passages] of Object.entries(dailyReading)) {
      const readingDate = new Date(date)
      if (readingDate >= startDate && readingDate <= endDate) {
        weeklyReadings.push({ [date]: passages })
      }
    }
  }
  
  return weeklyReadings
}