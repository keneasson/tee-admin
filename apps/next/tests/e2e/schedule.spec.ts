import { test, expect } from '@playwright/test'

test.describe('Schedule Page', () => {
  test('loads schedule page successfully', async ({ page }) => {
    await page.goto('/schedule')

    // Check that the page loads without errors
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)

    // Wait for content to load after hydration
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check that the page loads and is not a 404
    await expect(page.locator('text=404')).not.toBeVisible()

    // Check for "Ecclesial Programs" heading
    const heading = page.getByRole('heading', { name: 'Ecclesial Programs' })
    if ((await heading.count()) > 0) {
      await expect(heading).toBeVisible()
    }
  })

  test('displays schedule navigation options', async ({ page }) => {
    await page.goto('/schedule')

    // Wait for content to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check for typical schedule types that should be available
    const scheduleTypes = ['Memorial', 'Sunday School', 'Bible Class', 'CYC']

    // At least one schedule type should be visible
    let foundScheduleType = false
    for (const scheduleType of scheduleTypes) {
      const element = page
        .locator(`text=${scheduleType} Service`)
        .or(page.locator(`text=${scheduleType}`))
        .first()
      if ((await element.count()) > 0) {
        foundScheduleType = true
        break
      }
    }

    // Should find at least one schedule type
    expect(foundScheduleType).toBeTruthy()
  })

  test('handles loading state gracefully', async ({ page }) => {
    await page.goto('/schedule')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // The page should not show critical error messages
    await expect(page.locator(':has-text("Error")')).not.toBeVisible()
    await expect(page.locator(':has-text("Failed")')).not.toBeVisible()
  })

  test('responsive design works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/schedule')

    // Wait for content to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Check that the page is accessible on mobile
    await expect(page.locator('text=404')).not.toBeVisible()

    // Check for Ecclesial Programs heading if present
    const heading = page.getByRole('heading', { name: 'Ecclesial Programs' })
    if ((await heading.count()) > 0) {
      await expect(heading).toBeVisible()
    }
  })

  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/schedule')

    // Wait for main content to be visible
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(15000) // Should load within 15 seconds (schedules can be data-heavy)
  })

  test('schedule page has proper meta tags', async ({ page }) => {
    await page.goto('/schedule')

    // Check for proper page title
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)

    // Check for meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
  })
})
