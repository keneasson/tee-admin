#!/usr/bin/env tsx

/**
 * Setup script for DynamoDB tables
 * 
 * Usage:
 * - yarn setup-dynamodb:local   # Create tables in local DynamoDB
 * - yarn setup-dynamodb:dev     # Create tables in dev environment
 * - yarn setup-dynamodb:delete  # Delete all tables (dev only)
 */

import { createAllTables, deleteAllTables } from '../packages/app/provider/dynamodb/table-definitions'

const command = process.argv[2]

async function main() {
  try {
    switch (command) {
      case 'create':
      case 'local':
        console.log('🚀 Setting up DynamoDB tables for local development...')
        await createAllTables()
        console.log('✅ Local DynamoDB setup complete!')
        break

      case 'dev':
        if (process.env.STAGE !== 'dev') {
          console.error('❌ This command can only be run with STAGE=dev')
          process.exit(1)
        }
        console.log('🚀 Setting up DynamoDB tables for dev environment...')
        await createAllTables()
        console.log('✅ Dev DynamoDB setup complete!')
        break

      case 'delete':
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Cannot delete tables in production!')
          process.exit(1)
        }
        console.log('🗑️  Deleting DynamoDB tables...')
        await deleteAllTables()
        console.log('✅ Tables deleted successfully!')
        break

      default:
        console.log('Usage:')
        console.log('  yarn setup-dynamodb create   # Create tables locally')
        console.log('  yarn setup-dynamodb dev      # Create tables in dev')
        console.log('  yarn setup-dynamodb delete   # Delete all tables')
        break
    }
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

main()