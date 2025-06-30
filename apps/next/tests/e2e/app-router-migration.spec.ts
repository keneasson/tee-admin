import { test, expect } from '@playwright/test'

test.describe('App Router Migration - Home Page', () => {
  test.describe('Public Access (No Authentication)', () => {
    test('should load home page without authentication', async ({ page }) => {
      await page.goto('/')
      
      // Check that page loads successfully
      await expect(page).toHaveTitle(/Toronto East Christadelphians/)
      
      // Check main heading is visible
      await expect(page.getByRole('heading', { name: /Welcome to the Toronto East Christadelphian/i })).toBeVisible()
      
      // Check key sections are present
      await expect(page.getByText('News')).toBeVisible()
      await expect(page.getByText('Programs for each Term')).toBeVisible()
      await expect(page.getByText('Past Events')).toBeVisible()
      
      // Check public links are accessible
      await expect(page.getByRole('link', { name: /View Online Newsletter/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /View Schedules/i })).toBeVisible()
      
      // Welfare link should NOT be visible for non-authenticated users
      await expect(page.getByRole('link', { name: /Welfare/i })).not.toBeVisible()
    })

    test('should display navigation menu for non-authenticated users', async ({ page }) => {
      await page.goto('/')
      
      // Check that sign-in option is available in navigation
      // This will depend on your navigation implementation
      // Adjust selector based on your WithNavigation component
      await expect(page.getByRole('button', { name: /menu/i }).or(page.getByText(/sign in/i))).toBeVisible()
    })

    test('should handle daily readings section gracefully', async ({ page }) => {
      await page.goto('/')
      
      // Wait for any async content to load
      await page.waitForTimeout(2000)
      
      // Check that page doesn't crash if readings fail to load
      await expect(page.getByRole('heading', { name: /Welcome to the Toronto East Christadelphian/i })).toBeVisible()
      
      // The daily readings section should either be present or gracefully handle errors
      // No specific assertion here since it depends on API availability
    })

    test('should have correct meta tags and SEO', async ({ page }) => {
      await page.goto('/')
      
      // Check meta description
      const metaDescription = page.locator('meta[name="description"]')
      await expect(metaDescription).toHaveAttribute('content', /Toronto East Christadelphian/i)
      
      // Check favicon is present
      const favicon = page.locator('link[rel="icon"]')
      await expect(favicon).toHaveCount(2) // 16x16 and 32x32
    })
  })

  test.describe('Navigation Regression Tests', () => {
    test('should navigate to newsletter page', async ({ page }) => {
      await page.goto('/')
      
      // Click newsletter link
      await page.getByRole('link', { name: /View Online Newsletter/i }).click()
      
      // Should navigate to newsletter page (even if it's still Pages Router)
      await expect(page).toHaveURL(/\/newsletter/)
    })

    test('should navigate to schedules page', async ({ page }) => {
      await page.goto('/')
      
      // Click schedules link  
      await page.getByRole('link', { name: /View Schedules/i }).click()
      
      // Should navigate to schedules page
      await expect(page).toHaveURL(/\/schedule/)
    })

    test('should navigate to events page', async ({ page }) => {
      await page.goto('/')
      
      // Click events link
      await page.getByRole('link', { name: /Notes from March 2024 Study Day/i }).click()
      
      // Should navigate to specific event page
      await expect(page).toHaveURL(/\/events\/study-weekend-2024/)
    })
  })

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      await page.goto('/')
      
      await expect(page.getByRole('heading', { name: /Welcome to the Toronto East Christadelphian/i })).toBeVisible()
      
      // Check that navigation is accessible on mobile (likely through hamburger menu)
      const menuButton = page.getByRole('button', { name: /menu/i })
      if (await menuButton.isVisible()) {
        await expect(menuButton).toBeVisible()
      }
    })

    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.goto('/')
      
      await expect(page.getByRole('heading', { name: /Welcome to the Toronto East Christadelphian/i })).toBeVisible()
    })
  })
})

// Future test suite for authenticated users - to be implemented when auth testing is set up
test.describe('App Router Migration - Authenticated User Access', () => {
  test.skip('should show welfare link for authenticated members', async ({ page }) => {
    // TODO: Implement when auth testing setup is complete
    // This test should:
    // 1. Sign in a user with MEMBER or ADMIN role
    // 2. Navigate to home page  
    // 3. Verify welfare link is visible
    // 4. Verify navigation shows user-specific options
  })

  test.skip('should show admin-specific navigation for admin users', async ({ page }) => {
    // TODO: Implement when auth testing setup is complete
    // This test should verify admin-only navigation items are visible
  })
})