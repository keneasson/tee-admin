import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'

const TABLE_NAME = 'tee-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'ken.easson@gmail.com'

    console.log('🔍 Debug raw DynamoDB query for email:', email)

    // Use the exact same client setup as credentials-users.ts
    const dbClientConfig = getAwsDbConfig()
    const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    })

    console.log('📊 Table name:', TABLE_NAME)
    console.log('📊 GSI name: gsi1')
    console.log('📊 Query key:', `USER#${email}`)

    // Execute the exact same query
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
      },
    })

    console.log('📊 Query result count:', result.Items?.length || 0)

    if (result.Items && result.Items.length > 0) {
      console.log('📊 Found items:')
      result.Items.forEach((item, i) => {
        console.log(`   ${i + 1}. Provider: ${item.provider}, ID: ${item.id}, Email: ${item.email}`)
      })
    }

    // Filter for credentials provider
    const credentialsUsers = result.Items?.filter((item) => item.provider === 'credentials') || []
    console.log('📊 Credentials users found:', credentialsUsers.length)

    return NextResponse.json({
      success: true,
      query: {
        tableName: TABLE_NAME,
        indexName: 'gsi1',
        key: `USER#${email}`,
      },
      results: {
        totalItems: result.Items?.length || 0,
        credentialsUsers: credentialsUsers.length,
        items:
          result.Items?.map((item) => ({
            id: item.id,
            email: item.email,
            provider: item.provider,
            role: item.role,
            type: item.type,
          })) || [],
      },
    })
  } catch (error) {
    console.error('💥 Error in raw query test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      },
      { status: 500 }
    )
  }
}
