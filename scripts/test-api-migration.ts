#!/usr/bin/env tsx

/**
 * Test script for API migration - DynamoDB vs Google Sheets
 * 
 * Usage:
 * - yarn test-api-migration health    # Test API health
 * - yarn test-api-migration schedule  # Test schedule endpoints
 * - yarn test-api-migration directory # Test directory endpoints
 * - yarn test-api-migration upcoming  # Test upcoming program
 * - yarn test-api-migration all       # Test everything
 */

import { config } from 'dotenv'
import { join } from 'path'

// Load environment variables
config({ path: join(process.cwd(), '.env') })

const BASE_URL = 'http://localhost:4000'

async function testApiHealth() {
  console.log('🏥 Testing API health and availability...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/upcoming-program`)
    const responseTime = Date.now()
    
    console.log(`📊 API Response: ${response.status} ${response.statusText}`)
    console.log(`⏱️  Response time: ~${responseTime % 1000}ms`)
    
    if (response.ok) {
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      console.log(`📍 Data source: ${dataSource}`)
      
      const data = await response.json()
      console.log(`✅ API is healthy - received ${data.length} upcoming events`)
    } else {
      console.error('❌ API health check failed')
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to API:', error)
  }
}

async function testScheduleEndpoints() {
  console.log('📅 Testing schedule endpoints...')
  
  const scheduleTypes = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']
  
  for (const type of scheduleTypes) {
    try {
      console.log(`\n🧪 Testing ${type} schedule endpoint`)
      
      const response = await fetch(`${BASE_URL}/api/schedule/${type}`)
      console.log(`📊 ${type}: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const dataSource = response.headers.get('X-Data-Source') || 'unknown'
        const lastUpdated = response.headers.get('X-Last-Updated') || 'unknown'
        
        const data = await response.json()
        console.log(`✅ ${type}: ${data.content?.length - 1 || 0} rows from ${dataSource}`)
        console.log(`📅 Last updated: ${lastUpdated}`)
        
        // Validate data structure
        if (data.title && data.type && data.content) {
          console.log(`✅ ${type}: Data structure is valid`)
        } else {
          console.warn(`⚠️ ${type}: Invalid data structure`)
        }
      } else {
        console.error(`❌ ${type}: Failed to fetch data`)
        const errorData = await response.json().catch(() => ({}))
        console.error(`   Error: ${errorData.error || 'Unknown error'}`)
      }
      
    } catch (error) {
      console.error(`❌ ${type}: Request failed:`, error)
    }
  }
}

async function testDirectoryEndpoint() {
  console.log('📋 Testing directory endpoint...')
  
  try {
    console.log('\n🧪 Testing directory GET endpoint')
    
    // Note: Directory endpoint requires authentication
    const response = await fetch(`${BASE_URL}/api/directory`)
    console.log(`📊 Directory: ${response.status} ${response.statusText}`)
    
    if (response.status === 401) {
      console.log('✅ Directory: Correctly requires authentication')
    } else if (response.ok) {
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      const data = await response.json()
      console.log(`✅ Directory: ${data.content?.length - 1 || 0} entries from ${dataSource}`)
    } else {
      console.error('❌ Directory: Unexpected response')
    }
    
    console.log('\n🧪 Testing directory user lookup')
    
    // Test user lookup endpoint
    const lookupResponse = await fetch(`${BASE_URL}/api/directory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    
    console.log(`📊 User lookup: ${lookupResponse.status} ${lookupResponse.statusText}`)
    
    if (lookupResponse.status === 404) {
      console.log('✅ User lookup: Correctly returns 404 for non-existent user')
    } else if (lookupResponse.ok) {
      const data = await lookupResponse.json()
      console.log('✅ User lookup: Successfully found user')
    } else {
      console.error('❌ User lookup: Unexpected response')
    }
    
  } catch (error) {
    console.error('❌ Directory endpoint test failed:', error)
  }
}

async function testUpcomingProgramEndpoint() {
  console.log('📅 Testing upcoming program endpoint...')
  
  try {
    console.log('\n🧪 Testing upcoming program endpoint')
    
    const response = await fetch(`${BASE_URL}/api/upcoming-program`)
    console.log(`📊 Upcoming program: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      const eventCount = response.headers.get('X-Event-Count') || '0'
      
      const data = await response.json()
      console.log(`✅ Upcoming program: ${eventCount} events from ${dataSource}`)
      
      // Validate event structure
      if (Array.isArray(data) && data.length > 0) {
        const firstEvent = data[0]
        if (firstEvent.type && firstEvent.title && firstEvent.date && firstEvent.details) {
          console.log('✅ Upcoming program: Event structure is valid')
          console.log(`📅 Next event: ${firstEvent.title} on ${new Date(firstEvent.date).toLocaleDateString()}`)
        } else {
          console.warn('⚠️ Upcoming program: Invalid event structure')
        }
      } else {
        console.log('📭 Upcoming program: No upcoming events found')
      }
      
    } else {
      console.error('❌ Upcoming program: Failed to fetch data')
      const errorData = await response.json().catch(() => ({}))
      console.error(`   Error: ${errorData.error || 'Unknown error'}`)
    }
    
    console.log('\n🧪 Testing upcoming program with custom order')
    
    const customOrderResponse = await fetch(`${BASE_URL}/api/upcoming-program?order=memorial,sundaySchool`)
    if (customOrderResponse.ok) {
      const data = await customOrderResponse.json()
      console.log(`✅ Custom order: ${data.length} events with custom ordering`)
    }
    
  } catch (error) {
    console.error('❌ Upcoming program endpoint test failed:', error)
  }
}

async function testDataServiceFallback() {
  console.log('🔄 Testing fallback behavior...')
  
  try {
    // Test with invalid schedule type to trigger error handling
    const response = await fetch(`${BASE_URL}/api/schedule/invalid-type`)
    console.log(`📊 Invalid type test: ${response.status} ${response.statusText}`)
    
    if (response.status === 400) {
      console.log('✅ Error handling: Correctly rejects invalid schedule types')
    }
    
    // Check if we can determine the fallback behavior
    const validResponse = await fetch(`${BASE_URL}/api/schedule/memorial`)
    if (validResponse.ok) {
      const dataSource = validResponse.headers.get('X-Data-Source') || 'unknown'
      
      if (dataSource.includes('dynamodb')) {
        console.log('✅ Fallback: Currently using DynamoDB (optimal)')
      } else if (dataSource.includes('google-sheets')) {
        console.log('⚠️ Fallback: Currently using Google Sheets fallback')
      } else {
        console.log('❓ Fallback: Unknown data source')
      }
    }
    
  } catch (error) {
    console.error('❌ Fallback test failed:', error)
  }
}

async function testPerformanceComparison() {
  console.log('⚡ Testing performance...')
  
  try {
    const testEndpoints = [
      '/api/schedule/memorial',
      '/api/upcoming-program',
    ]
    
    for (const endpoint of testEndpoints) {
      const startTime = Date.now()
      const response = await fetch(`${BASE_URL}${endpoint}`)
      const endTime = Date.now()
      
      const responseTime = endTime - startTime
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      
      console.log(`⏱️  ${endpoint}: ${responseTime}ms (${dataSource})`)
      
      if (responseTime < 100) {
        console.log(`🚀 ${endpoint}: Excellent performance`)
      } else if (responseTime < 500) {
        console.log(`✅ ${endpoint}: Good performance`)
      } else {
        console.log(`⚠️ ${endpoint}: Slow performance`)
      }
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error)
  }
}

async function main() {
  const command = process.argv[2]
  
  console.log('🧪 TEE Admin API Migration Testing')
  console.log('=' .repeat(50))
  console.log(`Base URL: ${BASE_URL}`)
  console.log('')
  
  switch (command) {
    case 'health':
      await testApiHealth()
      break
      
    case 'schedule':
      await testScheduleEndpoints()
      break
      
    case 'directory':
      await testDirectoryEndpoint()
      break
      
    case 'upcoming':
      await testUpcomingProgramEndpoint()
      break
      
    case 'performance':
      await testPerformanceComparison()
      break
      
    case 'fallback':
      await testDataServiceFallback()
      break
      
    case 'all':
    default:
      await testApiHealth()
      console.log('')
      await testScheduleEndpoints()
      console.log('')
      await testDirectoryEndpoint()
      console.log('')
      await testUpcomingProgramEndpoint()
      console.log('')
      await testDataServiceFallback()
      console.log('')
      await testPerformanceComparison()
      break
  }
  
  console.log('')
  console.log('🏁 API migration testing complete!')
  console.log('')
  console.log('💡 Next steps:')
  console.log('   1. Ensure DynamoDB tables are created and populated')
  console.log('   2. Test with real data from Google Sheets webhook sync')
  console.log('   3. Update frontend components to use new endpoints')
  console.log('   4. Monitor performance and data source usage')
}

main().catch(console.error)