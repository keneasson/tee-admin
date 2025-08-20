import { fetchUpcoming } from '@my/app/features/newsletter/fetch-upcoming'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { DailyReading } from '@my/app/types/newsletter-rules'

/**
 * Services Integration Layer
 * Connects newsletter assembly with existing schedule and readings APIs
 */
export class ServicesIntegration {
  
  /**
   * Fetch regular services data from existing APIs
   */
  static async fetchRegularServices(options: ServiceOptions = {}): Promise<RegularServicesData> {
    try {
      console.log('📊 Fetching regular services from existing APIs...')
      
      // Fetch upcoming program data (Memorial, Bible Class, Sunday School)
      const upcomingData = await fetchUpcoming({})
      
      if (!upcomingData || !Array.isArray(upcomingData)) {
        console.warn('⚠️ No upcoming program data received')
        return this.createEmptyRegularServices()
      }

      console.log(`📅 Received ${upcomingData.length} upcoming program items`)
      
      // Process and organize the data
      return this.processUpcomingData(upcomingData)
      
    } catch (error) {
      console.error('❌ Failed to fetch regular services:', error)
      return this.createEmptyRegularServices()
    }
  }

  /**
   * Fetch daily readings from existing API
   */
  static async fetchDailyReadings(startDate: Date, days: number = 7): Promise<DailyReading[]> {
    try {
      console.log(`📖 Fetching daily readings starting from ${startDate.toDateString()}`)
      
      const readingsData = await fetchReadings()
      
      if (!readingsData || !Array.isArray(readingsData)) {
        console.warn('⚠️ No readings data received')
        return this.createPlaceholderReadings(startDate, days)
      }

      console.log(`📖 Received ${readingsData.length} readings entries`)
      
      // Process readings data to match our format
      return this.processReadingsData(readingsData, startDate, days)
      
    } catch (error) {
      console.error('❌ Failed to fetch daily readings:', error)
      return this.createPlaceholderReadings(startDate, days)
    }
  }

  /**
   * Process upcoming program data into organized structure
   */
  private static processUpcomingData(upcomingData: any[]): RegularServicesData {
    // Group events by type
    const memorialEvents = upcomingData.filter(item => item.Key === 'memorial')
    const sundaySchoolEvents = upcomingData.filter(item => item.Key === 'sundaySchool')
    const bibleClassEvents = upcomingData.filter(item => item.Key === 'bibleClass')

    // Sort events by date
    const sortByDate = (events: any[]) => events.sort((a, b) => 
      new Date(a.Date).getTime() - new Date(b.Date).getTime()
    )

    const sortedMemorial = sortByDate(memorialEvents)
    const sortedSundaySchool = sortByDate(sundaySchoolEvents)
    const sortedBibleClass = sortByDate(bibleClassEvents)

    // Get this week and next week events
    const currentDate = new Date()
    const thisWeekEnd = this.getWeekEnd(currentDate)
    const nextWeekEnd = this.getWeekEnd(new Date(thisWeekEnd.getTime() + 7 * 24 * 60 * 60 * 1000))

    const thisWeekMemorial = this.findEventInWeek(sortedMemorial, currentDate, thisWeekEnd)
    const nextWeekMemorial = this.findEventInWeek(sortedMemorial, thisWeekEnd, nextWeekEnd)
    
    const thisWeekSundaySchool = this.findEventInWeek(sortedSundaySchool, currentDate, thisWeekEnd)
    const nextWeekSundaySchool = this.findEventInWeek(sortedSundaySchool, thisWeekEnd, nextWeekEnd)
    
    const thisWeekBibleClass = this.findEventInWeek(sortedBibleClass, currentDate, thisWeekEnd)
    const nextWeekBibleClass = this.findEventInWeek(sortedBibleClass, thisWeekEnd, nextWeekEnd)

    return {
      thisWeek: {
        sunday: {
          memorial: thisWeekMemorial ? this.processMemorialEvent(thisWeekMemorial) : null,
          sundaySchool: thisWeekSundaySchool ? this.processSundaySchoolEvent(thisWeekSundaySchool) : null
        },
        bibleClass: thisWeekBibleClass ? this.processBibleClassEvent(thisWeekBibleClass) : null
      },
      nextWeek: {
        sunday: {
          memorial: nextWeekMemorial ? this.processMemorialEvent(nextWeekMemorial) : null,
          sundaySchool: nextWeekSundaySchool ? this.processSundaySchoolEvent(nextWeekSundaySchool) : null
        },
        bibleClass: nextWeekBibleClass ? this.processBibleClassEvent(nextWeekBibleClass) : null
      }
    }
  }

