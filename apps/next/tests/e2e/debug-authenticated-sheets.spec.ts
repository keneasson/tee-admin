import { test, expect } from '@playwright/test'

/**
 * Authenticated Google Sheets Testing
 * Tests Google Sheets access with authentication
 */

const TEST_SHEET_ID = '1ffB9-VWxaTQudAskm_m9vP2bbaFwA5l_tkGimTkzXAw'
const TEST_SHEET_URL = `https://docs.google.com/spreadsheets/d/${TEST_SHEET_ID}/edit`

test.describe('Authenticated Google Sheets Testing', () => {
  test.setTimeout(180000) // 3 minutes timeout for auth flow

  test('attempt manual authentication flow', async ({ page }) => {
    console.log('🔐 Testing manual authentication flow...')
    
    // Navigate to the sheet
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    const currentUrl = page.url()
    console.log('🔗 Redirected to:', currentUrl)
    
    if (currentUrl.includes('accounts.google.com')) {
      console.log('✅ Correctly redirected to Google authentication')
      
      await page.screenshot({ 
        path: 'apps/next/tests/e2e/auth-step-1-login-page.png',
        fullPage: true 
      })
      
      // Look for email input
      const emailInput = page.locator('input[type="email"]').first()
      
      if (await emailInput.isVisible()) {
        console.log('✅ Found email input field')
        
        // Note: In a real test, you'd enter credentials here
        // For debugging, we'll just document the process
        console.log('📝 Manual step required: Enter email and password')
        console.log('💡 For automation, consider:')
        console.log('   1. Using a test Google account')
        console.log('   2. Google Workspace service account with domain-wide delegation')
        console.log('   3. Making the sheet publicly editable (less secure)')
        console.log('   4. Using the Google Sheets API instead of browser automation')
        
        await page.waitForTimeout(5000) // Wait to see the auth page
        
      } else {
        console.log('❌ Email input not found')
        
        // Debug what's actually on the page
        const pageText = await page.textContent('body')
        console.log('📄 Page content sample:', pageText?.slice(0, 200))
      }
      
    } else {
      console.log('⚠️  Unexpected: Not redirected to authentication')
    }
  })

  test('explore alternative authentication approaches', async ({ page }) => {
    console.log('🔍 Exploring alternative approaches...')
    
    // Option 1: Try with browser context that might have existing auth
    console.log('🌐 Testing with persistent browser context...')
    
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    await page.screenshot({ 
      path: 'apps/next/tests/e2e/auth-alt-approach-1.png',
      fullPage: true 
    })
    
    // Option 2: Try accessing a public Google Sheet first to test the flow
    console.log('📊 Testing with a potentially public sheet pattern...')
    
    const publicSheetUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
    
    try {
      await page.goto(publicSheetUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })
      
      const publicUrl = page.url()
      console.log('🔗 Public sheet URL result:', publicUrl)
      
      if (!publicUrl.includes('accounts.google.com')) {
        console.log('✅ Successfully accessed a public sheet without auth')
        
        await page.screenshot({ 
          path: 'apps/next/tests/e2e/auth-public-sheet-success.png',
          fullPage: true 
        })
        
        // Try to find sheet elements in the public sheet
        await page.waitForTimeout(3000)
        
        const cellSelectors = [
          '[role="gridcell"]',
          '.cell',
          '[data-sheets-value]',
          '.waffle'
        ]
        
        for (const selector of cellSelectors) {
          const elements = page.locator(selector)
          const count = await elements.count()
          if (count > 0) {
            console.log(`✅ Found ${count} elements with selector: ${selector}`)
            
            // Try to interact with the first cell
            try {
              const firstElement = elements.first()
              await firstElement.click()
              console.log('✅ Successfully clicked a cell in public sheet!')
              
              await page.screenshot({ 
                path: 'apps/next/tests/e2e/auth-public-sheet-cell-clicked.png',
                fullPage: true 
              })
              
              break
            } catch (error) {
              console.log(`Could not click element: ${(error as Error).message}`)
            }
          }
        }
      } else {
        console.log('⚠️  Even public sheet requires authentication')
      }
      
    } catch (error) {
      console.log('Error accessing public sheet:', (error as Error).message)
    }
  })

  test('document requirements for successful automation', async ({ page }) => {
    console.log('📋 Documenting requirements for Google Sheets automation...')
    
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    await page.screenshot({ 
      path: 'apps/next/tests/e2e/auth-requirements-analysis.png',
      fullPage: true 
    })
    
    console.log('📝 Requirements for Google Sheets Playwright automation:')
    console.log('')
    console.log('✅ WORKING: Basic Playwright functionality')
    console.log('✅ WORKING: Navigation to Google Sheets URLs')
    console.log('✅ WORKING: Detection of authentication requirements')
    console.log('')
    console.log('❌ BLOCKED: Authentication required for sheet access')
    console.log('')
    console.log('🔧 SOLUTIONS:')
    console.log('1. Service Account Authentication:')
    console.log('   - Use Google Workspace domain-wide delegation')
    console.log('   - Configure service account with edit permissions')
    console.log('   - Handle OAuth flow in Playwright')
    console.log('')
    console.log('2. Test Account Approach:')
    console.log('   - Create dedicated test Google account')
    console.log('   - Share sheet with test account')
    console.log('   - Store test credentials securely')
    console.log('   - Automate login flow')
    console.log('')
    console.log('3. Public Sheet Approach:')
    console.log('   - Make test sheet publicly editable')
    console.log('   - Less secure but simpler for testing')
    console.log('')
    console.log('4. API-First Approach (RECOMMENDED):')
    console.log('   - Use Google Sheets API for data changes')
    console.log('   - Use Playwright to verify changes appear in UI')
    console.log('   - Combine API writes with browser verification')
    console.log('')
    console.log('💡 RECOMMENDATION:')
    console.log('   Use hybrid approach: Google Sheets API + Playwright verification')
    console.log('   This leverages existing working API connection')
  })
})