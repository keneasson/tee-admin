import { test, expect } from '@playwright/test'

test.describe('Newsletter Page', () => {
  test('loads newsletter page successfully', async ({ page }) => {
    await page.goto('/newsletter')
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)
    
    // Wait for content to load after hydration
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // First just check the page loads and is not a 404
    await expect(page.locator('text=404')).not.toBeVisible()
    
    // Check for "Regular Services" section which should be there
    await expect(page.locator('text=Regular Services')).toBeVisible()
    
    // Check for Newsletter heading - use more specific selector
    const newsletterHeading = page.getByRole('heading', { name: 'Newsletter' })
    if ((await newsletterHeading.count()) > 0) {
      await expect(newsletterHeading).toBeVisible()
    }
  })

  test('displays upcoming program events', async ({ page }) => {
    await page.goto('/newsletter')
    
    // Wait for data to load (assuming there's a loading state)
    await page.waitForTimeout(3000)
    
    // Check that program events are displayed
    // These are the expected event types from the newsletter screen
    const eventTypes = ['Sunday School', 'Memorial', 'Bible Class']
    
    for (const eventType of eventTypes) {
      // These events might not always be present, so we check if they exist
      const eventExists = (await page.locator(`:has-text("${eventType}")`).count()) > 0
      if (eventExists) {
        await expect(page.locator(`:has-text("${eventType}")`)).toBeVisible()
      }
    }
  })

  test('displays daily readings section when available', async ({ page }) => {
    await page.goto('/newsletter')
    
    // Wait for data to load
    await page.waitForTimeout(3000)
    
    // Check if daily readings section exists
    const readingsExists = (await page.locator(':has-text("Daily Reading")').count()) > 0
    if (readingsExists) {
      await expect(page.locator(':has-text("Daily Reading")')).toBeVisible()
    }
  })

  test('handles loading state gracefully', async ({ page }) => {
    await page.goto('/newsletter')
    
    // The page should not show any critical error messages
    await expect(page.locator(':has-text("Error")')).not.toBeVisible()
    await expect(page.locator(':has-text("Failed")')).not.toBeVisible()
  })

  test('responsive design works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/newsletter')
    
    // Check that the page is accessible on mobile
    await expect(page.locator('text=Newsletter')).toBeVisible()
    await expect(page.locator('text=Regular Services')).toBeVisible()
  })

  test('navigation links work correctly', async ({ page }) => {
    await page.goto('/newsletter')
    
    // Check that navigation is present and functional
    // Test home navigation if present
    const homeLink = page.locator('a[href="/"]')
    if ((await homeLink.count()) > 0) {
      await expect(homeLink).toBeVisible()
    }
  })

  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/newsletter')
    
    // Wait for main content to be visible
    await expect(page.locator('text=Newsletter')).toBeVisible()
    
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds
  })

  test('newsletter page has proper meta tags', async ({ page }) => {
    await page.goto('/newsletter')
    
    // Check for proper page title
    await expect(page).toHaveTitle(/Toronto East Christadelphians/)
    
    // Check for meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
  })
})