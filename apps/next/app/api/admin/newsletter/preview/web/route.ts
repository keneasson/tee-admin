import { NextRequest, NextResponse } from 'next/server'
import { renderToString } from 'react-dom/server'
import React from 'react'

// POST /api/admin/newsletter/preview/web - Generate web newsletter preview  
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

    // Combine all data for web generation
    const allEvents = [...(filteredProgramData || []), ...(events || [])]

    // Generate web version of newsletter
    const webNewsletterHtml = generateWebNewsletterHTML(allEvents, weeklyReadings)

    return NextResponse.json({
      success: true,
      html: webNewsletterHtml,
      metadata: {
        eventCount: allEvents.length,
        readingsCount: weeklyReadings?.length || 0,
        generatedAt: new Date().toISOString(),
        weekPeriod: getThursdayToWednesdayRange()
      }
    })

  } catch (error) {
    console.error('Error generating web preview:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate web preview' },
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

// Helper function to generate web newsletter HTML
function generateWebNewsletterHTML(events: any[], readings?: any[]): string {
  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  })

  // Group events by week
  const thisWeek: any[] = []
  const nextWeek: any[] = []
  
  events.forEach(event => {
    const eventDate = new Date(event.Date)
    const daysDiff = Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    
    if (daysDiff <= 7) {
      thisWeek.push(event)
    } else if (daysDiff <= 14) {
      nextWeek.push(event)
    }
  })

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Toronto East Newsletter - ${today}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #fdfaf5;
        }
        .header {
          background: linear-gradient(135deg, #c5d9fd 0%, #b8d0fc 100%);
          padding: 30px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 2.5rem;
          color: #011759;
        }
        .header p {
          margin: 5px 0;
          color: #555;
        }
        .section {
          background: white;
          padding: 25px;
          margin-bottom: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
          color: #011759;
          border-bottom: 2px solid #c5d9fd;
          padding-bottom: 10px;
          margin-top: 0;
        }
        .event {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9ff;
          border-left: 4px solid #c5d9fd;
          border-radius: 4px;
        }
        .event h3 {
          margin-top: 0;
          color: #011759;
        }
        .event-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 15px;
        }
        .detail-group h4 {
          margin: 0 0 8px 0;
          color: #666;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-group p {
          margin: 0;
          font-weight: 500;
        }
        .standing-section {
          background: linear-gradient(135deg, #fff5e6 0%, #fff0d6 100%);
          border: 2px solid #ffcc80;
        }
        @media (max-width: 600px) {
          .event-details {
            grid-template-columns: 1fr;
          }
          .header h1 {
            font-size: 2rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Toronto East Newsletter</h1>
        <p><strong>${today}</strong></p>
        <p>This newsletter is intended for Christadelphians and friends, whether we meet in person or on Zoom.</p>
        <p><em>All plans are subject to God's will.</em></p>
      </div>

      ${thisWeek.length > 0 ? `
        <div class="section">
          <h2>This Week's Arrangements</h2>
          ${generateEventsHTML(thisWeek)}
        </div>
      ` : ''}

      ${nextWeek.length > 0 ? `
        <div class="section">
          <h2>Next Week's Arrangements</h2>
          ${generateEventsHTML(nextWeek)}
        </div>
      ` : ''}

      ${readings && readings.length > 0 ? `
        <div class="section">
          <h2>Daily Bible Reading Planner</h2>
          ${generateReadingsHTML(readings)}
        </div>
      ` : ''}

      <div class="section standing-section">
        <h2>Learn To Read The Bible Effectively</h2>
        <h3>Every Monday from 7:00-8:30 pm at the Hall</h3>
        <p>Please join us for our seminars: Learn to Read the Bible Effectively.</p>
        <p><strong>All welcome!</strong></p>
      </div>

      <div class="section">
        <h2>Contact Information</h2>
        <p><strong>Toronto East Christadelphian Ecclesia</strong></p>
        <p>123 Main Street, Toronto, ON M1A 2B3</p>
        <p>Email: info@tee-admin.com</p>
      </div>
    </body>
    </html>
  `
}

function generateEventsHTML(events: any[]): string {
  // Group events by date
  const eventsByDate: { [key: string]: any[] } = {}
  
  events.forEach(event => {
    const date = event.Date
    if (!eventsByDate[date]) eventsByDate[date] = []
    eventsByDate[date].push(event)
  })

  return Object.entries(eventsByDate).map(([date, dayEvents]) => {
    const formattedDate = new Date(date).toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })

    const memorialEvent = dayEvents.find(e => e.Key === 'memorial')
    const bibleClassEvent = dayEvents.find(e => e.Key === 'bibleClass')

    return `
      <div class="event">
        <h3>Arrangements for ${formattedDate}</h3>
        
        ${memorialEvent ? `
          <div class="event-details">
            <div class="detail-group">
              <h4>Memorial Service - 11:00 AM</h4>
              <p><strong>Presiding:</strong> ${memorialEvent.Preside || 'TBA'}</p>
              <p><strong>Exhorting:</strong> ${memorialEvent.Exhort || 'TBA'}</p>
              <p><strong>Keyboardist:</strong> ${memorialEvent.Organist || 'TBA'}</p>
              <p><strong>Steward:</strong> ${memorialEvent.Steward || 'TBA'}</p>
              <p><strong>Doorkeeper:</strong> ${memorialEvent.Doorkeeper || 'TBA'}</p>
              ${memorialEvent.Collection ? `<p><strong>Collection:</strong> ${memorialEvent.Collection}</p>` : '<p>No Second Collection</p>'}
            </div>
            
            <div class="detail-group">
              <h4>Sunday School - 9:30 AM</h4>
              ${memorialEvent.Refreshments ? 
                `<p><strong>Refreshments:</strong> ${memorialEvent.Refreshments}</p>` : 
                '<p>No Sunday School this week</p>'
              }
              ${memorialEvent['Holidays and Special Events'] ? 
                `<p><strong>Special:</strong> ${memorialEvent['Holidays and Special Events']}</p>` : 
                ''
              }
              
              <h4>Hymns</h4>
              <p><strong>Opening:</strong> ${memorialEvent['Hymn-opening'] || 'TBA'}</p>
              <p><strong>Exhortation:</strong> ${memorialEvent['Hymn-exhortation'] || 'TBA'}</p>
              <p><strong>Memorial:</strong> ${memorialEvent['Hymn-memorial'] || 'TBA'}</p>
              <p><strong>Closing:</strong> ${memorialEvent['Hymn-closing'] || 'TBA'}</p>
            </div>
          </div>
        ` : ''}

        ${bibleClassEvent ? `
          <div class="event-details">
            <div class="detail-group">
              <h4>Bible Class - 7:30 PM (On Zoom)</h4>
              <p><strong>Presiding:</strong> ${bibleClassEvent.Presider || 'TBA'}</p>
              <p><strong>Leading:</strong> ${bibleClassEvent.Speaker || 'TBA'}</p>
              <p><strong>Topic:</strong> ${bibleClassEvent.Topic || 'TBA'}</p>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }).join('')
}

function generateReadingsHTML(readings: any[]): string {
  return readings.map(dailyReading => {
    return Object.entries(dailyReading).map(([date, passages]) => {
      const parsedDate = new Date(date)
      const dayName = parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
      const monthDay = parsedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      const passageArray = passages as string[]
      
      return `
        <div class="event" style="border-left-color: #9c27b0;">
          <div class="event-details">
            <div class="detail-group">
              <h4>${dayName}</h4>
              <p style="color: #9c27b0; font-weight: 600;">${monthDay}</p>
            </div>
            <div class="detail-group">
              <h4>Daily Readings</h4>
              ${passageArray.map(passage => `<p style="font-family: monospace; font-size: 0.9rem;">${passage}</p>`).join('')}
            </div>
          </div>
        </div>
      `
    }).join('')
  }).join('')
}