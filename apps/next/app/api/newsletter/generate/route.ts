import { NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/render'
import { Newsletter } from '../../../../../email-builder/emails/Newsletter'
import { CurrentWeekData, GenerateNewsletterResponse } from '@my/app/types/newsletter'

export async function POST(request: NextRequest) {
  try {
    // Get current week data (Thursday to Wednesday)
    const currentWeekData = await getCurrentWeekData()
    
    // Generate email HTML using React Email
    const emailHtml = await render(Newsletter({
      events: [], // No legacy events needed when using currentWeekData
      currentWeekData,
      mode: 'email'
    }), {
      pretty: false,
    })

    // Extract section positions from the generated HTML
    const sectionPositions = extractSectionPositions(emailHtml)

    const response: GenerateNewsletterResponse = {
      html: emailHtml,
      sections: sectionPositions,
      data: currentWeekData
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating newsletter:', error)
    return NextResponse.json(
      { error: 'Failed to generate newsletter' },
      { status: 500 }
    )
  }
}

async function getCurrentWeekData(): Promise<CurrentWeekData> {
  const now = new Date()
  
  // Get current Thursday to Wednesday range
  const currentThursday = getThisWeekThursday(now)
  const nextWednesday = new Date(currentThursday)
  nextWednesday.setDate(currentThursday.getDate() + 6)
  
  // Get current and next Bible class dates (Wednesdays)
  const todayWednesday = getThisWeekWednesday(now)
  const nextWednesday2 = new Date(todayWednesday)
  nextWednesday2.setDate(todayWednesday.getDate() + 7)
  
  // Get current Sunday
  const thisSunday = getThisWeekSunday(now)
  
  return {
    weekRange: {
      start: currentThursday,
      end: nextWednesday
    },
    dailyReadings: await getDailyReadings(currentThursday, nextWednesday),
    bibleClass: {
      current: {
        date: todayWednesday,
        topic: "The Promises of God in Christ", // This should come from your data source
        speaker: "Brother Wilson",
        notes: "Study of 2 Corinthians 1:20"
      },
      next: {
        date: nextWednesday2,
        topic: "Faith and Works in James",
        speaker: "Brother Smith", 
        notes: "James 2:14-26"
      }
    },
    sundaySchool: {
      date: thisSunday,
      refreshments: "The Johnson Family",
      notes: "Please arrive 15 minutes early",
      specialEvents: undefined
    },
    memorial: {
      date: thisSunday,
      preside: "Brother Thompson",
      exhort: "Brother Davis",
      organist: "Sister Williams",
      steward: "Brother Johnson",
      doorkeeper: "Brother Brown",
      collection: "Brother Wilson",
      lunch: "Please bring a dish to share"
    }
  }
}

async function getDailyReadings(startDate: Date, endDate: Date) {
  // This should fetch from your readings cache/API
  const readings = []
  const current = new Date(startDate)
  
  const sampleReadings = [
    { reading1: "Genesis 1", reading2: "Psalm 1", reading3: "Matthew 1" },
    { reading1: "Genesis 2", reading2: "Psalm 2", reading3: "Matthew 2" },
    { reading1: "Genesis 3", reading2: "Psalm 3", reading3: "Matthew 3" },
    { reading1: "Genesis 4", reading2: "Psalm 4", reading3: "Matthew 4" },
    { reading1: "Genesis 5", reading2: "Psalm 5", reading3: "Matthew 5" },
    { reading1: "Genesis 6", reading2: "Psalm 6", reading3: "Matthew 6" },
    { reading1: "Genesis 7", reading2: "Psalm 7", reading3: "Matthew 7" },
  ]
  
  let dayIndex = 0
  while (current <= endDate && dayIndex < 7) {
    readings.push({
      date: new Date(current),
      dayName: current.toLocaleDateString('en-US', { weekday: 'long' }),
      ...sampleReadings[dayIndex]
    })
    current.setDate(current.getDate() + 1)
    dayIndex++
  }
  
  return readings
}

function getThisWeekThursday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 3 // Thursday is day 4, Monday is day 1
  d.setDate(diff)
  return d
}

function getThisWeekWednesday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const wednesday = day === 3 ? 0 : (3 - day + 7) % 7
  d.setDate(d.getDate() + wednesday)
  return d
}

function getThisWeekSunday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  return d
}

function extractSectionPositions(html: string) {
  // Parse HTML and extract section positions
  // Updated to match new Newsletter component structure with reduced spacing
  const sections = [
    { id: 'header', type: 'header', position: { top: 0, height: 100 } },
    { id: 'daily-readings', type: 'daily-readings', position: { top: 100, height: 140 } },
    { id: 'bible-class-current', type: 'bible-class-current', position: { top: 240, height: 100 } },
    { id: 'bible-class-next', type: 'bible-class-next', position: { top: 340, height: 100 } },
    { id: 'sunday-school', type: 'sunday-school', position: { top: 440, height: 90 } },
    { id: 'memorial', type: 'memorial', position: { top: 530, height: 130 } },
    { id: 'standing-sections', type: 'standing-sections', position: { top: 660, height: 80 } },
    { id: 'footer', type: 'footer', position: { top: 740, height: 60 } },
  ]
  
  return sections
}