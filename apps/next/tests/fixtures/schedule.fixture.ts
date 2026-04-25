/**
 * Schedule Test Fixtures
 *
 * Mock schedule data for Newsletter and Schedule page tests.
 * These match the ProgramTypes structure used by the application.
 */

// ============================================================================
// Program Types (matching @my/app/types)
// ============================================================================

export interface ProgramTypes {
  Key: 'sundaySchool' | 'memorial' | 'bibleClass'
  Date: string
  Time?: string
  Presider?: string
  Exhorter?: string
  Speaker?: string
  Leader?: string
  Topic?: string
  Reading?: string
  FirstReading?: string
  SecondReading?: string
  [key: string]: string | undefined
}

// ============================================================================
// Date Helpers
// ============================================================================

const getNextSunday = (weeksAhead = 0): Date => {
  const today = new Date()
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7
  const nextSunday = new Date(today)
  nextSunday.setDate(today.getDate() + daysUntilSunday + weeksAhead * 7)
  nextSunday.setHours(10, 0, 0, 0)
  return nextSunday
}

const getNextWednesday = (weeksAhead = 0): Date => {
  const today = new Date()
  const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7
  const nextWednesday = new Date(today)
  nextWednesday.setDate(today.getDate() + daysUntilWednesday + weeksAhead * 7)
  nextWednesday.setHours(20, 0, 0, 0)
  return nextWednesday
}

const formatDate = (date: Date): string => date.toISOString()

// ============================================================================
// Sunday School Fixtures
// Note: SundaySchoolType requires 'Refreshments' field (not Leader/Topic)
// ============================================================================

export const mockSundaySchool = (weeksAhead = 0): ProgramTypes => ({
  Key: 'sundaySchool',
  Date: formatDate(getNextSunday(weeksAhead)),
  Time: '10:00 AM',
  Refreshments: 'The Smith Family',
})

export const mockSundaySchoolMinimal = (weeksAhead = 0): ProgramTypes => ({
  Key: 'sundaySchool',
  Date: formatDate(getNextSunday(weeksAhead)),
  Time: '10:00 AM',
  Refreshments: '',  // Empty refreshments triggers "No Sunday School this week"
})

// ============================================================================
// Memorial Fixtures
// Note: MemorialServiceType uses Preside/Exhort (not Presider/Exhorter)
// ============================================================================

export const mockMemorial = (weeksAhead = 0): ProgramTypes => ({
  Key: 'memorial',
  Date: formatDate(getNextSunday(weeksAhead)),
  Time: '11:15 AM',
  Preside: 'James Wilson',
  Exhort: 'Robert Brown',
  Organist: 'Sarah Johnson',
  Steward: 'David Lee',
  Doorkeeper: 'Michael Chen',
  Collection: 'ASK',
  Lunch: '',
  Reading1: 'Isaiah 53:1-12',
  Reading2: 'John 19:1-30',
  'Hymn-opening': '123',
  'Hymn-exhortation': '456',
  'Hymn-memorial': '789',
  'Hymn-closing': '012',
  YouTube: 'https://youtube.com/watch?v=example',
})

export const mockMemorialMinimal = (weeksAhead = 0): ProgramTypes => ({
  Key: 'memorial',
  Date: formatDate(getNextSunday(weeksAhead)),
  Time: '11:15 AM',
  Preside: 'James Wilson',
  Exhort: '',  // Empty exhort triggers no memorial display
  Organist: '',
  Steward: '',
  Doorkeeper: '',
  Collection: '',
  Lunch: '',
  Reading1: '',
  Reading2: '',
  'Hymn-opening': '',
  'Hymn-exhortation': '',
  'Hymn-memorial': '',
  'Hymn-closing': '',
  YouTube: '',
})

// ============================================================================
// Bible Class Fixtures
// Note: BibleClassType requires Presider, Speaker, and Topic
// ============================================================================

export const mockBibleClass = (weeksAhead = 0): ProgramTypes => ({
  Key: 'bibleClass',
  Date: formatDate(getNextWednesday(weeksAhead)),
  Time: '8:00 PM',
  Presider: 'John Anderson',
  Speaker: 'Michael Davis',
  Topic: 'The Book of Revelation - Chapter 12',
})

