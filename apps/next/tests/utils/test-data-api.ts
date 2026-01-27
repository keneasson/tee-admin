/**
 * Test Data API Helpers
 *
 * Utilities for mocking API routes in Playwright tests.
 * These allow isolated testing without hitting real APIs.
 */

import type { Page, Route } from '@playwright/test'
import type { Event } from '@my/app/types/events'
import type { ProgramTypes, DailyReading } from '../fixtures/schedule.fixture'
import type { MockSession } from '../fixtures/auth.fixture'

// ============================================================================
// API Route Interceptors
// ============================================================================

/**
 * Mock the events public API
 */
export const mockEventsAPI = async (
  page: Page,
  events: Event[]
): Promise<void> => {
  await page.route('**/api/events/public**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(events),
    })
  })
}

/**
 * Mock the upcoming program API (schedule data)
 */
export const mockUpcomingProgramAPI = async (
  page: Page,
  schedule: ProgramTypes[]
): Promise<void> => {
  await page.route('**/api/upcoming-program**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(schedule),
    })
  })
}

/**
 * Mock the daily readings API
 * Note: The API returns an array directly: [{ "Mon, Dec 30": [...] }, ...]
 */
export const mockReadingsAPI = async (
  page: Page,
  readings: DailyReading[]
): Promise<void> => {
  await page.route('**/api/json/range**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // API returns array directly, component receives it as readings prop
      body: JSON.stringify(readings),
    })
  })
}

/**
 * Mock the auth session API
 */
export const mockAuthSessionAPI = async (
  page: Page,
  session: MockSession | null
): Promise<void> => {
  await page.route('**/api/auth/session**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session ?? { user: null }),
    })
  })
}

/**
 * Mock cache invalidation API (for admin tests)
 */
export const mockCacheInvalidateAPI = async (
  page: Page,
  options: { shouldSucceed?: boolean; requiresAuth?: boolean } = {}
): Promise<void> => {
  const { shouldSucceed = true, requiresAuth = true } = options

  await page.route('**/api/cache/invalidate**', async (route: Route) => {
    if (requiresAuth) {
      // Check for credentials (simplified - real auth would check session)
      const headers = route.request().headers()
      if (!headers['cookie']?.includes('session')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Authentication required' }),
        })
        return
      }
    }

    if (shouldSucceed) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Cache invalidated',
          timestamp: new Date().toISOString(),
        }),
      })
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Cache invalidation failed' }),
      })
    }
  })
}

// ============================================================================
// Combined Mock Setups
// ============================================================================

interface NewsletterMockOptions {
  events?: Event[]
  schedule?: ProgramTypes[]
  readings?: DailyReading[]
  session?: MockSession | null
}

/**
 * Set up all mocks needed for newsletter page testing
 */
export const setupNewsletterMocks = async (
  page: Page,
  options: NewsletterMockOptions = {}
): Promise<void> => {
  const {
    events = [],
    schedule = [],
    readings = [],
    session = null,
  } = options

  await Promise.all([
    mockEventsAPI(page, events),
    mockUpcomingProgramAPI(page, schedule),
    mockReadingsAPI(page, readings),
    mockAuthSessionAPI(page, session),
  ])
}

// ============================================================================
// API Error Simulation
// ============================================================================

/**
 * Simulate API errors for error handling tests
 */
export const mockAPIError = async (
  page: Page,
  urlPattern: string | RegExp,
  statusCode: number,
  errorMessage: string
): Promise<void> => {
  await page.route(urlPattern, async (route: Route) => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorMessage }),
    })
  })
}

/**
 * Simulate network timeout
 */
export const mockAPITimeout = async (
  page: Page,
  urlPattern: string | RegExp
): Promise<void> => {
  await page.route(urlPattern, async (route: Route) => {
    // Never respond - simulates timeout
    await route.abort('timedout')
  })
}

/**
 * Simulate slow API response
 */
export const mockSlowAPI = async (
  page: Page,
  urlPattern: string | RegExp,
  delayMs: number,
  response: unknown
): Promise<void> => {
  await page.route(urlPattern, async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

// ============================================================================
// Request Capture (for verification)
// ============================================================================

interface CapturedRequest {
  url: string
  method: string
  headers: Record<string, string>
  postData: string | null
}

/**
 * Capture requests to a URL pattern for later verification
 */
export const captureRequests = async (
  page: Page,
  urlPattern: string | RegExp,
  options: { passthrough?: boolean } = {}
): Promise<CapturedRequest[]> => {
  const captured: CapturedRequest[] = []

  await page.route(urlPattern, async (route: Route) => {
    const request = route.request()
    captured.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
    })

    if (options.passthrough) {
      await route.continue()
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ captured: true }),
      })
    }
  })

  return captured
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Remove all route handlers (useful between tests)
 */
export const clearAllMocks = async (page: Page): Promise<void> => {
  await page.unrouteAll()
}
