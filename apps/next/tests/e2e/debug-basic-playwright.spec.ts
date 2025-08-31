import { test, expect } from '@playwright/test'

/**
 * Basic Playwright Debug Test
 * Tests fundamental Playwright functionality before Google Sheets automation
 */

test.describe('Basic Playwright Debugging', () => {
  test.setTimeout(60000) // 1 minute timeout

  test('verify playwright can open a basic webpage', async ({ page }) => {
    console.log('🧪 Testing basic Playwright functionality...')
    
    // Test basic navigation
    await page.goto('https://www.google.com', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    })
    
    console.log('✅ Successfully navigated to Google')
    
    // Test basic element interaction
    const searchBox = page.locator('textarea[name="q"]')
    await expect(searchBox).toBeVisible()
    console.log('✅ Found Google search box')
    
    // Test typing
    await searchBox.fill('playwright test')
    console.log('✅ Successfully typed in search box')
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'apps/next/tests/automation/debug-google-search.png',
      fullPage: false 
    })
    console.log('✅ Screenshot saved')
  })

  test('verify playwright can handle authentication', async ({ page }) => {
    console.log('🔐 Testing authentication flow...')
    
    // Navigate to Google account login
    await page.goto('https://accounts.google.com', {
      waitUntil: 'networkidle',
      timeout: 10000
    })
    
    console.log('✅ Reached Google accounts page')
    
    // Look for email input
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible()) {
      console.log('✅ Found email input field')
    } else {
      console.log('ℹ️  No email input visible (may already be logged in)')
    }
    
    // Take screenshot of auth page
    await page.screenshot({ 
      path: 'apps/next/tests/automation/debug-auth-page.png',
      fullPage: true 
    })
    console.log('✅ Auth page screenshot saved')
  })
})