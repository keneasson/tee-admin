import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// DynamoDB client configuration (matches existing working pattern)
const dbClientConfig: DynamoDBClientConfig = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  region: 'ca-central-1',
}

// Document client marshall options (matches existing working pattern)
const dynamoConfig = {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
}

// Create DynamoDB client with proper credentials
export const dynamoClient = new DynamoDBClient(dbClientConfig)

// Create document client with marshall options
export const docClient = DynamoDBDocumentClient.from(dynamoClient, dynamoConfig)

// Table names - no stage prefix (single production database)
export const tableNames = {
  admin: 'tee-admin', // EXISTING table - enhanced
  schedules: 'tee-schedules', // NEW table
  syncStatus: 'tee-sync-status', // Helper table
  sendQueue: 'tee-send-queue', // NEW table for email scheduling system
} as const

export type TableName = keyof typeof tableNames