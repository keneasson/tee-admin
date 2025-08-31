// Debug script to check DynamoDB records
// Use the same approach as the app
async function importAppConfig() {
  const { getAwsDbConfig } = await import('./apps/next/utils/email/sesClient.js')
  const { nextAuthDynamoDb } = await import('./apps/next/utils/auth.js')
  
  return { getAwsDbConfig, nextAuthDynamoDb }
}

const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb')
const { DynamoDB } = require('@aws-sdk/client-dynamodb')

async function checkMetadata() {
  try {
    console.log('🔍 Checking DynamoDB metadata record...')
    
    // Import app config
    const { getAwsDbConfig, nextAuthDynamoDb } = await importAppConfig()
    
    const dbClientConfig = getAwsDbConfig()
    const dynamoDb = DynamoDBDocument.from(new DynamoDB(dbClientConfig))
    const tableName = nextAuthDynamoDb.tableName
    
    console.log('📋 Using table:', tableName)
    console.log('📋 Using region:', dbClientConfig.region)
    
    const result = await dynamoDb.get({
      TableName: tableName,
      Key: {
        pkey: 'TEST#SYNC#STATUS',
        skey: 'METADATA'
      }
    })
    
    console.log('📋 Metadata record:', JSON.stringify(result.Item, null, 2))
    
    // Also check if there are any other TEST#SYNC#STATUS records
    const queryResult = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC#STATUS'
      }
    })
    
    console.log('📊 All TEST#SYNC#STATUS records:')
    queryResult.Items.forEach((item, index) => {
      console.log(`  ${index + 1}:`, JSON.stringify(item, null, 2))
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkMetadata()