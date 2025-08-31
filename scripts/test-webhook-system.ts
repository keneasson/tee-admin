#!/usr/bin/env tsx

/**
 * Test script for webhook system
 * 
 * Usage:
 * - yarn test-webhook           # Test webhook endpoint health
 * - yarn test-webhook:fetch     # Test Google Sheets data fetch
 * - yarn test-webhook:security  # Test webhook security
 * - yarn test-webhook:sync      # Test manual sync
 */

import { config } from 'dotenv'
import { join } from 'path'
import { createHmac } from 'crypto'

// Load environment variables from apps/next/.env
config({ path: join(process.cwd(), '.env') })

const WEBHOOK_URL = 'http://localhost:4000/api/sheets/webhook'
const WEBHOOK_SECRET = '8e1008de928c5ebc36d5d234d3344e39840795d6456dd59a254e58b2d9e20220'

// Sheet IDs from the JSON file
const SHEET_IDS = {
  memorial: '1rRluyfllvMv50GRQ2ATmG7kVA_n-Pmyo_dxRFPYn0yg',
  bibleClass: '1qhTz7UXGML7xC18jiWuZ23-C1V_ULl8uCIuo2YlZIDg',
  sundaySchool: '1FVc6W0iAJ9WJW7CBFOHmwQ_oHXhXvVPLJj9xhjBzk8k',
  directory: '1KXr6gP_vR6Up0_WUjwkABxZZWifXvVPLJj9xhjBzk8k',
}

function generateSignature(payload: string): string {
  return createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex')
}

async function testWebhookHealth() {
  console.log('🏥 Testing webhook health...')
  
  try {
    const response = await fetch(WEBHOOK_URL)
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Webhook endpoint is healthy:', data)
    } else {
      console.error('❌ Webhook endpoint unhealthy:', response.status, data)
    }
  } catch (error) {
    console.error('❌ Failed to connect to webhook endpoint:', error)
  }
}

async function testGoogleSheetsAccess() {
  console.log('📊 Testing Google Sheets API access...')
  
  try {
    // Import and test the Google Sheets service
    const { GoogleSheetsService } = await import('../packages/app/provider/sync/google-sheets-service')
    const sheetsService = new GoogleSheetsService()
    
    // Test connection
    const connected = await sheetsService.testConnection()
    if (connected) {
      console.log('✅ Google Sheets API connection successful')
    } else {
      console.error('❌ Google Sheets API connection failed')
      return
    }
    
    // Test fetching data from memorial sheet
    console.log('📋 Testing data fetch from Memorial sheet...')
    const memorialData = await sheetsService.getSheetDataWithHeaders(SHEET_IDS.memorial)
    console.log(`✅ Memorial sheet: ${memorialData.headers.length} columns, ${memorialData.rows.length} rows`)
    console.log('   Headers:', memorialData.headers.slice(0, 5).join(', '), '...')
    
    // Test directory sheet
    console.log('📋 Testing data fetch from Directory sheet...')
    const directoryData = await sheetsService.getSheetDataWithHeaders(SHEET_IDS.directory)
    console.log(`✅ Directory sheet: ${directoryData.headers.length} columns, ${directoryData.rows.length} rows`)
    console.log('   Headers:', directoryData.headers.slice(0, 5).join(', '), '...')
    
  } catch (error) {
    console.error('❌ Google Sheets API test failed:', error)
  }
}

