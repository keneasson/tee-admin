import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Playwright Automation for Google Sheets Manipulation
 * This simulates human interaction with Google Sheets to trigger webhooks
 */

// Configuration - you'll need to set the actual sheet URL after creation
const TEST_SHEET_URL = process.env.TEST_SYNC_SHEET_URL || 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit'
const SNAPSHOT_DIR = path.join(__dirname, '../../snapshots/sheets')

// Ensure snapshot directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
}

test.describe('Google Sheets Sync Automation', () => {
  test.setTimeout(120000) // 2 minutes timeout for the full flow

  test('manipulate sheet and verify sync', async ({ page }) => {
    console.log('🤖 Starting Google Sheets automation...')
    
    // Step 1: Navigate to the Google Sheet
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Wait for sheet to fully load
    await page.waitForTimeout(3000)
    
    // Step 2: Take initial snapshot
    const beforeSnapshot = await captureSheetData(page)
    fs.writeFileSync(
      path.join(SNAPSHOT_DIR, `before-${Date.now()}.json`),
      JSON.stringify(beforeSnapshot, null, 2)
    )
    console.log('📸 Captured initial sheet state:', beforeSnapshot)
    
    // Step 3: Add new row with test data
    const testData = {
      date: new Date().toISOString().split('T')[0],
      name: `Automated Test ${Date.now()}`,
      topic: `Sync Test ${Math.floor(Math.random() * 1000)}`
    }
    
    console.log('✏️ Adding new row with data:', testData)
    
    // Find the first empty row (usually row 4 if we have headers + 2 data rows)
    // Click on cell A4 (or next empty row)
    await clickCell(page, 'A', 4)
    await page.keyboard.type(testData.date)
    await page.keyboard.press('Tab')
    
    // Type in cell B4
    await page.keyboard.type(testData.name)
    await page.keyboard.press('Tab')
    
    // Type in cell C4
    await page.keyboard.type(testData.topic)
    await page.keyboard.press('Enter')
    
    // Wait for auto-save
    await page.waitForTimeout(5000)
    
    // Step 4: Take snapshot after modification
    const afterSnapshot = await captureSheetData(page)
    fs.writeFileSync(
      path.join(SNAPSHOT_DIR, `after-${Date.now()}.json`),
      JSON.stringify(afterSnapshot, null, 2)
    )
    console.log('📸 Captured modified sheet state:', afterSnapshot)
    
    // Step 5: Verify the change was made
    const newRowFound = afterSnapshot.rows.some(row => 
      row.includes(testData.name) && row.includes(testData.topic)
    )
    expect(newRowFound).toBe(true)
    console.log('✅ New row successfully added to sheet')
    
    // Step 6: Wait for webhook to process (30s debounce + buffer)
    console.log('⏰ Waiting 35 seconds for webhook to process...')
    await page.waitForTimeout(35000)
    
    // Step 7: Check DynamoDB via our API
    const syncStatus = await checkSyncStatus(page)
    console.log('🔍 Sync status:', syncStatus)
    
    // Step 8: Verify data made it to DynamoDB
    const dynamoData = await getDynamoData(page)
    const syncedRow = dynamoData.find((item: any) => 
      item.Name === testData.name && item.Topic === testData.topic
    )
    
    expect(syncedRow).toBeTruthy()
    console.log('✅ Data successfully synced to DynamoDB!')
    
    // Save final verification
    const verificationResult = {
      timestamp: new Date().toISOString(),
      testData,
      beforeSnapshot: beforeSnapshot.rows.length,
      afterSnapshot: afterSnapshot.rows.length,
      dynamoData: dynamoData.length,
      success: true
    }
    
    fs.writeFileSync(
      path.join(SNAPSHOT_DIR, `verification-${Date.now()}.json`),
      JSON.stringify(verificationResult, null, 2)
    )
  })

  test('modify existing row and verify update', async ({ page }) => {
    console.log('🤖 Testing row modification...')
    
    await page.goto(TEST_SHEET_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    await page.waitForTimeout(3000)
    
    // Capture initial state
    const beforeSnapshot = await captureSheetData(page)
    console.log('📸 Initial state captured')
    
    // Modify cell B2 (second data row, Name column)
    await clickCell(page, 'B', 2)
    
    // Clear existing content
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    
    // Type new content
    const modifiedName = `Modified ${Date.now()}`
    await page.keyboard.type(modifiedName)
    await page.keyboard.press('Enter')
    
    // Wait for auto-save
    await page.waitForTimeout(5000)
    
    // Capture modified state
    const afterSnapshot = await captureSheetData(page)
    console.log('📸 Modified state captured')
    
    // Verify modification in sheet
    const modifiedRow = afterSnapshot.rows.find(row => row.includes(modifiedName))
    expect(modifiedRow).toBeTruthy()
    
    console.log('✅ Row successfully modified in sheet')
    
    // Wait for sync
    console.log('⏰ Waiting for sync...')
    await page.waitForTimeout(35000)
    
    // Verify in DynamoDB
    const dynamoData = await getDynamoData(page)
    const syncedModification = dynamoData.find((item: any) => 
      item.Name === modifiedName
    )
    
    expect(syncedModification).toBeTruthy()
    console.log('✅ Modification successfully synced to DynamoDB!')
  })
})

/**
 * Helper function to capture sheet data
 */
async function captureSheetData(page: Page): Promise<{ rows: string[][], timestamp: string }> {
  try {
    // Try to capture data from the visible cells
    // This is a simplified approach - in production you'd want more robust selectors
    const rows = await page.evaluate(() => {
      const cells = document.querySelectorAll('.cell-input')
      const data: string[][] = []
      let currentRow: string[] = []
      let currentRowIndex = 0
      
      cells.forEach((cell: any, index) => {
        const rowIndex = Math.floor(index / 3) // Assuming 3 columns
        if (rowIndex !== currentRowIndex) {
          if (currentRow.length > 0) data.push(currentRow)
          currentRow = []
          currentRowIndex = rowIndex
        }
        currentRow.push(cell.textContent || '')
      })
      
      if (currentRow.length > 0) data.push(currentRow)
      return data
    })
    
    return {
      rows,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.warn('Failed to capture sheet data with primary method, using fallback')
    // Fallback: Take a screenshot for manual verification
    await page.screenshot({ 
      path: path.join(SNAPSHOT_DIR, `sheet-${Date.now()}.png`),
      fullPage: true 
    })
    return { rows: [], timestamp: new Date().toISOString() }
  }
}

/**
 * Helper function to click a specific cell
 */
async function clickCell(page: Page, column: string, row: number) {
  // Google Sheets cell selector pattern
  // This may need adjustment based on actual Google Sheets DOM
  const cellSelector = `[id*="${column}${row}"]`
  
  try {
    await page.click(cellSelector, { timeout: 5000 })
  } catch {
    // Fallback: Use keyboard navigation
    console.log(`Using keyboard navigation to reach ${column}${row}`)
    await page.keyboard.press('Control+Home') // Go to A1
    
    // Navigate to target column
    const colIndex = column.charCodeAt(0) - 'A'.charCodeAt(0)
    for (let i = 0; i < colIndex; i++) {
      await page.keyboard.press('ArrowRight')
    }
    
    // Navigate to target row
    for (let i = 1; i < row; i++) {
      await page.keyboard.press('ArrowDown')
    }
  }
}

/**
 * Check sync status via our API
 */
async function checkSyncStatus(page: Page): Promise<any> {
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/admin/test-sync/status')
    return res.json()
  })
  return response
}

/**
 * Get DynamoDB data via our API
 */
async function getDynamoData(page: Page): Promise<any[]> {
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/admin/test-sync/status')
    const data = await res.json()
    return data.dynamoData || []
  })
  return response
}