#!/usr/bin/env tsx

/**
 * List existing DynamoDB tables
 * 
 * Usage: yarn list-tables
 */

import { ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { dynamoClient } from '../packages/app/provider/dynamodb/config'

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