export const mockBibleClassMinimal = (weeksAhead = 0): ProgramTypes => ({
  Key: 'bibleClass',
  Date: formatDate(getNextWednesday(weeksAhead)),
  Time: '8:00 PM',
  Presider: '',
  Speaker: '',
  Topic: '',
})

// ============================================================================
// Complete Schedule Sets
// ============================================================================

/**
 * Creates a typical week's schedule with all services
 */
export const mockWeeklySchedule = (): ProgramTypes[] => [
  mockSundaySchool(),
  mockMemorial(),
  mockBibleClass(),
]

/**
 * Creates multiple weeks of schedule data
 */
export const mockMultiWeekSchedule = (weeks = 4): ProgramTypes[] => {
  const schedule: ProgramTypes[] = []
  for (let i = 0; i < weeks; i++) {
    schedule.push(mockSundaySchool(i), mockMemorial(i), mockBibleClass(i))
  }
  return schedule
}

/**
 * Creates schedule with missing optional fields (edge case testing)
 */
export const mockMinimalSchedule = (): ProgramTypes[] => [
  mockSundaySchoolMinimal(),
  mockMemorialMinimal(),
  mockBibleClassMinimal(),
]

// ============================================================================
// Daily Bible Readings Fixtures
// ============================================================================

/**
 * Daily reading entry format: { "Mon, Dec 30": ["Genesis 1", "Psalm 1", "Matthew 1"] }
 */
export type DailyReadingEntry = Record<string, string[]>

/**
 * API response format for /api/json/range
 * The readings array contains objects where keys are date strings
 */
export interface DailyReadingsResponse {
  readings: DailyReadingEntry[]
}

// For backwards compatibility with existing imports
export type DailyReading = DailyReadingEntry

const formatReadingDate = (date: Date): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
}

export const mockDailyReadings = (days = 7): DailyReadingEntry[] => {
  const readings: DailyReadingEntry[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dateKey = formatReadingDate(date)
    readings.push({
      [dateKey]: [
        `Genesis ${i + 1}`,
        `Psalm ${i + 1}`,
        `Matthew ${i + 1}`,
      ],
    })
  }

  return readings
}

// ============================================================================
// API Response Mocks (for Playwright route interception)
// ============================================================================

/**
 * Mock response for /api/upcoming-program
 */
export const mockUpcomingProgramResponse = () => mockWeeklySchedule()

/**
 * Mock response for /api/json/range (daily readings)
 */
export const mockReadingsResponse = () => mockDailyReadings()

/**
 * Creates a Playwright route handler for schedule API
 */
export const createScheduleMockHandler = (schedule: ProgramTypes[] = mockWeeklySchedule()) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(schedule),
})

/**
 * Creates a Playwright route handler for readings API
 */
export const createReadingsMockHandler = (readings: DailyReading[] = mockDailyReadings()) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(readings),
})

// ============================================================================
// Edge Case Fixtures
// ============================================================================

/**
 * Empty schedule (tests empty state handling)
 */
export const mockEmptySchedule = (): ProgramTypes[] => []

/**
 * Schedule with special characters in names/topics
 */
export const mockScheduleWithSpecialChars = (): ProgramTypes[] => [
  {
    Key: 'sundaySchool',
    Date: formatDate(getNextSunday()),
    Time: '10:00 AM',
    Leader: "John O'Brien",
    Topic: 'Faith & Works: James 2',
  },
  {
    Key: 'memorial',
    Date: formatDate(getNextSunday()),
    Time: '11:15 AM',
    Presider: 'José García',
    Exhorter: 'François Müller',
  },
]

/**
 * Schedule with very long content (tests text overflow)
 */
export const mockScheduleWithLongContent = (): ProgramTypes[] => [
  {
    Key: 'bibleClass',
    Date: formatDate(getNextWednesday()),
    Time: '8:00 PM',
    Speaker: 'Dr. Alexander Bartholomew Wellington III',
    Topic:
      'A Comprehensive Study of the Eschatological Implications of the Book of Daniel and Its Relevance to Modern Christadelphian Ecclesial Life',
  },
]
