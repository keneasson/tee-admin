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

// Document client marshall options.
//
// `convertEmptyValues` is OFF. It is legacy AWS SDK v2 behaviour that rewrites
// every empty string to a DynamoDB NULL on write — DynamoDB has allowed empty
// strings on non-key attributes since 2020, so it corrupts data for no benefit,
// silently, across every repository on this shared client.
//
// It has caused two production defects already:
//   - the doc-editor crashed on any post with an untouched text block, because
//     `{ body: '' }` read back as `{ body: null }` and `body.split()` threw
//     (#214);
//   - an ecclesia saved with an unparsed address stored province/city as NULL,
//     producing the key `ECCLESIA#CA|` + `#Grand River` — written successfully
//     and then permanently unlistable and unsearchable.
//
// A live scan also found NULL `firstName`/`lastName`/`displayName` on real
// PersonRecords — the always-shown PII floor.
//
// `removeUndefinedValues` stays ON: dropping an absent field is correct, and is
// what optional fields mean.
const dynamoConfig = {
  marshallOptions: {
    convertEmptyValues: false,
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