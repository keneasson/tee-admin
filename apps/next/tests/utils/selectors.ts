/**
 * Resilient Selector Helpers for Playwright Tests
 *
 * These selectors are designed to be stable across UI changes.
 * They prefer semantic selectors (role, text, testid) over CSS selectors.
 *
 * Pattern: Test for content presence, not position or styling.
 */

import type { Page, Locator } from '@playwright/test'

// ============================================================================
// Newsletter Section Selectors
// ============================================================================

export const newsletter = {
  /**
   * Get the main newsletter container
   */
  container: (page: Page): Locator => page.getByTestId('newsletter-container'),

  /**
   * Get the regular services section (Sunday School, Memorial, Bible Class)
   */
  regularServicesSection: (page: Page): Locator => page.getByTestId('newsletter-regular-services'),

  /**
   * Get specific service sections
   */
  sundaySchoolSection: (page: Page): Locator => page.getByTestId('newsletter-sunday-school'),
  memorialSection: (page: Page): Locator => page.getByTestId('newsletter-memorial'),
  bibleClassSection: (page: Page): Locator => page.getByTestId('newsletter-bible-class'),

  /**
   * Get the election notice (only visible during active elections)
   */
  electionNotice: (page: Page): Locator => page.getByTestId('newsletter-election-notice'),

  /**
   * Get the special announcements section (baptisms, weddings, funerals)
   */
  specialAnnouncementsSection: (page: Page): Locator => page.getByTestId('newsletter-special-announcements'),

  /**
   * Get the upcoming events section
   */
  upcomingEventsSection: (page: Page): Locator => page.getByTestId('newsletter-upcoming-events'),

  /**
   * Get the daily readings section
   */
  dailyReadingsSection: (page: Page): Locator => page.getByTestId('newsletter-daily-readings'),

  /**
   * Get admin toolbar (only visible to admin/owner)
   */
  adminToolbar: (page: Page): Locator => page.getByTestId('newsletter-admin-toolbar'),

  /**
   * Text-based selectors for content verification
   */
  hasElectionText: (page: Page): Locator =>
    page.getByText(/elections for service brethren/i),

  hasSundaySchoolHeading: (page: Page): Locator =>
    page.getByRole('heading', { name: /sunday school/i }),

  hasMemorialHeading: (page: Page): Locator =>
    page.getByRole('heading', { name: /memorial/i }),

  hasBibleClassHeading: (page: Page): Locator =>
    page.getByRole('heading', { name: /bible class/i }),
}

// ============================================================================
// Event Card Selectors
// ============================================================================

export const eventCard = {
  /**
   * Get an event card by its event ID
   */
  byId: (page: Page, eventId: string): Locator =>
    page.getByTestId(`event-card-${eventId}`),

  /**
   * Get all event cards
   */
  all: (page: Page): Locator => page.locator('[data-testid^="event-card-"]'),

  /**
   * Get event card by event type
   */
  byType: (page: Page, type: string): Locator =>
    page.locator(`[data-testid^="event-card-"][data-event-type="${type}"]`),

  /**
   * Get the event title within a card
   */
  title: (card: Locator): Locator => card.getByTestId('event-card-title'),

  /**
   * Get the event date within a card
   */
  date: (card: Locator): Locator => card.getByTestId('event-card-date'),

  /**
   * Get the view details button/link
   */
  viewDetailsButton: (card: Locator): Locator =>
    card.getByRole('button', { name: /view details/i }).or(
      card.getByRole('link', { name: /view details/i })
    ),
}

// ============================================================================
// Schedule Section Selectors
// ============================================================================

export const schedule = {
  /**
   * Get the main schedule container
   */
  container: (page: Page): Locator => page.getByTestId('schedule-container'),

  /**
   * Get a specific week's schedule
   */
  weekSection: (page: Page, weekIndex: number): Locator =>
    page.getByTestId(`schedule-week-${weekIndex}`),

  /**
   * Get service row by type
   */
  serviceRow: (page: Page, serviceType: 'sundaySchool' | 'memorial' | 'bibleClass'): Locator =>
    page.getByTestId(`schedule-${serviceType}`),
}

// ============================================================================
// Auth & Navigation Selectors
// ============================================================================

export const auth = {
  /**
   * Sign in button/link
   */
  signInButton: (page: Page): Locator =>
    page.getByRole('button', { name: /sign in/i }).or(
      page.getByRole('link', { name: /sign in/i })
    ),

  /**
   * Sign out button
   */
  signOutButton: (page: Page): Locator =>
    page.getByRole('button', { name: /sign out/i }),

  /**
   * Email input field
   */
  emailInput: (page: Page): Locator =>
    page.getByLabel(/email/i).or(page.locator('input[type="email"]')),

  /**
   * Password input field
   */
  passwordInput: (page: Page): Locator =>
    page.getByLabel(/password/i).or(page.locator('input[type="password"]')),

  /**
   * Submit button for auth forms
   */
  submitButton: (page: Page): Locator =>
    page.getByRole('button', { name: /sign in|log in|submit/i }),

  /**
   * Error message display
   */
  errorMessage: (page: Page): Locator =>
    page.getByRole('alert').or(page.getByTestId('auth-error')),

  /**
   * User menu (when logged in)
   */
  userMenu: (page: Page): Locator => page.getByTestId('user-menu'),
}

export const navigation = {
  /**
   * Main navigation container
   */
  mainNav: (page: Page): Locator => page.getByRole('navigation'),

  /**
   * Navigation link by name
   */
  link: (page: Page, name: string | RegExp): Locator =>
    page.getByRole('link', { name }),

  /**
   * Admin navigation section
   */
  adminNav: (page: Page): Locator => page.getByTestId('admin-navigation'),
}

// ============================================================================
// Event Form Selectors
// ============================================================================

export const eventForm = {
  /**
   * Form container
   */
  form: (page: Page): Locator => page.getByTestId('event-form'),

  /**
   * Event type selector
   */
  typeSelector: (page: Page): Locator => page.getByTestId('event-type-selector'),

  /**
   * Title input
   */
  titleInput: (page: Page): Locator =>
    page.getByLabel(/title/i).or(page.getByTestId('event-title-input')),

  /**
   * Save/Submit button
   */
  saveButton: (page: Page): Locator =>
    page.getByRole('button', { name: /save|create|submit/i }),

  /**
   * Publish button
   */
  publishButton: (page: Page): Locator =>
    page.getByRole('button', { name: /publish/i }),

  /**
   * Validation error messages
   */
  validationErrors: (page: Page): Locator =>
    page.locator('[data-testid^="field-error-"]').or(
      page.getByRole('alert')
    ),

  /**
   * Specific field error
   */
  fieldError: (page: Page, fieldName: string): Locator =>
    page.getByTestId(`field-error-${fieldName}`),
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wait for an element to be visible with a custom timeout
 */
export const waitForVisible = async (
  locator: Locator,
  options: { timeout?: number } = {}
): Promise<boolean> => {
  try {
    await locator.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if an element is NOT present on the page
 */
export const expectNotVisible = async (
  locator: Locator,
  options: { timeout?: number } = {}
): Promise<boolean> => {
  try {
    await locator.waitFor({ state: 'hidden', timeout: options.timeout ?? 2000 })
    return true
  } catch {
    // Element is visible when it shouldn't be
    return false
  }
}

/**
 * Get text content with fallback
 */
export const getTextContent = async (
  locator: Locator,
  fallback = ''
): Promise<string> => {
  try {
    return (await locator.textContent()) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Count matching elements
 */
export const countElements = async (locator: Locator): Promise<number> => {
  return await locator.count()
}
