import { NextRequest, NextResponse } from 'next/server'
import { WebhookSyncService } from '@my/app/provider/sync/webhook-sync-service'
import { googleSheetsConfig } from '@my/app/config/google-sheets'

// Webhook handler — requires WEBHOOK_SECRET for authentication
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Validate webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET
    const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret')
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}` && authHeader !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const payload = await request.json()

    // Extract sheet ID from payload
    const sheetId = payload.sheetId || payload.spreadsheetId
    if (!sheetId) {
      console.error('❌ No sheet ID found in payload')
      return NextResponse.json({ error: 'Sheet ID required' }, { status: 400 })
    }

    // Validate that this is from Google Sheets (if source is provided)
    if (payload.source && payload.source !== 'google_sheets') {
      console.error('❌ Invalid webhook source:', payload.source)
      return NextResponse.json({ error: 'Invalid webhook source' }, { status: 400 })
    }


    // Use the proper WebhookSyncService with all our fixes
    const webhookService = new WebhookSyncService()
    
    // Handle webhook with debouncing and safe sync logic
    await webhookService.handleWebhook({
      eventType: 'SHEET_CHANGED',
      sheetId,
      changeType: payload.changeType || 'UPDATE',
      timestamp: new Date().toISOString()
    })

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processing',
      sheetId,
      timestamp: new Date().toISOString(),
      processingTime: responseTime,
      source: payload.source || 'unknown'
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('❌ Google Sheets webhook processing error:', {
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

// Health check (no auth required — does not expose env details)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'google-sheets-webhook',
    timestamp: new Date().toISOString(),
  })
}