import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, syncSheetToDynamo } from '../../../../../utils/test-sync/service'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'

// Simple webhook handler for test sync
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    console.log('🎯 Test webhook received:', {
      timestamp: new Date().toISOString(),
      payload: JSON.stringify(payload, null, 2)
    })

    // Update webhook timestamp
    const dynamoDb = DynamoDBDocument.from(new DynamoDB({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    }))

    await dynamoDb.update({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'tee-admin',
      Key: {
        pkey: 'TEST#SYNC#STATUS',
        skey: 'METADATA'
      },
      UpdateExpression: 'SET lastWebhook = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': new Date().toISOString()
      }
    })

    // Trigger sync after a short delay (simulate debouncing)
    setTimeout(async () => {
      console.log('⏰ Executing delayed sync from webhook')
      const sheetData = await getSheetData()
      const result = await syncSheetToDynamo(sheetData)
      console.log('✅ Webhook sync completed:', result)
    }, 5000) // 5 second delay for testing

    return NextResponse.json({
      success: true,
      message: 'Test webhook received and processing',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Test webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'test-sync-webhook',
    timestamp: new Date().toISOString()
  })
}