/**
 * Event Test Fixtures
 *
 * Factory functions for creating mock events of all types.
 * These are used for both Vitest unit tests and Playwright E2E tests.
 */

import type { Event, EventType, EventStatus } from '@my/app/types/events'

// Helper to generate unique IDs
let idCounter = 0
const generateId = () => `test-event-${++idCounter}`

// Helper to calculate dates relative to now
const daysFromNow = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

const daysAgo = (days: number): Date => daysFromNow(-days)

// Base event factory with defaults
interface BaseEventOptions {
  id?: string
  title?: string
  status?: EventStatus
  published?: boolean
  createdBy?: string
  membersOnly?: boolean
  featured?: boolean
  description?: string
}

const createBaseEvent = (type: EventType, options: BaseEventOptions = {}): Event => ({
  id: options.id ?? generateId(),
  title: options.title ?? `Test ${type} Event`,
  type,
  active: options.published ?? true, // New lifecycle model: active replaces published/status
  status: options.status ?? 'published',
  published: options.published ?? true,
  createdBy: options.createdBy ?? 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
  membersOnly: options.membersOnly ?? false,
  featured: options.featured ?? false,
  description: options.description,
  documents: [],
})

// ============================================================================
// Study Weekend Factory
// ============================================================================
interface StudyWeekendOptions extends BaseEventOptions {
  daysUntilStart?: number
  durationDays?: number
  theme?: string
  speakers?: Array<{ firstName: string; lastName: string }>
}

export const mockStudyWeekendEvent = (options: StudyWeekendOptions = {}): Event => ({
  ...createBaseEvent('study-weekend', {
    title: options.title ?? 'Annual Study Weekend',
    ...options,
  }),
  dateRange: {
    start: daysFromNow(options.daysUntilStart ?? 30),
    end: daysFromNow((options.daysUntilStart ?? 30) + (options.durationDays ?? 2)),
  },
  theme: options.theme ?? 'Walking in the Spirit',
  speakers: options.speakers ?? [
    { firstName: 'John', lastName: 'Smith' },
    { firstName: 'Mary', lastName: 'Johnson' },
  ],
  hostingEcclesia: { name: 'Toronto East Christadelphian Ecclesia' },
})

// ============================================================================
// Funeral Factory
// ============================================================================
interface FuneralOptions extends BaseEventOptions {
  daysAgo?: number
  serviceDaysFromNow?: number
  deceasedTitle?: 'Brother' | 'Sister' | 'Mr.' | 'Mrs.' | 'Ms.' | ''
  firstName?: string
  lastName?: string
  aboutDeceased?: string
}

export const mockFuneralEvent = (options: FuneralOptions = {}): Event => {
  const serviceDate = options.serviceDaysFromNow !== undefined
    ? daysFromNow(options.serviceDaysFromNow)
    : options.daysAgo !== undefined
      ? daysAgo(options.daysAgo)
      : daysAgo(3)

  return {
    ...createBaseEvent('funeral', {
      title: options.title ?? `Funeral Service for ${options.firstName ?? 'John'} ${options.lastName ?? 'Doe'}`,
      ...options,
    }),
    serviceDate,
    deceased: {
      title: options.deceasedTitle ?? 'Brother',
      firstName: options.firstName ?? 'John',
      lastName: options.lastName ?? 'Doe',
    },
    aboutDeceased: options.aboutDeceased ?? 'A beloved member of our community who served faithfully for many years.',
  }
}

// ============================================================================
// Wedding Factory
// ============================================================================
interface WeddingOptions extends BaseEventOptions {
  daysUntilCeremony?: number
  brideName?: { firstName: string; lastName: string }
  groomName?: { firstName: string; lastName: string }
}

export const mockWeddingEvent = (options: WeddingOptions = {}): Event => ({
  ...createBaseEvent('wedding', {
    title: options.title ?? `Wedding of ${options.groomName?.firstName ?? 'John'} & ${options.brideName?.firstName ?? 'Jane'}`,
    ...options,
  }),
  ceremonyDate: daysFromNow(options.daysUntilCeremony ?? 14),
  couple: {
    bride: options.brideName ?? { firstName: 'Jane', lastName: 'Smith' },
    groom: options.groomName ?? { firstName: 'John', lastName: 'Doe' },
  },
})

// ============================================================================
// Baptism Factory
// ============================================================================
interface BaptismOptions extends BaseEventOptions {
  daysAgo?: number
  daysUntil?: number
  candidateName?: { firstName: string; lastName: string }
  aboutCandidate?: string
}

export const mockBaptismEvent = (options: BaptismOptions = {}): Event => {
  const baptismDate = options.daysUntil !== undefined
    ? daysFromNow(options.daysUntil)
    : options.daysAgo !== undefined
      ? daysAgo(options.daysAgo)
      : daysFromNow(7)

  return {
    ...createBaseEvent('baptism', {
      title: options.title ?? `Baptism of ${options.candidateName?.firstName ?? 'Sarah'} ${options.candidateName?.lastName ?? 'Johnson'}`,
      ...options,
    }),
    baptismDate,
    candidate: options.candidateName ?? { firstName: 'Sarah', lastName: 'Johnson' },
    aboutCandidate: options.aboutCandidate ?? 'Sarah has been studying the Bible for two years and is excited to commit her life to following Christ.',
  }
}

