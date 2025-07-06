#!/usr/bin/env tsx

/**
 * Debug Google Sheets data structure
 */

import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), 'apps/next/.env') })

// Import Google Sheets function
const getGoogleSheet = require('../apps/next/utils/get-google-sheets').get_google_sheet

async function debugSheetData(sheetType: string) {
  try {
    console.log(`🔍 Debugging ${sheetType} data structure...`)
    
    const googleSheetData = await getGoogleSheet(sheetType)
    
    console.log('📊 Raw Google Sheet Data:')
    console.log('Type:', typeof googleSheetData)
    console.log('Keys:', Object.keys(googleSheetData))
    console.log('Title:', googleSheetData.title)
    console.log('Type field:', googleSheetData.type)
    console.log('Content type:', typeof googleSheetData.content)
    console.log('Content length:', googleSheetData.content?.length)
    
    if (googleSheetData.content && googleSheetData.content.length > 0) {
      console.log('First row:', googleSheetData.content[0])
      console.log('First row type:', typeof googleSheetData.content[0])
      console.log('Is array:', Array.isArray(googleSheetData.content[0]))
      
      if (googleSheetData.content.length > 1) {
        console.log('Second row:', googleSheetData.content[1])
      }
    }
    
  } catch (error) {
    console.error(`❌ Failed to debug ${sheetType}:`, error)
  }
}

async function main() {
  await debugSheetData('memorial')
  console.log('\n' + '='.repeat(50) + '\n')
  await debugSheetData('directory')
}

main().catch(console.error)