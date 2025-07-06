#!/usr/bin/env tsx

/**
 * Populate DynamoDB with initial data from Google Sheets
 * 
 * Usage: yarn populate-dynamodb
 */

import { config } from 'dotenv'
import { join } from 'path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

// Load environment variables
config({ path: join(process.cwd(), 'apps/next/.env') })

// Import Google Sheets function
const getGoogleSheet = require('../apps/next/utils/get-google-sheets').get_google_sheet

// Create AWS DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Create document client with proper marshalling options
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const SCHEDULES_TABLE = 'dev-tee-schedules'
const SYNC_STATUS_TABLE = 'dev-tee-sync-status'

// Helper function to clean data for DynamoDB
function cleanDataForDynamoDB(data: any): any {
  if (data === null || data === undefined) {
    return undefined // Will be removed by marshalling options
  }
  
  if (data instanceof Date) {
    return data.toISOString()
  }
  
  if (Array.isArray(data)) {
    return data.map(cleanDataForDynamoDB).filter(item => item !== undefined)
  }
  
  if (typeof data === 'object') {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(data)) {
      const cleanedValue = cleanDataForDynamoDB(value)
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue
      }
    }
    return cleaned
  }
  
  return data
}

interface SheetRecord {
  PK: string
  SK: string
  sheetType: string
  sheetId: string
  date: string
  data: Record<string, any>
  lastUpdated: string
  version: string
}

interface DirectoryRecord {
  PK: string
  SK: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  lastUpdated: string
  version: string
}

async function populateScheduleData(sheetType: string, sheetId: string) {
  try {
    console.log(`📊 Fetching ${sheetType} data from Google Sheets...`)
    
    const googleSheetData = await getGoogleSheet(sheetType)
    const { title, content } = googleSheetData
    
    if (!content || content.length === 0) {
      console.log(`⚠️ No data found for ${sheetType}`)
      return 0
    }
    
    // Content is already an array of objects, not arrays
    const rows = content
    console.log(`📋 Processing ${rows.length} rows from ${sheetType}`)
    
    // Convert rows to DynamoDB records
    const records: SheetRecord[] = []
    const timestamp = new Date().toISOString()
    const version = Date.now().toString()
    
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i]
      if (!rowData || typeof rowData !== 'object') continue
      
      // Data is already an object - clean it for DynamoDB
      const data = cleanDataForDynamoDB({ ...rowData })
      
      // Extract date for sorting (first column that looks like a date)
      let dateValue = ''
      if (data.Date) {
        dateValue = data.Date instanceof Date ? data.Date.toISOString() : data.Date.toString()
      } else if (data.Tim) {
        dateValue = data.Tim instanceof Date ? data.Tim.toISOString() : data.Tim.toString()
      } else {
        dateValue = `${timestamp}-${i}` // Fallback
      }
      
      const record: SheetRecord = {
        PK: `SCHEDULE#${sheetType.toUpperCase()}`,
        SK: `DATE#${dateValue}#${i}`,
        sheetType,
        sheetId,
        date: dateValue,
        data,
        lastUpdated: timestamp,
        version,
      }
      
      records.push(record)
    }
    
    // Batch write to DynamoDB (25 items at a time)
    const batchSize = 25
    let successCount = 0
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      const putRequests = batch.map(record => ({
        PutRequest: {
          Item: record
        }
      }))
      
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [SCHEDULES_TABLE]: putRequests
          }
        }))
        
        successCount += batch.length
        console.log(`✅ Wrote batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} (${batch.length} items)`)
        
      } catch (batchError) {
        console.error(`❌ Failed to write batch ${Math.floor(i/batchSize) + 1}:`, batchError)
      }
    }
    
    // Update sync status
    await docClient.send(new PutCommand({
      TableName: SYNC_STATUS_TABLE,
      Item: {
        PK: `SYNC#${sheetType.toUpperCase()}`,
        SK: 'STATUS',
        sheetType,
        sheetId,
        lastSync: timestamp,
        version,
        recordCount: successCount,
        status: 'completed'
      }
    }))
    
    console.log(`✅ Successfully populated ${successCount}/${records.length} ${sheetType} records`)
    return successCount
    
  } catch (error) {
    console.error(`❌ Failed to populate ${sheetType} data:`, error)
    return 0
  }
}

