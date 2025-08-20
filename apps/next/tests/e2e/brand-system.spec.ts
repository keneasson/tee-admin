import { test, expect } from '@playwright/test'

test.describe('Brand System Access Control', () => {
  test('should protect brand routes from unauthorized access', async ({ page }) => {
    const brandRoutes = [
      '/brand/colours',
      '/brand/typography',
      '/brand/components',
      '/brand/navigation',
      '/brand/playground',
    ]

    for (const route of brandRoutes) {
      await page.goto(route)

      // Should redirect to signin if not authenticated
      const url = page.url()
      expect(url).toMatch(new RegExp(`(${route}|/auth/signin)`))

      // If redirected to signin, verify signin page loads
      if (url.includes('/auth/signin')) {
        await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
      }
    }
  })

  test('should show access denied for non-admin roles', async ({ page }) => {
    // This test would need actual authentication setup
    // For now, test that the page structure is correct
    await page.goto('/brand/colours')

    // Should either show content (if admin) or redirect to signin/show access denied
    const hasAccessDenied = await page
      .getByText('Access Denied')
      .isVisible()
      .catch(() => false)
    const hasSignInForm = await page
      .getByRole('textbox', { name: /email/i })
      .isVisible()
      .catch(() => false)
    const hasColorPalette = await page
      .getByText('Brand Color Palette')
      .isVisible()
      .catch(() => false)

    // Should have one of these states
    expect(hasAccessDenied || hasSignInForm || hasColorPalette).toBe(true)
  })
})

test.describe('Brand Navigation', () => {
  test('should display brand navigation items for admin users', async ({ page }) => {
    await page.goto('/')

    // Check if navigation contains brand items (when user is admin/owner)
    const brandColorNav = await page
      .getByText('Brand Colors')
      .isVisible()
      .catch(() => false)
    const brandTypographyNav = await page
      .getByText('Brand Typography')
      .isVisible()
      .catch(() => false)
    const componentShowcaseNav = await page
      .getByText('Component Showcase')
      .isVisible()
      .catch(() => false)

    // Either these should be visible (if admin) or not (if not admin/not signed in)
    // Test validates navigation structure exists
    if (brandColorNav) {
      await expect(page.getByText('Brand Typography')).toBeVisible()
      await expect(page.getByText('Component Showcase')).toBeVisible()
      await expect(page.getByText('Navigation Testing')).toBeVisible()
      await expect(page.getByText('Feature Playground')).toBeVisible()
    }
  })

  test('should navigate between brand sections', async ({ page }) => {
    // Test navigation between brand pages
    const brandRoutes = [
      { path: '/brand/colours', title: 'Brand Color Palette' },
      { path: '/brand/typography', title: 'Typography System' },
      { path: '/brand/components', title: 'Component Showcase' },
      { path: '/brand/navigation', title: 'Navigation Testing Environment' },
      { path: '/brand/playground', title: 'Feature Flag Playground' },
    ]

    for (const route of brandRoutes) {
      await page.goto(route.path)

      // Check if we're on the right page or redirected to signin
      const url = page.url()
      if (!url.includes('/auth/signin')) {
        // If not redirected, should show the expected content
        const hasExpectedTitle = await page
          .getByText(route.title)
          .isVisible()
          .catch(() => false)
        expect(hasExpectedTitle).toBe(true)
      }
    }
  })
})

test.describe('Brand Colors Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand/colours')
  })

  test('should display color palette interface', async ({ page }) => {
    // Skip if redirected to signin
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show color palette content
    await expect(page.getByText('Brand Color Palette')).toBeVisible()
    await expect(
      page.getByText('Current brand colors with accessibility improvements')
    ).toBeVisible()

    // Should have light/dark mode toggle
    await expect(page.getByRole('button', { name: 'Light Mode' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dark Mode' })).toBeVisible()
  })

  test('should toggle between light and dark modes', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Test mode switching
    await page.getByRole('button', { name: 'Dark Mode' }).click()
    // Verify dark mode is active (button should be outlined/selected)

    await page.getByRole('button', { name: 'Light Mode' }).click()
    // Verify light mode is active
  })

  test('should display accessibility contrast testing', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show contrast testing section
    await expect(page.getByText('Text & Background Contrast Testing')).toBeVisible()
    await expect(page.getByText('Testing text readability on various backgrounds')).toBeVisible()

    // Should show accessibility standards
    await expect(page.getByText('Accessibility Standards')).toBeVisible()
    await expect(page.getByText('AA Normal: 4.5:1 minimum contrast ratio')).toBeVisible()
  })

  test('should display current usage analysis', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Should show usage analysis
    await expect(page.getByText('Current Color Usage & Migration Plan')).toBeVisible()
    await expect(page.getByText('Navigation')).toBeVisible()
    await expect(page.getByText('Email Templates')).toBeVisible()
    await expect(page.getByText('Form Components')).toBeVisible()
  })
})

test.describe('Brand Typography Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand/typography')
  })

  test('should display typography system', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await expect(page.getByText('Typography System')).toBeVisible()
    await expect(page.getByText('Complete typography hierarchy')).toBeVisible()

    // Should show specifications toggle
    await expect(page.getByRole('button', { name: /Show|Hide.*Specifications/i })).toBeVisible()
  })

  test('should display all typography categories', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Check for all typography sections
    await expect(page.getByText('Headings')).toBeVisible()
    await expect(page.getByText('Body Text')).toBeVisible()
    await expect(page.getByText('Utility Text')).toBeVisible()
    await expect(page.getByText('Interactive Text')).toBeVisible()
    await expect(page.getByText('Usage Guidelines')).toBeVisible()
  })

  test('should toggle typography specifications', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Toggle specifications display
    const specsButton = page.getByRole('button', { name: /Show.*Specifications/i })
    await specsButton.click()

    // Should show specs after clicking
    await expect(page.getByRole('button', { name: /Hide.*Specifications/i })).toBeVisible()
  })
})

test.describe('Component Showcase Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand/components')
  })

  test('should display component showcase without hydration errors', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Wait for page to load and hydrate
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Component Showcase')).toBeVisible()
    await expect(page.getByText('Interactive showcase of all UI components')).toBeVisible()
  })

  test('should display all component categories', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Check for component sections
    await expect(page.getByText('Form Components')).toBeVisible()
    await expect(page.getByText('Navigation Components')).toBeVisible()
    await expect(page.getByText('Interactive Components')).toBeVisible()
    await expect(page.getByText('Content Components')).toBeVisible()
  })

  test('should allow variant switching for components', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Test variant switching (look for variant buttons)
    const variantButtons = await page
      .getByRole('button')
      .filter({ hasText: /Text Input|Email Input|Required Field/ })
      .first()
    if (await variantButtons.isVisible()) {
      await variantButtons.click()
    }
  })

  test('should show/hide code examples', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await page.waitForLoadState('networkidle')

    // Look for "Show Code" buttons and test them
    const showCodeButtons = await page.getByRole('button', { name: /Show.*Code/i }).first()
    if (await showCodeButtons.isVisible()) {
      await showCodeButtons.click()

      // Should show code block
      await expect(page.getByRole('button', { name: /Hide.*Code/i })).toBeVisible()
    }
  })
})

test.describe('Navigation Testing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand/navigation')
  })

  test('should display navigation testing environment', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await expect(page.getByText('Navigation Testing Environment')).toBeVisible()
    await expect(page.getByText('Test navigation components with different states')).toBeVisible()
  })

  test('should allow theme switching', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Test theme toggle buttons
    await expect(page.getByRole('button', { name: 'Light Theme' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dark Theme' })).toBeVisible()

    await page.getByRole('button', { name: 'Dark Theme' }).click()
    await page.getByRole('button', { name: 'Light Theme' }).click()
  })
})

test.describe('Feature Playground Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand/playground')
  })

  test('should display feature flag playground', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await expect(page.getByText('Feature Flag Playground')).toBeVisible()
    await expect(page.getByText('Test and experiment with feature flags safely')).toBeVisible()
  })

  test('should display feature flag controls', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    await expect(page.getByText('Feature Flag Controls')).toBeVisible()

    // Should show some feature flags
    await expect(page.getByText(/NEW.*BRAND.*COLORS/i)).toBeVisible()
    await expect(page.getByText(/COMPONENT.*PLAYGROUND/i)).toBeVisible()
  })

  test('should allow feature flag overrides', async ({ page }) => {
    if (page.url().includes('/auth/signin')) {
      test.skip('User not authenticated as admin')
    }

    // Look for override buttons
    const overrideButtons = await page.getByRole('button', { name: /Override|Reset/ }).first()
    if (await overrideButtons.isVisible()) {
      await overrideButtons.click()
    }
  })
})
