import { CreateTableCommand, CreateTableInput } from '@aws-sdk/client-dynamodb'
import { dynamoClient, tableNames } from './config'

// Common table configuration
const commonTableConfig = {
  BillingMode: 'PAY_PER_REQUEST' as const,
  PointInTimeRecoverySpecification: {
    PointInTimeRecoveryEnabled: true,
  },
  Tags: [
    { Key: 'Project', Value: 'TEE-Admin' },
    { Key: 'Environment', Value: process.env.STAGE || 'dev' },
  ],
}

// tee-schedules Table Definition (NEW)
// Consolidates all schedule and event data
export const schedulesTableDef: CreateTableInput = {
  TableName: tableNames.schedules,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'GSI1', // Primary access pattern: Ecclesia + Date Range
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' }, // ECCLESIA#{ecclesia}
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' }, // {date}#{type}#{time}
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'GSI2', // Secondary access pattern: Type + Date Range OR Date + Type
      KeySchema: [
        { AttributeName: 'GSI2PK', KeyType: 'HASH' }, // TYPE#{type} OR DATE#{date}
        { AttributeName: 'GSI2SK', KeyType: 'RANGE' }, // {date}#{time} OR {type}
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
  ...commonTableConfig,
}

// NOTE: tee-admin table already exists - we'll enhance it programmatically
// No need to recreate the existing table structure
// We'll add directory records with SK pattern 'DIRECTORY#{sheetId}'

// Sync Status Table Definition
export const syncStatusTableDef: CreateTableInput = {
  TableName: tableNames.syncStatus,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
  ],
  ...commonTableConfig,
}

// Table creation helper
export async function createTable(tableDef: CreateTableInput): Promise<void> {
  try {
    const command = new CreateTableCommand(tableDef)
    const result = await dynamoClient.send(command)
    console.log(`✅ Table ${tableDef.TableName} created successfully:`, result.TableDescription?.TableArn)
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  Table ${tableDef.TableName} already exists`)
    } else {
      console.error(`❌ Failed to create table ${tableDef.TableName}:`, error)
      throw error
    }
  }
}

// Create all tables
export async function createAllTables(): Promise<void> {
  console.log('🚀 Creating DynamoDB tables...')
  
  const tables = [
    schedulesTableDef, // NEW: tee-schedules (consolidated schedule/event data)
    syncStatusTableDef, // Helper table for sync tracking
  ]

  for (const tableDef of tables) {
    await createTable(tableDef)
  }

  console.log('✅ All tables created successfully!')
  console.log('ℹ️  Note: tee-admin table already exists and will be enhanced with directory records')
}

// Table deletion helper (for development/testing)
export async function deleteAllTables(): Promise<void> {
  const { DeleteTableCommand } = await import('@aws-sdk/client-dynamodb')
  
  console.log('🗑️  Deleting DynamoDB tables...')
  
  for (const tableName of Object.values(tableNames)) {
    try {
      const command = new DeleteTableCommand({ TableName: tableName })
      await dynamoClient.send(command)
      console.log(`✅ Table ${tableName} deleted successfully`)
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`⚠️  Table ${tableName} does not exist`)
      } else {
        console.error(`❌ Failed to delete table ${tableName}:`, error)
      }
    }
  }

  console.log('✅ All tables deleted successfully!')
}