import { test, expect } from '@playwright/test'

/**
 * Google Sheets Specific Debug Test
 * Tests our ability to access and interact with the specific test sheet
 */

const TEST_SHEET_ID = '1ffB9-VWxaTQudAskm_m9vP2bbaFwA5l_tkGimTkzXAw'
const TEST_SHEET_URL = `https://docs.google.com/spreadsheets/d/${TEST_SHEET_ID}/edit`

test.describe('Google Sheets Access Debugging', () => {
  test.setTimeout(120000) // 2 minutes timeout

  test('can navigate to our test Google Sheet', async ({ page }) => {
    console.log('📊 Testing Google Sheets access...')
    console.log('🔗 Sheet URL:', TEST_SHEET_URL)
    
    try {
      // Navigate to the sheet
      await page.goto(TEST_SHEET_URL, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })
      
      console.log('✅ Successfully navigated to Google Sheet')
      
      // Take a screenshot to see what we're working with
      await page.screenshot({ 
        path: 'apps/next/tests/e2e/debug-sheet-initial.png',
        fullPage: true 
      })
      console.log('✅ Initial sheet screenshot saved')
      
      // Check if we can see the sheet content
      const sheetTitle = await page.title()
      console.log('📄 Sheet title:', sheetTitle)
      
      // Look for common Google Sheets elements
      const gridSelectors = [
        '[role="grid"]',
        '.waffle',
        '.grid-container',
        '[data-sheet-id]',
        '.cell'
      ]
      
      let foundGrid = false
      for (const selector of gridSelectors) {
        const element = page.locator(selector)
        if (await element.isVisible()) {
          console.log(`✅ Found sheet grid with selector: ${selector}`)
          foundGrid = true
          break
        }
      }
      
      if (!foundGrid) {
        console.log('⚠️  No grid elements found - may need authentication')
        
        // Check if we're on a login page
        const signInButton = page.locator('text=Sign in', 'button:has-text("Sign in")')
        if (await signInButton.isVisible()) {
          console.log('🔐 Login required - found Sign in button')
        }
        
        // Check for access denied messages
        const accessDenied = page.locator('text=Access denied', 'text=Permission denied')
        if (await accessDenied.isVisible()) {
          console.log('❌ Access denied to sheet')
        }
      }
      
    } catch (error) {
      console.error('❌ Error accessing sheet:', error.message)
      await page.screenshot({ 
        path: 'apps/next/tests/e2e/debug-sheet-error.png',
        fullPage: true 
      })
      throw error
    }
  })

  test('debug sheet authentication and permissions', async ({ page }) => {
    console.log('🔐 Testing sheet authentication...')
    
    // Try to access sheet without auth first
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    await page.screenshot({ 
      path: 'apps/next/tests/e2e/debug-sheet-auth-check.png',
      fullPage: true 
    })
    
    // Check current URL to see if we were redirected
    const currentUrl = page.url()
    console.log('🔗 Current URL after navigation:', currentUrl)
    
    if (currentUrl.includes('accounts.google.com')) {
      console.log('🔐 Redirected to Google authentication')
      
      // Look for authentication elements
      const emailInput = page.locator('input[type="email"]')
      if (await emailInput.isVisible()) {
        console.log('✅ Found email input for authentication')
      }
      
    } else if (currentUrl.includes('docs.google.com')) {
      console.log('✅ Directly accessed sheet (may be public or cached auth)')
      
      // Try to find sheet content
      await page.waitForTimeout(3000) // Wait for sheet to load
      
      // Look for data in the sheet
      const cellSelectors = [
        '[role="gridcell"]',
        '.cell-input',
        '.s0', // Google Sheets cell class
        '[data-row]'
      ]
      
      for (const selector of cellSelectors) {
        const cells = page.locator(selector)
        const count = await cells.count()
        if (count > 0) {
          console.log(`✅ Found ${count} cells with selector: ${selector}`)
          
          // Try to read some cell content
          const firstCell = cells.first()
          const cellText = await firstCell.textContent()
          console.log('📄 First cell content:', cellText)
          break
        }
      }
      
    } else {
      console.log('⚠️  Unexpected redirect or access pattern')
    }
  })

  test('test specific cell interaction', async ({ page }) => {
    console.log('🎯 Testing cell interaction...')
    
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Wait for sheet to fully load
    await page.waitForTimeout(5000)
    
    await page.screenshot({ 
      path: 'apps/next/tests/e2e/debug-sheet-before-interaction.png',
      fullPage: true 
    })
    
    // Try different approaches to find and click cells
    const cellInteractionStrategies = [
      // Strategy 1: Direct cell coordinates
      async () => {
        const cell = page.locator('[aria-label*="A1"]')
        if (await cell.isVisible()) {
          await cell.click()
          console.log('✅ Strategy 1: Clicked cell via aria-label')
          return true
        }
        return false
      },
      
      // Strategy 2: Row/column selectors
      async () => {
        const cell = page.locator('[data-row="0"][data-col="0"]')
        if (await cell.isVisible()) {
          await cell.click()
          console.log('✅ Strategy 2: Clicked cell via data attributes')
          return true
        }
        return false
      },
      
      // Strategy 3: First gridcell
      async () => {
        const cell = page.locator('[role="gridcell"]').first()
        if (await cell.isVisible()) {
          await cell.click()
          console.log('✅ Strategy 3: Clicked first gridcell')
          return true
        }
        return false
      },
      
      // Strategy 4: CSS coordinates
      async () => {
        const cell = page.locator('.cell-input').first()
        if (await cell.isVisible()) {
          await cell.click()
          console.log('✅ Strategy 4: Clicked first cell-input')
          return true
        }
        return false
      }
    ]
    
    let successfulStrategy = false
    for (let i = 0; i < cellInteractionStrategies.length; i++) {
      try {
        const success = await cellInteractionStrategies[i]()
        if (success) {
          successfulStrategy = true
          console.log(`✅ Successfully interacted with cell using strategy ${i + 1}`)
          break
        }
      } catch (error) {
        console.log(`❌ Strategy ${i + 1} failed:`, error.message)
      }
    }
    
    if (!successfulStrategy) {
      console.log('⚠️  No cell interaction strategies worked')
      
      // Debug: List all available elements
      const allElements = await page.locator('*').count()
      console.log(`📊 Total elements on page: ${allElements}`)
      
      // Look for any clickable elements
      const clickableElements = page.locator('button, input, [role="button"], [role="gridcell"]')
      const clickableCount = await clickableElements.count()
      console.log(`🖱️  Clickable elements found: ${clickableCount}`)
      
      if (clickableCount > 0) {
        console.log('🔍 First few clickable elements:')
        for (let i = 0; i < Math.min(5, clickableCount); i++) {
          const element = clickableElements.nth(i)
          const tagName = await element.evaluate(el => el.tagName)
          const className = await element.getAttribute('class')
          const role = await element.getAttribute('role')
          console.log(`  ${i + 1}. ${tagName} - class: ${className} - role: ${role}`)
        }
      }
    }
    
    await page.screenshot({ 
      path: 'apps/next/tests/e2e/debug-sheet-after-interaction.png',
      fullPage: true 
    })
  })
})