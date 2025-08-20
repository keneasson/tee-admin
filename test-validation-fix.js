#!/usr/bin/env node

/**
 * Test script to verify the validation system works with actual API data
 */

const { NewsletterRulesValidator } = require('./packages/app/utils/newsletter/rules-validator.ts')

// Mock data that matches the actual API structure (array of ProgramTypes)
const mockApiData = [
  {
    Key: 'memorial',
    Date: '2025-08-24T00:00:00.000Z',
    preside: 'John Smith',
    exhort: 'Jane Doe',
    organist: 'Mary Johnson'
  },
  {
    Key: 'sundaySchool', 
    Date: '2025-08-24T00:00:00.000Z',
    refreshments: 'Youth Group'
  },
  {
    Key: 'bibleClass',
    Date: '2025-08-21T00:00:00.000Z',
    speaker: 'Bob Wilson',
    presider: 'Alice Brown'
  }
]

// Test the validator
async function testValidation() {
  try {
    console.log('🧪 Testing updated validation system...')
    
    const validator = new NewsletterRulesValidator()
    
    // Create mock assembled content with the actual API data structure
    const mockContent = {
      regularServices: mockApiData,  // Array format (actual API)
      events: [],
      dailyReadings: [
        { date: new Date(), reading1: 'Genesis 1', reading2: 'Matthew 1', reading3: 'Psalm 1' }
      ]
    }
    
    console.log('📊 Mock content structure:', JSON.stringify(mockContent, null, 2))
    
    const validation = validator.validateAssembledContent(mockContent)
    
    console.log('✅ Validation Results:')
    console.log(`   Completeness Score: ${validation.completenessScore}%`)
    console.log(`   Ready to Send: ${validation.readyToSend}`)
    console.log(`   Errors: ${validation.missingFields.length}`)
    console.log(`   Warnings: ${validation.warnings.length}`)
    
    if (validation.missingFields.length > 0) {
      console.log('\n❌ Errors:')
      validation.missingFields.forEach(error => {
        console.log(`   - ${error.service}: ${error.message}`)
      })
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testValidation()