async function testWebhookSecurity() {
  console.log('🔒 Testing webhook security...')
  
  const payload = JSON.stringify({
    eventType: 'SHEET_CHANGED',
    sheetId: SHEET_IDS.memorial,
    changeType: 'UPDATE',
    timestamp: new Date().toISOString(),
    test: true,
  })
  
  // Test 1: Valid signature
  console.log('🧪 Test 1: Valid signature')
  try {
    const signature = generateSignature(payload)
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': `sha256=${signature}`,
      },
      body: payload,
    })
    
    const data = await response.json()
    if (response.ok) {
      console.log('✅ Valid signature accepted:', data)
    } else {
      console.error('❌ Valid signature rejected:', response.status, data)
    }
  } catch (error) {
    console.error('❌ Valid signature test failed:', error)
  }
  
  // Test 2: Invalid signature
  console.log('🧪 Test 2: Invalid signature')
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': 'sha256=invalid-signature',
      },
      body: payload,
    })
    
    const data = await response.json()
    if (response.status === 401) {
      console.log('✅ Invalid signature correctly rejected:', data)
    } else {
      console.error('❌ Invalid signature should be rejected:', response.status, data)
    }
  } catch (error) {
    console.error('❌ Invalid signature test failed:', error)
  }
  
  // Test 3: Missing signature
  console.log('🧪 Test 3: Missing signature')
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    })
    
    const data = await response.json()
    if (response.status === 401) {
      console.log('✅ Missing signature correctly rejected:', data)
    } else {
      console.error('❌ Missing signature should be rejected:', response.status, data)
    }
  } catch (error) {
    console.error('❌ Missing signature test failed:', error)
  }
}

async function testRateLimiting() {
  console.log('⏱️ Testing rate limiting...')
  
  const payload = JSON.stringify({
    eventType: 'SHEET_CHANGED',
    sheetId: SHEET_IDS.memorial,
    changeType: 'UPDATE',
    timestamp: new Date().toISOString(),
    test: true,
  })
  
  const signature = generateSignature(payload)
  let successCount = 0
  let rateLimitCount = 0
  
  // Send 25 requests rapidly (limit is 20/minute)
  for (let i = 0; i < 25; i++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': `sha256=${signature}`,
        },
        body: payload,
      })
      
      if (response.ok) {
        successCount++
      } else if (response.status === 429) {
        rateLimitCount++
        if (rateLimitCount === 1) {
          console.log('✅ Rate limiting activated after', successCount, 'requests')
        }
      }
    } catch (error) {
      console.error('Request failed:', error)
    }
  }
  
  console.log(`📊 Rate limiting test: ${successCount} successful, ${rateLimitCount} rate limited`)
}

async function testManualSync() {
  console.log('🔧 Testing manual sync (requires running server)...')
  
  try {
    // Import sync service directly
    const { WebhookSyncService } = await import('../packages/app/provider/sync/webhook-sync-service')
    const syncService = new WebhookSyncService()
    
    console.log('📋 Testing sync for Memorial sheet...')
    const result = await syncService.triggerManualSync(SHEET_IDS.memorial)
    
    console.log('✅ Manual sync completed:', {
      sheetId: result.sheetId,
      sheetType: result.sheetType,
      recordsProcessed: result.recordsProcessed,
      recordsSuccessful: result.recordsSuccessful,
      recordsFailed: result.recordsFailed,
      executionTime: `${result.executionTime}ms`,
      errors: result.errors,
    })
    
  } catch (error) {
    console.error('❌ Manual sync test failed:', error)
  }
}

async function main() {
  const command = process.argv[2]
  
  console.log('🧪 TEE Admin Webhook System Testing')
  console.log('=' .repeat(40))
  
  switch (command) {
    case 'health':
      await testWebhookHealth()
      break
      
    case 'sheets':
      await testGoogleSheetsAccess()
      break
      
    case 'security':
      await testWebhookSecurity()
      break
      
    case 'rate-limit':
      await testRateLimiting()
      break
      
    case 'sync':
      await testManualSync()
      break
      
    case 'all':
    default:
      await testWebhookHealth()
      console.log('')
      await testGoogleSheetsAccess()
      console.log('')
      await testWebhookSecurity()
      console.log('')
      // Skip rate limiting in full test to avoid hitting limits
      // await testRateLimiting()
      console.log('')
      await testManualSync()
      break
  }
  
  console.log('\n🏁 Testing complete!')
}

main().catch(console.error)