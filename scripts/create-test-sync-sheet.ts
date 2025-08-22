#!/usr/bin/env tsx
/**
 * Script to create the test sync Google Sheet
 * Run with: npx tsx scripts/create-test-sync-sheet.ts
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

async function createTestSyncSheet() {
  try {
    console.log('🚀 Creating Test Sync Google Sheet...')
    
    // Load service account credentials
    const keyFilePath = path.join(__dirname, '../apps/next/tee-services-db47a9e534d3.json')
    const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'))
    
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ],
    })
    
    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })
    
    // Create the spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Data Sheet Exploration Solution',
          locale: 'en_US',
          timeZone: 'America/Toronto',
        },
        sheets: [{
          properties: {
            title: 'TestSync',
            index: 0,
            gridProperties: {
              rowCount: 1000,
              columnCount: 3,
            },
          },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Date' } },
                  { userEnteredValue: { stringValue: 'Name' } },
                  { userEnteredValue: { stringValue: 'Topic' } },
                ]
              },
              // Add some initial test data
              {
                values: [
                  { userEnteredValue: { stringValue: '2025-01-20' } },
                  { userEnteredValue: { stringValue: 'Initial Test' } },
                  { userEnteredValue: { stringValue: 'Test Sync Setup' } },
                ]
              },
              {
                values: [
                  { userEnteredValue: { stringValue: '2025-01-21' } },
                  { userEnteredValue: { stringValue: 'System Check' } },
                  { userEnteredValue: { stringValue: 'Webhook Validation' } },
                ]
              }
            ]
          }]
        }]
      }
    })
    
    const spreadsheetId = createResponse.data.spreadsheetId
    console.log('✅ Sheet created with ID:', spreadsheetId)
    console.log('📊 Sheet URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId)
    
    // Share the sheet with the service account (already has access as creator)
    // But we might want to make it accessible to specific users
    
    // Update the configuration file
    const configPath = keyFilePath
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    
    // Add the test sync sheet to the configuration
    config.sheet_ids = config.sheet_ids || {}
    config.sheet_ids.testSync = {
      name: 'Test Sync',
      startTime: '',
      key: spreadsheetId,
      description: 'Test sheet for debugging data sync - not included in production schedules'
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log('✅ Configuration updated with new sheet ID')
    
    // Also update the .env file if needed
    const envPath = path.join(__dirname, '../apps/next/.env')
    const envContent = fs.readFileSync(envPath, 'utf8')
    if (!envContent.includes('TEST_SYNC_SHEET_ID')) {
      fs.appendFileSync(envPath, `\n# Test Sync Sheet\nTEST_SYNC_SHEET_ID=${spreadsheetId}\n`)
      console.log('✅ Added TEST_SYNC_SHEET_ID to .env')
    }
    
    console.log('\n📋 Next steps:')
    console.log('1. The sheet has been created and configured')
    console.log('2. You can access it at: https://docs.google.com/spreadsheets/d/' + spreadsheetId)
    console.log('3. The webhook should automatically pick up changes to this sheet')
    console.log('4. Use Playwright tests to simulate human editing')
    
    return spreadsheetId
    
  } catch (error) {
    console.error('❌ Failed to create sheet:', error)
    process.exit(1)
  }
}

// Run the script
createTestSyncSheet()
  .then(() => {
    console.log('✨ Done!')
    process.exit(0)
  })
  .catch(console.error)