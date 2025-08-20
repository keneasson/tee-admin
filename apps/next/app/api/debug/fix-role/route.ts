import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'
import { nextAuthDynamoDb } from '../../../../utils/auth'

const dbClientConfig = getAwsDbConfig()

export async function POST(request: NextRequest) {
  const { email, newRole } = await request.json()

  if (!email || !newRole) {
    return NextResponse.json(
      {
        error: 'Email and newRole parameters required',
        usage: 'POST with body: { "email": "user@example.com", "newRole": "owner" }',
      },
      { status: 400 }
    )
  }

  try {
    const dbClient = new DynamoDBClient(dbClientConfig)
    const docClient = DynamoDBDocumentClient.from(dbClient)

    console.log('🔧 Fixing role for email:', email, 'to role:', newRole)

    // First, scan to find all user records with this email
    const scanParams = {
      TableName: nextAuthDynamoDb.tableName,
      FilterExpression: 'email = :email AND #type = :userType',
      ExpressionAttributeValues: {
        ':email': email,
        ':userType': 'USER',
      },
      ExpressionAttributeNames: {
        '#type': 'type',
      },
    }

    const scanCommand = new ScanCommand(scanParams)
    const scanResult = await docClient.send(scanCommand)

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No user records found with that email',
      })
    }

    // Update each user record
    const updatePromises = scanResult.Items.map(async (item) => {
      const updateParams = {
        TableName: nextAuthDynamoDb.tableName,
        Key: {
          pkey: item.pkey,
          skey: item.skey,
        },
        UpdateExpression: 'SET #role = :newRole',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':newRole': newRole,
        },
        ReturnValues: 'ALL_NEW',
      }

      const updateCommand = new UpdateCommand(updateParams)
      return await docClient.send(updateCommand)
    })

    const results = await Promise.all(updatePromises)

    console.log('✅ Updated roles for', results.length, 'user records')

    return NextResponse.json({
      success: true,
      message: `Updated role to ${newRole} for ${results.length} user record(s)`,
      updatedRecords: results.length,
      email,
      newRole,
    })
  } catch (error) {
    console.error('❌ Error updating role:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
