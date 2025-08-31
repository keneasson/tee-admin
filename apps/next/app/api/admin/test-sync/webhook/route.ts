import { NextRequest, NextResponse } from 'next/server'
import { WebhookSyncService } from '@my/app/provider/sync/webhook-sync-service'
import { googleSheetsConfig } from '@my/app/config/google-sheets'
import crypto from 'crypto'

// Webhook security validation
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    console.warn('⚠️ WEBHOOK_SECRET not configured, skipping signature verification')
    return true // Allow in development
  }
  
  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
}

// Production webhook handler using proper WebhookSyncService
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256') || ''
    
    console.log('🎯 WEBHOOK RECEIVED:', {
      timestamp: new Date().toISOString(),
      signature: signature ? 'Present' : 'Missing',
      bodyLength: rawBody.length,
      headers: {
        'content-type': request.headers.get('content-type'),
        'user-agent': request.headers.get('user-agent'),
      }
    })

    // Verify signature (security)
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Webhook signature verification failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse payload
    let payload
    try {
      payload = JSON.parse(rawBody)
      console.log('📋 Webhook payload:', payload)
    } catch (parseError) {
      console.error('❌ Invalid JSON payload:', parseError)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Extract sheet ID from payload
    const sheetId = payload.sheetId || payload.spreadsheetId
    if (!sheetId) {
      console.error('❌ No sheet ID found in payload')
      return NextResponse.json({ error: 'Sheet ID required' }, { status: 400 })
    }

    console.log(`🔄 Processing webhook for sheet: ${sheetId}`)

    // Use the proper WebhookSyncService
    const webhookService = new WebhookSyncService()
    
    // Handle webhook with debouncing
    await webhookService.handleWebhook({
      eventType: 'SHEET_CHANGED',
      sheetId,
      changeType: payload.changeType || 'UPDATE',
      timestamp: new Date().toISOString()
    })

    const responseTime = Date.now() - startTime
    console.log(`✅ Webhook processed successfully in ${responseTime}ms`)

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processing',
      sheetId,
      timestamp: new Date().toISOString(),
      processingTime: responseTime
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('❌ Webhook processing error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: responseTime
    })
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        timestamp: new Date().toISOString(),
        processingTime: responseTime 
      },
      { status: 500 }
    )
  }
}

// Health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'webhook-sync-service',
    timestamp: new Date().toISOString(),
    environment: {
      hasWebhookSecret: !!process.env.WEBHOOK_SECRET,
      configuredSheets: googleSheetsConfig.getAllSheets().map(s => s.type),
    }
  })
}