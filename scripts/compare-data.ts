#!/usr/bin/env tsx

/**
 * Compare Google Sheets vs DynamoDB data to identify date issues
 */

import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), 'apps/next/.env') })

// Import Google Sheets function
const getGoogleSheet = require('../apps/next/utils/get-google-sheets').get_google_sheet

async function compareData() {
  try {
    console.log('🔍 Comparing Google Sheets vs DynamoDB data...\n')
    
    // Get data from Google Sheets
    console.log('📊 Fetching from Google Sheets...')
    const googleSheetData = await getGoogleSheet('memorial')
    
    // Get data from DynamoDB API
    console.log('📊 Fetching from DynamoDB API...')
    const response = await fetch('http://localhost:4000/api/schedule/memorial')
    const dynamoData = await response.json()
    
    console.log('\n🔍 COMPARISON RESULTS:')
    console.log('===================')
    
    console.log('\n📈 Google Sheets Data:')
    console.log('Title:', googleSheetData.title)
    console.log('Total rows:', googleSheetData.content?.length || 0)
    console.log('First few rows:')
    if (googleSheetData.content && googleSheetData.content.length > 1) {
      console.log('Headers:', googleSheetData.content[0])
      console.log('Row 1:', googleSheetData.content[1])
      console.log('Row 2:', googleSheetData.content[2])
      console.log('Row 3:', googleSheetData.content[3])
    }
    
    console.log('\n📊 DynamoDB Data:')
    console.log('Title:', dynamoData.title)
    console.log('Total rows:', dynamoData.content?.length || 0)
    console.log('First few rows:')
    if (dynamoData.content && dynamoData.content.length > 1) {
      console.log('Headers:', dynamoData.content[0])
      console.log('Row 1:', dynamoData.content[1])
      console.log('Row 2:', dynamoData.content[2])
      console.log('Row 3:', dynamoData.content[3])
    }
    
    console.log('\n🔍 DATE ANALYSIS:')
    console.log('================')
    
    if (googleSheetData.content && dynamoData.content) {
      const gsHeaders = googleSheetData.content[0]
      const dbHeaders = dynamoData.content[0]
      
      console.log('Google Sheets headers:', gsHeaders)
      console.log('DynamoDB headers:', dbHeaders)
      
      // Find date columns
      const gsDateIndex = gsHeaders.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase() === 'tim')
      const dbDateIndex = dbHeaders.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase() === 'tim')
      
      console.log('\nDate column comparison:')
      console.log('Google Sheets date column:', gsHeaders[gsDateIndex], 'at index', gsDateIndex)
      console.log('DynamoDB date column:', dbHeaders[dbDateIndex], 'at index', dbDateIndex)
      
      if (gsDateIndex >= 0 && dbDateIndex >= 0) {
        console.log('\nFirst 5 date values:')
        for (let i = 1; i <= 5 && i < Math.min(googleSheetData.content.length, dynamoData.content.length); i++) {
          const gsDate = googleSheetData.content[i]?.[gsDateIndex]
          const dbDate = dynamoData.content[i]?.[dbDateIndex]
          console.log(`Row ${i}:`)
          console.log(`  Google Sheets: ${gsDate} (${typeof gsDate})`)
          console.log(`  DynamoDB:      ${dbDate} (${typeof dbDate})`)
          console.log(`  Match: ${gsDate === dbDate ? '✅' : '❌'}`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error comparing data:', error)
  }
}

compareData()