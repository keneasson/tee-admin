import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { getAwsDbConfig } from '../email/sesClient'
import { nextAuthDynamoDb } from '../auth'

const dbClientConfig = getAwsDbConfig()

export type DBUser = {
  id: string
  email: string
  name?: string
  role?: string
  ecclesia?: string
  profile?: {
    fname?: string
    lname?: string
    phone?: string
    address?: string
    children?: string
  }
}

export async function getUserFromDynamoDB(email: string): Promise<DBUser | null> {
  try {
    const dbClient = new DynamoDBClient(dbClientConfig)
    const docClient = DynamoDBDocumentClient.from(dbClient)
    
    // Scan for user by email (since email might not be the primary key)
    const params = {
      TableName: nextAuthDynamoDb.tableName,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }
    
    const scanCommand = new ScanCommand(params)
    const result = await docClient.send(scanCommand)
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0]
      console.log('✅ Found user in DynamoDB:', { email, role: item.role })
      
      return {
        id: item.id,
        email: item.email,
        name: item.name,
        role: item.role,
        ecclesia: item.ecclesia,
        profile: item.profile
      }
    }
    
    console.log('📂 No user found in DynamoDB for:', email)
    return null
    
  } catch (error) {
    console.error('❌ Error querying DynamoDB:', error)
    return null
  }
}