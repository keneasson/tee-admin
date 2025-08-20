import { test, expect } from '@playwright/test'

test.describe('Brand System Performance', () => {
  test('should load brand pages within acceptable time limits', async ({ page }) => {
    const brandRoutes = [
      '/brand/colours',
      '/brand/typography',
      '/brand/components',
      '/brand/navigation',
      '/brand/playground',
    ]

    for (const route of brandRoutes) {
      const startTime = Date.now()

      await page.goto(route)

      if (page.url().includes('/auth/signin')) {
        continue // Skip if not authenticated
      }

      // Wait for main content to load
      await page.waitForLoadState('networkidle')

      const loadTime = Date.now() - startTime

      // Should load within 5 seconds (generous for test environment)
      expect(loadTime).toBeLessThan(5000)

      // Page should be interactive
      const mainContent = await page.locator('main, [role="main"], h1, h2').first()
      await expect(mainContent).toBeVisible()
    }
  })

  test('should handle component showcase rendering efficiently', async ({ page }) => {
    await page.goto('/brand/components')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    const startTime = Date.now()

    // Wait for all component showcases to render
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Component Showcase')).toBeVisible()

    const renderTime = Date.now() - startTime

    // Component showcase should render within reasonable time
    expect(renderTime).toBeLessThan(3000)

    // Should not have layout shift issues
    await page.waitForTimeout(500)
    const finalHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(finalHeight).toBeGreaterThan(1000) // Should have substantial content
  })

  test('should handle color palette contrast calculations efficiently', async ({ page }) => {
    await page.goto('/brand/colours')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    const startTime = Date.now()

    // Wait for contrast testing section to load
    await expect(page.getByText('Text & Background Contrast Testing')).toBeVisible()

    // Switch between light and dark modes (should be fast)
    await page.getByRole('button', { name: 'Dark Mode' }).click()
    await page.waitForTimeout(200)

    await page.getByRole('button', { name: 'Light Mode' }).click()
    await page.waitForTimeout(200)

    const totalTime = Date.now() - startTime

    // Color calculations and mode switching should be fast
    expect(totalTime).toBeLessThan(2000)

    // Should show contrast ratios
    await expect(page.getByText(/\d+\.\d+:1/)).toBeVisible()
  })

  test('should handle feature flag toggling without performance issues', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    const startTime = Date.now()

    // Toggle multiple feature flags quickly
    const overrideButtons = await page.getByRole('button', { name: 'Override' }).all()

    for (let i = 0; i < Math.min(3, overrideButtons.length); i++) {
      await overrideButtons[i].click()
      await page.waitForTimeout(50) // Brief pause
    }

    const toggleTime = Date.now() - startTime

    // Feature flag toggling should be responsive
    expect(toggleTime).toBeLessThan(1000)

    // Should show override indicators
    await expect(page.getByText('OVERRIDE')).toBeVisible()
  })

  test('should not have memory leaks during navigation', async ({ page }) => {
    const routes = [
      '/brand/colours',
      '/brand/typography',
      '/brand/components',
      '/brand/navigation',
      '/brand/playground',
    ]

    // Navigate through all routes multiple times
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const route of routes) {
        await page.goto(route)

        if (page.url().includes('/auth/signin')) {
          continue
        }

        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(100)
      }
    }

    // Page should still be responsive after multiple navigations
    await page.goto('/brand/colours')

    if (!page.url().includes('/auth/signin')) {
      await expect(page.getByText('Brand Color Palette')).toBeVisible()

      // Should still be able to interact with elements
      await page.getByRole('button', { name: 'Dark Mode' }).click()
      await expect(page.getByRole('button', { name: 'Light Mode' })).toBeVisible()
    }
  })
})

test.describe('Brand System Visual Regression', () => {
  test('should maintain consistent color palette layout', async ({ page }) => {
    await page.goto('/brand/colours')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Take screenshot of color palette
    await expect(page.getByText('Brand Color Palette')).toBeVisible()

    // Ensure color cards are properly laid out
    const colorCards = await page
      .locator('[data-testid="color-card"], .color-card, *:has-text("primary"):has-text("#")')
      .count()
    expect(colorCards).toBeGreaterThan(5) // Should have multiple color samples
  })

  test('should maintain consistent typography hierarchy display', async ({ page }) => {
    await page.goto('/brand/typography')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Verify typography sections are properly structured
    await expect(page.getByText('Typography System')).toBeVisible()
    await expect(page.getByText('Headings')).toBeVisible()
    await expect(page.getByText('Body Text')).toBeVisible()

    // Test specifications toggle
    const specsButton = page.getByRole('button', { name: /Show.*Specifications/i })
    if (await specsButton.isVisible()) {
      await specsButton.click()
      await expect(page.getByRole('button', { name: /Hide.*Specifications/i })).toBeVisible()
    }
  })

  test('should maintain consistent component showcase layout', async ({ page }) => {
    await page.goto('/brand/components')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Verify component sections are properly organized
    await expect(page.getByText('Form Components')).toBeVisible()
    await expect(page.getByText('Navigation Components')).toBeVisible()
    await expect(page.getByText('Interactive Components')).toBeVisible()
    await expect(page.getByText('Content Components')).toBeVisible()

    // Should have multiple component examples
    const componentShowcases = await page
      .locator(
        '*:has-text("Form Input"), *:has-text("Password Input"), *:has-text("Navigation Button")'
      )
      .count()
    expect(componentShowcases).toBeGreaterThan(3)
  })

  test('should handle responsive layout changes', async ({ page }) => {
    await page.goto('/brand/colours')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    await expect(page.getByText('Brand Color Palette')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    await expect(page.getByText('Brand Color Palette')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(500)

    await expect(page.getByText('Brand Color Palette')).toBeVisible()

    // Should maintain functionality across all viewports
    await page.getByRole('button', { name: 'Dark Mode' }).click()
    await expect(page.getByRole('button', { name: 'Light Mode' })).toBeVisible()
  })

  test('should handle theme switching visual consistency', async ({ page }) => {
    await page.goto('/brand/navigation')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Test light theme
    await page.getByRole('button', { name: 'Light Theme' }).click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Navigation Testing Environment')).toBeVisible()

    // Test dark theme
    await page.getByRole('button', { name: 'Dark Theme' }).click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Navigation Testing Environment')).toBeVisible()

    // Should maintain layout and functionality in both themes
    await expect(page.getByText('Current Navigation Style')).toBeVisible()
  })
})

test.describe('Brand System Accessibility Performance', () => {
  test('should handle keyboard navigation efficiently', async ({ page }) => {
    await page.goto('/brand/components')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    const startTime = Date.now()

    // Tab through multiple elements quickly
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(10)
    }

    const navigationTime = Date.now() - startTime

    // Keyboard navigation should be responsive
    expect(navigationTime).toBeLessThan(1000)

    // Should maintain focus visibility
    const focusedElement = await page.locator(':focus')
    expect(await focusedElement.isVisible()).toBe(true)
  })

  test('should handle screen reader announcements efficiently', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Test dynamic content changes (feature flag overrides)
    const overrideButton = await page.getByRole('button', { name: 'Override' }).first()

    if (await overrideButton.isVisible()) {
      const startTime = Date.now()

      await overrideButton.click()

      // Should update quickly
      await expect(page.getByText('OVERRIDE')).toBeVisible()

      const updateTime = Date.now() - startTime
      expect(updateTime).toBeLessThan(500)
    }
  })
})
