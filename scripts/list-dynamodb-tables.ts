#!/usr/bin/env tsx

/**
 * List existing DynamoDB tables
 * 
 * Usage: yarn list-tables
 */

import { config } from 'dotenv'
import { join } from 'path'
import { ListTablesCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'

// Load environment variables
config({ path: join(process.cwd(), 'apps/next/.env') })

// Create AWS DynamoDB client (not localhost)
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function listTables() {
  try {
    console.log('📋 Listing DynamoDB tables...')
    
    const command = new ListTablesCommand({})
    const result = await dynamoClient.send(command)
    
    if (result.TableNames && result.TableNames.length > 0) {
      console.log('\n✅ Found tables:')
      result.TableNames.forEach(tableName => {
        console.log(`  - ${tableName}`)
      })
    } else {
      console.log('\n⚠️  No tables found')
    }
    
    console.log(`\n📊 Total tables: ${result.TableNames?.length || 0}`)
  } catch (error) {
    console.error('❌ Failed to list tables:', error)
    process.exit(1)
  }
}

listTables()