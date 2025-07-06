#!/usr/bin/env tsx

/**
 * Validate DynamoDB data against Google Sheets source
 */

import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), 'apps/next/.env') })

// Import Google Sheets function
const getGoogleSheet = require('../apps/next/utils/get-google-sheets').get_google_sheet

async function validateData() {
  try {
    console.log('🔍 Validating DynamoDB vs Google Sheets data...\n')
    
    console.log('📊 Fetching MEMORIAL data from both sources...')
    
    // Get original Google Sheets data
    const googleSheetData = await getGoogleSheet('memorial')
    
    // Get DynamoDB data via API
    const response = await fetch('http://localhost:4000/api/schedule/memorial')
    const dynamoData = await response.json()
    
    console.log('\n🔍 MEMORIAL SCHEDULE COMPARISON:')
    console.log('==============================')
    
    console.log('\n📈 Google Sheets:')
    console.log('- Title:', googleSheetData.title)
    console.log('- Total content items:', googleSheetData.content?.length || 0)
    console.log('- Type:', googleSheetData.type)
    
    console.log('\n📊 DynamoDB API:')
    console.log('- Title:', dynamoData.title)
    console.log('- Total content items:', dynamoData.content?.length || 0)
    console.log('- Type:', dynamoData.type)
    console.log('- Last updated:', dynamoData.lastUpdated)
    
    if (googleSheetData.content && dynamoData.content) {
      const gsHeaders = googleSheetData.content[0]
      const dbHeaders = dynamoData.content[0]
      
      console.log('\n🏷️ HEADERS COMPARISON:')
      console.log('Google Sheets headers:', gsHeaders)
      console.log('DynamoDB headers:     ', dbHeaders)
      console.log('Headers match:', JSON.stringify(gsHeaders) === JSON.stringify(dbHeaders) ? '✅' : '❌')
      
      // Compare first few data rows
      console.log('\n📋 FIRST 3 DATA ROWS COMPARISON:')
      for (let i = 1; i <= 3 && i < Math.min(googleSheetData.content.length, dynamoData.content.length); i++) {
        const gsRow = googleSheetData.content[i]
        const dbRow = dynamoData.content[i]
        
        console.log(`\\nRow ${i}:`)
        console.log('Google Sheets:', gsRow)
        console.log('DynamoDB:     ', dbRow)
        console.log('Match:', JSON.stringify(gsRow) === JSON.stringify(dbRow) ? '✅' : '❌')
        
        // Check specific date handling
        if (gsHeaders && dbHeaders) {
          const gsDateIdx = gsHeaders.findIndex(h => h.toLowerCase().includes('date') || h === 'Tim')
          const dbDateIdx = dbHeaders.findIndex(h => h.toLowerCase().includes('date') || h === 'Tim')
          
          if (gsDateIdx >= 0 && dbDateIdx >= 0) {
            const gsDate = gsRow[gsDateIdx]
            const dbDate = dbRow[dbDateIdx]
            console.log(`Date comparison: GS="${gsDate}" (${typeof gsDate}) vs DB="${dbDate}" (${typeof dbDate})`)
          }
        }
      }
      
      // Check if we have date conversion issues
      console.log('\\n🗓️ DATE ANALYSIS:')
      const dateProblems = []
      
      for (let i = 1; i < Math.min(10, googleSheetData.content.length, dynamoData.content.length); i++) {
        const gsRow = googleSheetData.content[i]
        const dbRow = dynamoData.content[i]
        
        if (gsRow && dbRow) {
          const gsDateField = gsRow.find(item => item instanceof Date || (typeof item === 'string' && item.includes('/')))
          const dbDateField = dbRow.find(item => typeof item === 'string' && item.includes('-') && item.includes('T'))
          
          if (gsDateField && dbDateField) {
            // Try to convert and compare
            let gsDate, dbDate
            try {
              gsDate = gsDateField instanceof Date ? gsDateField : new Date(gsDateField)
              dbDate = new Date(dbDateField)
              
              if (Math.abs(gsDate.getTime() - dbDate.getTime()) > 24 * 60 * 60 * 1000) { // More than 1 day difference
                dateProblems.push({
                  row: i,
                  googleSheets: gsDateField,
                  dynamoDB: dbDateField,
                  difference: Math.abs(gsDate.getTime() - dbDate.getTime()) / (1000 * 60 * 60 * 24) + ' days'
                })
              }
            } catch (error) {
              dateProblems.push({
                row: i,
                googleSheets: gsDateField,
                dynamoDB: dbDateField,
                error: error.message
              })
            }
          }
        }
      }
      
      if (dateProblems.length > 0) {
        console.log('❌ Date conversion issues found:')
        dateProblems.slice(0, 5).forEach(problem => {
          console.log(`  Row ${problem.row}: GS="${problem.googleSheets}" -> DB="${problem.dynamoDB}"`)
          if (problem.difference) console.log(`    Difference: ${problem.difference}`)
          if (problem.error) console.log(`    Error: ${problem.error}`)
        })
      } else {
        console.log('✅ No major date conversion issues detected')
      }
    }
    
  } catch (error) {
    console.error('❌ Error validating data:', error)
  }
}

validateData()