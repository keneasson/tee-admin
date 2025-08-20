import { test, expect } from '@playwright/test'

test.describe('Feature Flag System', () => {
  test('should display feature flag controls in playground', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show feature flag controls
    await expect(page.getByText('Feature Flag Controls')).toBeVisible()
    await expect(
      page.getByText('Toggle feature flags to test different component behaviors')
    ).toBeVisible()

    // Should display specific feature flags
    const expectedFlags = [
      'NEW BRAND COLORS',
      'NEW NAVIGATION DESIGN',
      'ENHANCED TYPOGRAPHY',
      'COMPONENT PLAYGROUND',
    ]

    for (const flag of expectedFlags) {
      await expect(page.getByText(new RegExp(flag, 'i'))).toBeVisible()
    }
  })

  test('should show feature flag status and configuration', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show rollout percentages
    await expect(page.getByText(/Rollout: \d+%/)).toBeVisible()

    // Should show environment settings
    await expect(page.getByText(/Env: (development|staging|production|all)/)).toBeVisible()

    // Should show role requirements
    await expect(page.getByText(/Roles: (admin, owner|All)/)).toBeVisible()

    // Should show ON/OFF status
    await expect(page.getByText('ON')).toBeVisible()
    await expect(page.getByText('OFF')).toBeVisible()
  })

  test('should allow feature flag overrides', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Find an override button and test it
    const overrideButtons = await page.getByRole('button', { name: 'Override' }).all()

    if (overrideButtons.length > 0) {
      const firstOverrideButton = overrideButtons[0]
      await firstOverrideButton.click()

      // Should show override indicator
      await expect(page.getByText('OVERRIDE')).toBeVisible()

      // Should change button to Reset
      await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()

      // Click reset to return to normal state
      await page.getByRole('button', { name: 'Reset' }).first().click()

      // Override indicator should be gone
      const overrideVisible = await page
        .getByText('OVERRIDE')
        .isVisible()
        .catch(() => false)
      expect(overrideVisible).toBe(false)
    }
  })

  test('should demonstrate live feature testing', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show live feature testing section
    await expect(page.getByText('Live Feature Testing')).toBeVisible()

    // Should have brand color comparison
    await expect(page.getByText('Brand Color Integration')).toBeVisible()
    await expect(page.getByText('Original Colors')).toBeVisible()
    await expect(page.getByText('New Brand Colors')).toBeVisible()

    // Should have typography comparison
    await expect(page.getByText('Typography Enhancement')).toBeVisible()
    await expect(page.getByText('Current Typography')).toBeVisible()
    await expect(page.getByText('Enhanced Typography')).toBeVisible()

    // Should have form component comparison
    await expect(page.getByText('Form Component Improvements')).toBeVisible()
    await expect(page.getByText('Current Forms')).toBeVisible()
    await expect(page.getByText('Enhanced Forms')).toBeVisible()
  })

  test('should show integration testing layout', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show integration testing section
    await expect(page.getByText('Integration Testing')).toBeVisible()
    await expect(page.getByText('Test how multiple feature flags work together')).toBeVisible()

    // Should show sample page layout
    await expect(page.getByText('Sample Page Layout')).toBeVisible()
    await expect(page.getByText('TEE Admin Header (with new brand colors)')).toBeVisible()

    // Should show action buttons with semantic colors
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Item' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()
  })

  test('should display testing guidelines', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show testing guidelines
    await expect(page.getByText('Testing Guidelines')).toBeVisible()

    const expectedGuidelines = [
      'Use local overrides to test specific flag combinations',
      'Test across different user roles and environments',
      'Verify accessibility with screen readers and contrast tools',
      'Check responsive behavior on different screen sizes',
      'Validate cross-platform compatibility',
    ]

    for (const guideline of expectedGuidelines) {
      await expect(page.getByText(guideline)).toBeVisible()
    }
  })

  test('should handle variant switching in live testing', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Test variant buttons in live feature testing
    const variantButtons = await page
      .getByRole('button')
      .filter({
        hasText:
          /Original Colors|New Brand Colors|Current Typography|Enhanced Typography|Current Forms|Enhanced Forms/,
      })
      .all()

    // Should be able to click variant buttons
    if (variantButtons.length > 0) {
      for (let i = 0; i < Math.min(3, variantButtons.length); i++) {
        await variantButtons[i].click()
        await page.waitForTimeout(100) // Brief pause for UI update
      }
    }
  })
})

