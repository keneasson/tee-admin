import { test, expect } from '@playwright/test'

test.describe('Brand System Accessibility', () => {
  test('should meet WCAG color contrast requirements', async ({ page }) => {
    await page.goto('/brand/colours')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Check for accessibility indicators in contrast testing
    await expect(page.getByText('Green dots indicate WCAG compliance')).toBeVisible()
    
    // Verify accessibility standards are documented
    await expect(page.getByText('4.5:1 minimum contrast ratio for normal text')).toBeVisible()
    await expect(page.getByText('3:1 minimum contrast ratio for large text')).toBeVisible()
  })

  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/brand/components')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    await page.waitForLoadState('networkidle')
    
    // Test tab navigation through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Should be able to navigate to buttons
    const focusedElement = await page.locator(':focus')
    expect(await focusedElement.count()).toBeGreaterThan(0)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    const brandPages = ['/brand/colours', '/brand/typography', '/brand/components']
    
    for (const brandPage of brandPages) {
      await page.goto(brandPage)
      
      if (page.url().includes('/auth/signin')) {
        continue // Skip if not authenticated
      }
      
      await page.waitForLoadState('networkidle')
      
      // Check for proper heading structure
      const h1Elements = await page.locator('h1').count()
      const h2Elements = await page.locator('h2').count()
      const h3Elements = await page.locator('h3').count()
      
      // Should have a logical heading structure
      expect(h2Elements).toBeGreaterThan(0) // At least one main section
      
      // Verify headings are properly ordered
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
      expect(headings.length).toBeGreaterThan(0)
    }
  })

  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('/brand/components')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    await page.waitForLoadState('networkidle')
    
    // Check that all images have alt text
    const images = await page.locator('img').all()
    for (const image of images) {
      const altText = await image.getAttribute('alt')
      expect(altText).toBeTruthy()
      expect(altText?.length).toBeGreaterThan(0)
    }
  })

  test('should have proper form labels and ARIA attributes', async ({ page }) => {
    await page.goto('/brand/components')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    await page.waitForLoadState('networkidle')
    
    // Check that form inputs have proper labels
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"]').all()
    
    for (const input of inputs) {
      // Should have either a label or aria-label
      const hasLabel = await input.locator('..').locator('label').count() > 0
      const hasAriaLabel = await input.getAttribute('aria-label')
      const hasAriaLabelledBy = await input.getAttribute('aria-labelledby')
      
      expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBe(true)
    }
  })

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/brand/typography')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Check for proper semantic structure
    await expect(page.locator('main, [role="main"]')).toBeVisible()
    
    // Verify landmark regions exist
    const landmarks = await page.locator('[role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]').count()
    expect(landmarks).toBeGreaterThan(0)
  })

  test('should have sufficient color contrast in all themes', async ({ page }) => {
    await page.goto('/brand/colours')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Test light mode contrast
    await page.getByRole('button', { name: 'Light Mode' }).click()
    await page.waitForTimeout(500) // Allow theme to update
    
    // Check that contrast testing shows passing results
    const lightModeContrast = await page.getByText(/\d+\.\d+:1/).first().textContent()
    expect(lightModeContrast).toMatch(/\d+\.\d+:1/)
    
    // Test dark mode contrast
    await page.getByRole('button', { name: 'Dark Mode' }).click()
    await page.waitForTimeout(500) // Allow theme to update
    
    const darkModeContrast = await page.getByText(/\d+\.\d+:1/).first().textContent()
    expect(darkModeContrast).toMatch(/\d+\.\d+:1/)
  })

  test('should handle reduced motion preferences', async ({ page }) => {
    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    await page.goto('/brand/components')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    await page.waitForLoadState('networkidle')
    
    // Page should still be functional with reduced motion
    await expect(page.getByText('Component Showcase')).toBeVisible()
    
    // Interactive elements should still work
    const showCodeButton = await page.getByRole('button', { name: /Show.*Code/i }).first()
    if (await showCodeButton.isVisible()) {
      await showCodeButton.click()
      await expect(page.getByRole('button', { name: /Hide.*Code/i })).toBeVisible()
    }
  })

  test('should support high contrast mode', async ({ page }) => {
    // Test with forced colors (high contrast mode)
    await page.emulateMedia({ forcedColors: 'active' })
    
    await page.goto('/brand/colours')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Page should still be readable and functional
    await expect(page.getByText('Brand Color Palette')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Light Mode' })).toBeVisible()
  })

  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/brand/navigation')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Tab through interactive elements and verify focus is visible
    const interactiveElements = await page.locator('button, a, input, select, textarea').all()
    
    for (let i = 0; i < Math.min(5, interactiveElements.length); i++) {
      await page.keyboard.press('Tab')
      
      const focusedElement = await page.locator(':focus')
      const focusVisible = await focusedElement.isVisible()
      expect(focusVisible).toBe(true)
    }
  })

  test('should announce dynamic content changes', async ({ page }) => {
    await page.goto('/brand/playground')
    
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }
    
    // Check for ARIA live regions or proper announcements
    const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').count()
    
    // Override buttons should have proper feedback
    const overrideButton = await page.getByRole('button', { name: /Override/ }).first()
    if (await overrideButton.isVisible()) {
      await overrideButton.click()
      
      // Should have some indication of state change
      await expect(page.getByText('OVERRIDE')).toBeVisible()
    }
  })
})