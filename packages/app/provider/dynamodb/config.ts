import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// DynamoDB Configuration
export const dynamoConfig = {
  region: process.env.AWS_REGION || 'ca-central-1', // Canada Central as default
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: undefined, // Always use AWS DynamoDB (single production database)
}

// Create DynamoDB client
export const dynamoClient = new DynamoDBClient(dynamoConfig)

// Create document client for easier JSON operations
export const docClient = DynamoDBDocumentClient.from(dynamoClient)

// Table names - no stage prefix (single production database)
export const tableNames = {
  admin: 'tee-admin', // EXISTING table - enhanced
  schedules: 'tee-schedules', // NEW table
  syncStatus: 'tee-sync-status', // Helper table
} as const

export type TableName = keyof typeof tableNames