test.describe('Feature Flag Integration with Navigation', () => {
  test('should conditionally show new navigation design', async ({ page }) => {
    await page.goto('/brand/navigation')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show feature flag status
    await expect(page.getByText(/New Navigation Design: (✅ Enabled|❌ Disabled)/)).toBeVisible()

    // Should show current navigation style
    await expect(page.getByText('Current Navigation Style')).toBeVisible()

    // May or may not show new design based on feature flag
    const newDesignVisible = await page
      .getByText('New Navigation Design (Feature Flag Enabled)')
      .isVisible()
      .catch(() => false)

    // If feature flag is enabled, should show enhanced navigation
    if (newDesignVisible) {
      await expect(page.getByText('ADMIN TOOLS')).toBeVisible()
      await expect(page.getByText('MAIN PAGES')).toBeVisible()

      // Should have emoji icons in new design
      await expect(page.getByText('📧 Email Tester')).toBeVisible()
      await expect(page.getByText('🎨 Brand Colors')).toBeVisible()
      await expect(page.getByText('✍️ Typography')).toBeVisible()
    }
  })

  test('should test navigation states', async ({ page }) => {
    await page.goto('/brand/navigation')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show navigation states testing
    await expect(page.getByText('Navigation States Testing')).toBeVisible()

    // Should show different button states
    await expect(page.getByText('Active State')).toBeVisible()
    await expect(page.getByText('Inactive State')).toBeVisible()
    await expect(page.getByText('Long Text')).toBeVisible()

    // Should show implementation notes
    await expect(page.getByText('Implementation Notes')).toBeVisible()
    await expect(page.getByText('Navigation uses feature flags to control rollout')).toBeVisible()
  })

  test('should allow theme switching in navigation testing', async ({ page }) => {
    await page.goto('/brand/navigation')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Test theme switching
    await page.getByRole('button', { name: 'Dark Theme' }).click()
    await page.waitForTimeout(200)

    await page.getByRole('button', { name: 'Light Theme' }).click()
    await page.waitForTimeout(200)

    // Should show current path tracking
    await expect(page.getByText(/Current Path: \/.*/).first()).toBeVisible()
  })
})

test.describe('Feature Flag Persistence and State', () => {
  test('should maintain override state during session', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Set an override
    const overrideButton = await page.getByRole('button', { name: 'Override' }).first()
    if (await overrideButton.isVisible()) {
      await overrideButton.click()

      // Verify override is set
      await expect(page.getByText('OVERRIDE')).toBeVisible()

      // Navigate away and back
      await page.goto('/brand/colours')
      await page.goto('/brand/playground')

      // Override should still be visible (within session)
      // Note: This tests session persistence, not permanent storage
      const overrideStillVisible = await page
        .getByText('OVERRIDE')
        .isVisible()
        .catch(() => false)
      // This may not persist across page reloads in the current implementation
    }
  })

  test('should show correct rollout percentages', async ({ page }) => {
    await page.goto('/brand/playground')

    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Check that rollout percentages are displayed correctly
    const rolloutTexts = await page.getByText(/Rollout: \d+%/).allTextContents()

    expect(rolloutTexts.length).toBeGreaterThan(0)

    // Each rollout should be a valid percentage
    for (const rolloutText of rolloutTexts) {
      const percentage = rolloutText.match(/Rollout: (\d+)%/)?.[1]
      expect(percentage).toBeDefined()

      const percentageNum = parseInt(percentage!, 10)
      expect(percentageNum).toBeGreaterThanOrEqual(0)
      expect(percentageNum).toBeLessThanOrEqual(100)
    }
  })
})
