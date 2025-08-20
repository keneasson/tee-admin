// Newsletter JSON Structure for DynamoDB Storage

export interface NewsletterSection {
  id: string
  type: 'header' | 'daily-readings' | 'bible-class-current' | 'bible-class-next' | 'sunday-school' | 'memorial' | 'custom-event' | 'footer'
  title: string
  order: number
  html: string
  data?: any // Raw data used to generate the HTML
  editable: boolean
  lastUpdated: Date
}

export interface NewsletterTemplate {
  id: string // Format: "Newsletter-DD-MM-YYYY"
  name: string // Human readable name
  date: Date // Newsletter date
  sections: NewsletterSection[]
  status: 'draft' | 'published' | 'sent'
  createdAt: Date
  updatedAt: Date
  version: number
}

// Reusable template chunks stored in DynamoDB
export interface NewsletterChunk {
  id: string
  type: 'header' | 'footer' | 'section-template'
  name: string
  html: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Current week data structure for live preview
export interface CurrentWeekData {
  weekRange: {
    start: Date // Thursday
    end: Date   // Wednesday
  }
  dailyReadings: Array<{
    date: Date
    dayName: string
    reading1: string
    reading2: string
    reading3: string
  }>
  bibleClass: {
    current: {
      date: Date
      topic: string
      speaker: string
      notes?: string
    }
    next: {
      date: Date
      topic: string
      speaker: string
      notes?: string
    }
  }
  sundaySchool: {
    date: Date
    refreshments: string
    notes?: string
    specialEvents?: string
  }
  memorial: {
    date: Date
    preside: string
    exhort: string
    organist: string
    steward: string
    doorkeeper: string
    collection: string
    lunch: string
  }
}

// Section positioning for overlay system
export interface SectionPosition {
  sectionId: string
  top: number
  height: number
  visible: boolean
}

// Newsletter curation state
export interface NewsletterCurationState {
  template: NewsletterTemplate
  currentWeekData: CurrentWeekData
  sectionPositions: SectionPosition[]
  previewMode: 'email' | 'web'
  isLoading: boolean
}

// API responses
export interface GenerateNewsletterResponse {
  html: string
  sections: Array<{
    id: string
    type: string
    position: {
      top: number
      height: number
    }
  }>
  data: CurrentWeekData
}

export interface SaveNewsletterRequest {
  template: Omit<NewsletterTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  publishImmediately?: boolean
}

export interface SaveNewsletterResponse {
  success: boolean
  template: NewsletterTemplate
  previewUrl: string
}