// ============================================================================
// General Event Factory
// ============================================================================
interface GeneralEventOptions extends BaseEventOptions {
  daysUntilStart?: number
  durationHours?: number
  customType?: string
}

export const mockGeneralEvent = (options: GeneralEventOptions = {}): Event => {
  const startDate = daysFromNow(options.daysUntilStart ?? 7)
  const endDate = new Date(startDate)
  endDate.setHours(endDate.getHours() + (options.durationHours ?? 2))

  return {
    ...createBaseEvent('general', {
      title: options.title ?? 'Community Event',
      ...options,
    }),
    startDate,
    endDate,
    customType: options.customType,
  }
}

// ============================================================================
// Recurring Event Factory
// ============================================================================
interface RecurringEventOptions extends BaseEventOptions {
  daysUntilStart?: number
  startTime?: string
}

export const mockRecurringEvent = (options: RecurringEventOptions = {}): Event => ({
  ...createBaseEvent('recurring', {
    title: options.title ?? 'Weekly Bible Study',
    ...options,
  }),
  recurringConfig: {
    startDate: daysFromNow(options.daysUntilStart ?? 0),
    startTime: options.startTime ?? '19:30',
  },
})

// ============================================================================
// Election Cycle Factory
// ============================================================================
interface ElectionCycleOptions extends BaseEventOptions {
  daysAgoStarted?: number
  daysUntilEnd?: number
  isActive?: boolean
}

export const mockElectionCycleEvent = (options: ElectionCycleOptions = {}): Event => {
  let startDate: Date
  let endDate: Date

  if (options.isActive === true) {
    // Active: started in the past, ends in the future
    startDate = daysAgo(options.daysAgoStarted ?? 7)
    endDate = daysFromNow(options.daysUntilEnd ?? 7)
  } else if (options.isActive === false) {
    // Inactive: both dates in the past
    startDate = daysAgo(14)
    endDate = daysAgo(1)
  } else {
    // Default: active
    startDate = daysAgo(options.daysAgoStarted ?? 7)
    endDate = daysFromNow(options.daysUntilEnd ?? 7)
  }

  return {
    ...createBaseEvent('election-cycle', {
      title: options.title ?? 'Service Brethren Election 2025',
      ...options,
    }),
    electionStartDate: startDate,
    electionEndDate: endDate,
  }
}

// ============================================================================
// Display Duration Test Helpers
// ============================================================================

/**
 * Creates events specifically for testing display duration rules
 */
export const createDisplayDurationTestEvents = () => ({
  // Baptism: shows for 7 days after event
  baptismVisible: mockBaptismEvent({ daysAgo: 5 }),
  baptismHidden: mockBaptismEvent({ daysAgo: 8 }),

  // Funeral: shows for 21 days after event
  funeralVisible: mockFuneralEvent({ daysAgo: 20 }),
  funeralHidden: mockFuneralEvent({ daysAgo: 22 }),

  // Wedding: shows until ceremony date
  weddingVisible: mockWeddingEvent({ daysUntilCeremony: 1 }),
  weddingHidden: mockWeddingEvent({ daysUntilCeremony: -1 }),

  // Study Weekend: shows until end date
  studyWeekendVisible: mockStudyWeekendEvent({ daysUntilStart: -2, durationDays: 3 }), // ends tomorrow
  studyWeekendHidden: mockStudyWeekendEvent({ daysUntilStart: -5, durationDays: 2 }), // ended 3 days ago

  // Election: active only during election period
  electionActive: mockElectionCycleEvent({ isActive: true }),
  electionInactive: mockElectionCycleEvent({ isActive: false }),
})

// ============================================================================
// Bulk Event Generators
// ============================================================================

/**
 * Creates a set of events for each type (useful for testing event list views)
 */
export const createOneOfEachEventType = (): Event[] => [
  mockStudyWeekendEvent(),
  mockFuneralEvent(),
  mockWeddingEvent(),
  mockBaptismEvent(),
  mockGeneralEvent(),
  mockRecurringEvent(),
  mockElectionCycleEvent(),
]

/**
 * Creates events with various statuses for testing filtering
 */
export const createEventsWithStatuses = () => ({
  draft: mockGeneralEvent({ status: 'draft', published: false }),
  ready: mockGeneralEvent({ status: 'ready', published: false }),
  published: mockGeneralEvent({ status: 'published', published: true }),
  archived: mockGeneralEvent({ status: 'archived', published: false }),
})

/**
 * Creates events for members-only visibility testing
 */
export const createMembershipTestEvents = () => ({
  public: mockGeneralEvent({ membersOnly: false, title: 'Public Event' }),
  membersOnly: mockGeneralEvent({ membersOnly: true, title: 'Members Only Event' }),
})

// Reset ID counter for test isolation
export const resetEventIdCounter = () => {
  idCounter = 0
}
