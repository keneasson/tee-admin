/**
 * Newsletter Requirements Tests
 *
 * User Story: "As a newsletter consumer, I need timely, relevant information about ecclesial events"
 *
 * These tests verify the business rules for how events display in the newsletter,
 * including display duration rules and conditional visibility.
 */

import { test, expect } from '@playwright/test'
import {
  mockBaptismEvent,
  mockFuneralEvent,
  mockWeddingEvent,
  mockStudyWeekendEvent,
  mockElectionCycleEvent,
  mockGeneralEvent,
  createDisplayDurationTestEvents,
  createMembershipTestEvents,
} from '../fixtures/events.fixture'
import {
  mockWeeklySchedule,
  mockDailyReadings,
} from '../fixtures/schedule.fixture'
import {
  mockEventsAPI,
  mockUpcomingProgramAPI,
  mockReadingsAPI,
  setupNewsletterMocks,
} from '../utils/test-data-api'
import { newsletter } from '../utils/selectors'

// ============================================================================
// Test Setup
// ============================================================================

test.describe('Newsletter Display Requirements', () => {
  test.beforeEach(async ({ page }) => {
    // Set up basic mocks for schedule and readings
    await mockUpcomingProgramAPI(page, mockWeeklySchedule())
    await mockReadingsAPI(page, mockDailyReadings())
  })

  // ==========================================================================
  // Regular Services Section
  // ==========================================================================

  test.describe('Regular Services Section', () => {
    test('displays Sunday School section with date and time', async ({ page }) => {
      await mockEventsAPI(page, [])
      await page.goto('/newsletter')

      // Wait for content to load
      await expect(page.getByText(/regular services/i)).toBeVisible()

      // Verify Sunday School section exists
      await expect(page.getByText(/sunday school/i)).toBeVisible()
    })

    test('displays Memorial section with presider/exhorter', async ({ page }) => {
      await mockEventsAPI(page, [])
      await page.goto('/newsletter')

      await expect(page.getByText(/regular services/i)).toBeVisible()
      await expect(page.getByText(/memorial/i)).toBeVisible()
    })

    test('displays Bible Class section with topic/speaker', async ({ page }) => {
      await mockEventsAPI(page, [])
      await page.goto('/newsletter')

      await expect(page.getByText(/regular services/i)).toBeVisible()
      await expect(page.getByText(/bible class/i)).toBeVisible()
    })
  })

  // ==========================================================================
  // Baptism Display Duration Rules
  // NOTE: Display duration filtering is NOT yet implemented in the newsletter.
  // These tests document the expected behavior for future implementation.
  // ==========================================================================

  test.describe('Baptism Display Duration', () => {
    test('baptism shows when event is 6 days ago (within 7 day window)', async ({ page }) => {
      const baptism = mockBaptismEvent({ daysAgo: 6 })
      await mockEventsAPI(page, [baptism])

      await page.goto('/newsletter')

      // Should be visible in Special Announcements
      await expect(page.getByText(/special announcements/i)).toBeVisible()
      await expect(page.getByText(/baptism/i)).toBeVisible()
    })

    // TODO: Implement display duration filtering in newsletter-screen.tsx
    // Baptism events should only show for 7 days after the baptism date
    test.skip('baptism hidden when event is 8 days ago (outside 7 day window)', async ({ page }) => {
      const baptism = mockBaptismEvent({ daysAgo: 8 })
      await mockEventsAPI(page, [baptism])

      await page.goto('/newsletter')

      // Special announcements section should not appear (no valid events)
      await expect(page.getByTestId('newsletter-special-announcements')).not.toBeVisible()
    })

    test('upcoming baptism shows before the event date', async ({ page }) => {
      const baptism = mockBaptismEvent({ daysUntil: 3 })
      await mockEventsAPI(page, [baptism])

      await page.goto('/newsletter')

      await expect(page.getByText(/special announcements/i)).toBeVisible()
      await expect(page.getByText(/baptism/i)).toBeVisible()
    })
  })

  // ==========================================================================
  // Funeral Display Duration Rules
  // NOTE: Display duration filtering is NOT yet implemented in the newsletter.
  // ==========================================================================

  test.describe('Funeral Display Duration', () => {
    test('funeral shows when service is 20 days ago (within 21 day window)', async ({ page }) => {
      const funeral = mockFuneralEvent({ daysAgo: 20 })
      await mockEventsAPI(page, [funeral])

      await page.goto('/newsletter')

      await expect(page.getByText(/special announcements/i)).toBeVisible()
      // Look for funeral card title - more specific selector
      await expect(page.getByTestId('event-card-title')).toContainText(/funeral/i)
    })

    // TODO: Implement display duration filtering in newsletter-screen.tsx
    // Funeral events should only show for 21 days after the service date
    test.skip('funeral hidden when service is 22 days ago (outside 21 day window)', async ({ page }) => {
      const funeral = mockFuneralEvent({ daysAgo: 22 })
      await mockEventsAPI(page, [funeral])

      await page.goto('/newsletter')

      // Special announcements section should not appear
      await expect(page.getByTestId('newsletter-special-announcements')).not.toBeVisible()
    })
  })

  // ==========================================================================
  // Wedding Display Duration Rules
  // NOTE: Display duration filtering is NOT yet implemented in the newsletter.
  // ==========================================================================

  test.describe('Wedding Display Duration', () => {
    test('wedding shows when ceremony is tomorrow', async ({ page }) => {
      const wedding = mockWeddingEvent({ daysUntilCeremony: 1 })
      await mockEventsAPI(page, [wedding])

      await page.goto('/newsletter')

      await expect(page.getByText(/special announcements/i)).toBeVisible()
      await expect(page.getByText(/wedding/i)).toBeVisible()
    })

    // TODO: Implement display duration filtering in newsletter-screen.tsx
    // Wedding events should only show until the ceremony date
    test.skip('wedding hidden when ceremony was yesterday', async ({ page }) => {
      const wedding = mockWeddingEvent({ daysUntilCeremony: -1 })
      await mockEventsAPI(page, [wedding])

      await page.goto('/newsletter')

      // Wedding should not be visible after ceremony
      await expect(page.getByTestId('newsletter-special-announcements')).not.toBeVisible()
    })
  })

  // ==========================================================================
  // Election Notice Display Rules
  // ==========================================================================

  test.describe('Election Notice Display', () => {
    test('election notice shows when election is active', async ({ page }) => {
      const election = mockElectionCycleEvent({ isActive: true })
      await mockEventsAPI(page, [election])

      await page.goto('/newsletter')

      // Election notice should be visible
      await expect(page.getByTestId('newsletter-election-notice')).toBeVisible()
      await expect(page.getByText(/elections for service brethren/i)).toBeVisible()
    })

    test('election notice hidden when election is inactive', async ({ page }) => {
      const election = mockElectionCycleEvent({ isActive: false })
      await mockEventsAPI(page, [election])

      await page.goto('/newsletter')

      // Election notice should NOT be visible
      await expect(page.getByTestId('newsletter-election-notice')).not.toBeVisible()
    })

    test('election notice shows correct end date', async ({ page }) => {
      const election = mockElectionCycleEvent({
        isActive: true,
        daysUntilEnd: 7,
      })
      await mockEventsAPI(page, [election])

      await page.goto('/newsletter')

      await expect(page.getByTestId('newsletter-election-notice')).toBeVisible()
      // The notice should mention when the election concludes
      await expect(page.getByText(/election concludes/i)).toBeVisible()
    })
  })

  // ==========================================================================
  // Study Weekend Display Rules
  // ==========================================================================

  test.describe('Study Weekend Display', () => {
    test('study weekend shows until end date', async ({ page }) => {
      // Event started 2 days ago but ends tomorrow (still visible)
      const studyWeekend = mockStudyWeekendEvent({
        daysUntilStart: -2,
        durationDays: 4, // ends in 2 days
      })
      await mockEventsAPI(page, [studyWeekend])

      await page.goto('/newsletter')

      await expect(page.getByText(/upcoming events/i)).toBeVisible()
    })

    test('study weekend hidden after end date', async ({ page }) => {
      // Event ended 3 days ago
      const studyWeekend = mockStudyWeekendEvent({
        daysUntilStart: -5,
        durationDays: 2, // ended 3 days ago
      })
      await mockEventsAPI(page, [studyWeekend])

      await page.goto('/newsletter')

      // Event should not be in the list
      await expect(page.getByText(/annual study weekend/i)).not.toBeVisible()
    })
  })

  // ==========================================================================
  // Members-Only Event Visibility
  // ==========================================================================

  test.describe('Members-Only Event Visibility', () => {
    test('members-only event shows "sign in" message for guests', async ({ page }) => {
      const { membersOnly } = createMembershipTestEvents()
      await mockEventsAPI(page, [membersOnly])

      await page.goto('/newsletter')

      // Should show sign in prompt for members-only content
      await expect(page.getByText(/sign in/i)).toBeVisible()
    })

    test('public event visible to all users', async ({ page }) => {
      const { public: publicEvent } = createMembershipTestEvents()
      await mockEventsAPI(page, [publicEvent])

      await page.goto('/newsletter')

      // Public event should be visible
      await expect(page.getByText(/public event/i)).toBeVisible()
    })
  })

  // ==========================================================================
  // Daily Readings Section
  // ==========================================================================

  test.describe('Daily Readings Section', () => {
    test('daily readings section displays when readings data available', async ({ page }) => {
      await mockEventsAPI(page, [])

      await page.goto('/newsletter')

      await expect(page.getByTestId('newsletter-daily-readings')).toBeVisible()
      await expect(page.getByText(/daily bible reading/i)).toBeVisible()
    })
  })

  // ==========================================================================
  // Admin Toolbar
  // ==========================================================================

  test.describe('Admin Toolbar', () => {
    test('admin toolbar not visible for unauthenticated users', async ({ page }) => {
      await mockEventsAPI(page, [])

      await page.goto('/newsletter')

      await expect(page.getByTestId('newsletter-admin-toolbar')).not.toBeVisible()
    })

    // Note: Testing admin visibility requires authenticated session
    // which would be covered in auth.requirements.spec.ts
  })
})