async function populateDirectoryData() {
  try {
    console.log(`📋 Fetching directory data from Google Sheets...`)
    
    const googleSheetData = await getGoogleSheet('directory')
    const { content } = googleSheetData
    
    if (!content || content.length === 0) {
      console.log(`⚠️ No directory data found`)
      return 0
    }
    
    // Content is already an array of objects
    const rows = content
    console.log(`👥 Processing ${rows.length} directory entries`)
    
    // Convert rows to DynamoDB records
    const records: DirectoryRecord[] = []
    const timestamp = new Date().toISOString()
    const version = Date.now().toString()
    
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i]
      if (!rowData || typeof rowData !== 'object') continue
      
      // Data is already an object - clean it for DynamoDB
      const data = cleanDataForDynamoDB({ ...rowData })
      
      // Extract key fields
      const email = data.Email || data.email || `unknown-${i}@example.com`
      const firstName = data.FirstName || data['First Name'] || data.fname || ''
      const lastName = data.LastName || data['Last Name'] || data.lname || ''
      const phone = data.Phone || data.phone || ''
      const address = data.Address || data.address || ''
      
      const record: DirectoryRecord = {
        PK: 'DIRECTORY#MEMBERS',
        SK: `USER#${email.toLowerCase()}#${i}`, // Add index to handle duplicates
        email: email.toLowerCase(),
        firstName,
        lastName,
        phone,
        address,
        lastUpdated: timestamp,
        version,
      }
      
      records.push(record)
    }
    
    // Batch write to DynamoDB
    const batchSize = 25
    let successCount = 0
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      const putRequests = batch.map(record => ({
        PutRequest: {
          Item: record
        }
      }))
      
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [SCHEDULES_TABLE]: putRequests
          }
        }))
        
        successCount += batch.length
        console.log(`✅ Wrote directory batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} (${batch.length} items)`)
        
      } catch (batchError) {
        console.error(`❌ Failed to write directory batch ${Math.floor(i/batchSize) + 1}:`, batchError)
      }
    }
    
    console.log(`✅ Successfully populated ${successCount}/${records.length} directory records`)
    return successCount
    
  } catch (error) {
    console.error(`❌ Failed to populate directory data:`, error)
    return 0
  }
}

async function main() {
  console.log('🚀 TEE Admin DynamoDB Population')
  console.log('='.repeat(40))
  
  const sheetConfigs = [
    { type: 'memorial', id: process.env.MEMORIAL_SHEET_ID || '1rRluyfllvMv50GRQ2ATmG7kVA_n-Pmyo_dxRFPYn0yg' },
    { type: 'bibleClass', id: process.env.BIBLE_CLASS_SHEET_ID || '1qhTz7UXGML7xC18jiWuZ23-C1V_ULl8uCIuo2YlZIDg' },
    { type: 'sundaySchool', id: process.env.SUNDAY_SCHOOL_SHEET_ID || '1FVc6W0iAJ9WJW7CBFOHmwQ_oHXhXvVPLJj9xhjBzk8k' },
  ]
  
  let totalRecords = 0
  
  // Populate schedule data
  for (const sheet of sheetConfigs) {
    console.log(`\\n📊 Processing ${sheet.type}...`)
    const count = await populateScheduleData(sheet.type, sheet.id)
    totalRecords += count
  }
  
  // Populate directory data
  console.log(`\\n👥 Processing directory...`)
  const directoryCount = await populateDirectoryData()
  totalRecords += directoryCount
  
  console.log(`\\n🎉 Population complete!`)
  console.log(`📊 Total records populated: ${totalRecords}`)
  console.log(`\\n💡 Next steps:`)
  console.log('   1. Test API endpoints - they should now use DynamoDB')
  console.log('   2. Set up Google Apps Script webhooks for real-time sync')
  console.log('   3. Monitor performance improvements')
}

main().catch(console.error)