  /**
   * Process memorial event data
   */
  private static processMemorialEvent(event: any): any {
    return {
      date: new Date(event.Date),
      preside: event.Preside || '',
      exhort: event.Exhort || '',
      organist: event.Organist || '',
      steward: event.Steward || '',
      doorkeeper: event.Doorkeeper || '',
      collection: event.Collection || '',
      lunch: event.Lunch || '',
      hymns: {
        opening: event['Hymn-opening'] || '',
        exhortation: event['Hymn-exhortation'] || '',
        memorial: event['Hymn-memorial'] || '',
        closing: event['Hymn-closing'] || ''
      },
      readings: {
        reading1: event.Reading1 || '',
        reading2: event.Reading2 || ''
      },
      specialEvents: event['Holidays and Special Events'] || '',
      isException: !event.Exhort || event.Exhort.trim() === '',
      exceptionMessage: !event.Exhort || event.Exhort.trim() === '' ? 
        'No Memorial Service scheduled' : ''
    }
  }

  /**
   * Process Sunday School event data
   */
  private static processSundaySchoolEvent(event: any): any {
    const month = new Date(event.Date).getMonth() + 1
    const activeMonths = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6] // September to June
    const isActive = activeMonths.includes(month)

    return {
      date: new Date(event.Date),
      refreshments: event.Refreshments || '',
      notes: event.Notes || '',
      specialEvents: event['Holidays and Special Events'] || '',
      isActive,
      inactiveMessage: isActive ? null : 'No Sunday School during summer months'
    }
  }

  /**
   * Process Bible Class event data
   */
  private static processBibleClassEvent(event: any): any {
    return {
      date: new Date(event.Date),
      speaker: event.Speaker || '',
      topic: event.Topic || '',
      presider: event.Presider || '',
      notes: event.Notes || '',
      location: 'Zoom Meeting'
    }
  }

  /**
   * Process readings data into DailyReading format
   */
  private static processReadingsData(readingsData: any[], startDate: Date, days: number): DailyReading[] {
    const readings: DailyReading[] = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Create readings for each day
    for (let i = 0; i < days; i++) {
      const readingDate = new Date(startDate)
      readingDate.setDate(readingDate.getDate() + i)
      
      // Find matching reading from the API data
      const matchingReading = this.findReadingForDate(readingsData, readingDate)
      
      readings.push({
        date: readingDate,
        dayName: dayNames[readingDate.getDay()],
        reading1: matchingReading?.reading1 || 'TBD',
        reading2: matchingReading?.reading2 || 'TBD',
        reading3: matchingReading?.reading3 || 'TBD'
      })
    }

    return readings
  }

  /**
   * Find reading entry for specific date
   */
  private static findReadingForDate(readingsData: any[], targetDate: Date): any {
    // The readings API returns an array of readings
    // We need to find the one that matches our target date
    
    const targetDateStr = targetDate.toDateString()
    
    return readingsData.find(reading => {
      if (reading.date) {
        const readingDate = new Date(reading.date)
        return readingDate.toDateString() === targetDateStr
      }
      
      // Handle different date formats that might be in the API
      if (reading.Date) {
        const readingDate = new Date(reading.Date)
        return readingDate.toDateString() === targetDateStr
      }
      
      return false
    })
  }

  /**
   * Find event within a specific week
   */
  private static findEventInWeek(events: any[], weekStart: Date, weekEnd: Date): any {
    return events.find(event => {
      const eventDate = new Date(event.Date)
      return eventDate >= weekStart && eventDate <= weekEnd
    })
  }

  /**
   * Get end of week for a given date
   */
  private static getWeekEnd(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    const diff = result.getDate() - day + 6 // Saturday as end of week
    result.setDate(diff)
    result.setHours(23, 59, 59, 999)
    return result
  }

  /**
   * Create empty regular services structure
   */
  private static createEmptyRegularServices(): RegularServicesData {
    return {
      thisWeek: {
        sunday: { memorial: null, sundaySchool: null },
        bibleClass: null
      },
      nextWeek: {
        sunday: { memorial: null, sundaySchool: null },
        bibleClass: null
      }
    }
  }

  /**
   * Create placeholder readings when API fails
   */
  private static createPlaceholderReadings(startDate: Date, days: number): DailyReading[] {
    const readings: DailyReading[] = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    for (let i = 0; i < days; i++) {
      const readingDate = new Date(startDate)
      readingDate.setDate(readingDate.getDate() + i)
      
      readings.push({
        date: readingDate,
        dayName: dayNames[readingDate.getDay()],
        reading1: 'TBD',
        reading2: 'TBD',
        reading3: 'TBD'
      })
    }

    return readings
  }

  /**
   * Validate services data completeness
   */
  static validateServicesData(data: RegularServicesData): ServiceValidationResult {
    const issues: string[] = []
    let completeness = 100

    // Check this week's memorial
    if (!data.thisWeek.sunday.memorial) {
      issues.push('Missing this week\'s Memorial Service')
      completeness -= 25
    } else {
      const memorial = data.thisWeek.sunday.memorial
      const requiredFields = ['preside', 'exhort', 'organist', 'steward', 'doorkeeper']
      const missingFields = requiredFields.filter(field => !memorial[field] || memorial[field].trim() === '')
      
      if (missingFields.length > 0) {
        issues.push(`Memorial Service missing: ${missingFields.join(', ')}`)
        completeness -= missingFields.length * 3
      }
    }

    // Check this week's Bible Class
    if (!data.thisWeek.bibleClass) {
      issues.push('Missing this week\'s Bible Class')
      completeness -= 20
    } else {
      const bibleClass = data.thisWeek.bibleClass
      if (!bibleClass.speaker || !bibleClass.topic) {
        issues.push('Bible Class missing speaker or topic')
        completeness -= 10
      }
    }

    // Check Sunday School (if in active season)
    const currentMonth = new Date().getMonth() + 1
    const activeMonths = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
    
    if (activeMonths.includes(currentMonth)) {
      if (!data.thisWeek.sunday.sundaySchool || !data.thisWeek.sunday.sundaySchool.isActive) {
        issues.push('Missing Sunday School during active season')
        completeness -= 15
      } else if (!data.thisWeek.sunday.sundaySchool.refreshments) {
        issues.push('Sunday School missing refreshments info')
        completeness -= 5
      }
    }

    return {
      isValid: completeness >= 75,
      completeness: Math.max(0, completeness),
      issues
    }
  }
}

// Supporting types
interface ServiceOptions {
  useCache?: boolean
  fallbackToSheets?: boolean
}

interface RegularServicesData {
  thisWeek: {
    sunday: {
      memorial: any
      sundaySchool: any
    }
    bibleClass: any
  }
  nextWeek: {
    sunday: {
      memorial: any
      sundaySchool: any
    }
    bibleClass: any
  }
}

interface ServiceValidationResult {
  isValid: boolean
  completeness: number
  issues: string[]
}

export type { RegularServicesData, ServiceValidationResult }