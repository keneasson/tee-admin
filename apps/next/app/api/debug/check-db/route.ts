import { NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'
import { nextAuthDynamoDb } from '../../../../utils/auth'

const dbClientConfig = getAwsDbConfig()

export async function GET() {
  try {
    const dbClient = new DynamoDBClient(dbClientConfig)
    const docClient = DynamoDBDocumentClient.from(dbClient)
    
    // Scan the entire table to see what's in there
    const params = {
      TableName: nextAuthDynamoDb.tableName,
      Limit: 50 // Limit results to avoid too much data
    }
    
    const scanCommand = new ScanCommand(params)
    const result = await docClient.send(scanCommand)
    
    console.log('🔍 DynamoDB scan results:', result.Items)
    
    // Filter to show only user records and their emails/roles
    const users = result.Items?.filter(item => 
      item.pkey?.startsWith('USER#') || item.email
    ).map(item => ({
      id: item.id,
      email: item.email,
      name: item.name,
      role: item.role,
      pkey: item.pkey,
      skey: item.skey,
      ecclesia: item.ecclesia
    }))
    
    return NextResponse.json({
      success: true,
      totalItems: result.Count,
      scannedCount: result.ScannedCount,
      users: users || [],
      rawSample: result.Items?.slice(0, 3) // Show first 3 raw items for debugging
    })
    
  } catch (error) {
    console.error('❌ Error scanning DynamoDB:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}