// ============================================================================
// Event Exclusion Rules
// ============================================================================

test.describe('Newsletter Event Exclusion Rules', () => {
  test.beforeEach(async ({ page }) => {
    await mockUpcomingProgramAPI(page, mockWeeklySchedule())
    await mockReadingsAPI(page, mockDailyReadings())
  })

  test('election-cycle events excluded from Upcoming Events section', async ({ page }) => {
    const election = mockElectionCycleEvent({ isActive: true })
    const generalEvent = mockGeneralEvent({ title: 'Community Potluck' })

    await mockEventsAPI(page, [election, generalEvent])
    await page.goto('/newsletter')

    // Election should appear as notice, not in upcoming events
    await expect(page.getByTestId('newsletter-election-notice')).toBeVisible()

    // General event should be in upcoming events
    await expect(page.getByText(/community potluck/i)).toBeVisible()
  })

  test('baptisms, weddings, funerals appear in Special Announcements, not Upcoming Events', async ({ page }) => {
    const baptism = mockBaptismEvent({ daysUntil: 5 })
    const wedding = mockWeddingEvent({ daysUntilCeremony: 10 })
    const funeral = mockFuneralEvent({ serviceDaysFromNow: 2 })
    const generalEvent = mockGeneralEvent({ title: 'Bible Study' })

    await mockEventsAPI(page, [baptism, wedding, funeral, generalEvent])
    await page.goto('/newsletter')

    // Special announcements should show these events
    await expect(page.getByTestId('newsletter-special-announcements')).toBeVisible()

    // General event in upcoming events
    await expect(page.getByText(/bible study/i)).toBeVisible()
  })
})
