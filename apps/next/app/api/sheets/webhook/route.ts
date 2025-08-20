import { NextRequest, NextResponse } from 'next/server'
import { WebhookSyncService } from '@my/app/provider/sync/webhook-sync-service'
import { WebhookSecurity } from '@my/app/provider/sync/webhook-security'

// Webhook payload from Google Sheets
interface SheetWebhookPayload {
  eventType: 'SHEET_CHANGED'
  sheetId: string
  range?: string
  changeType: 'INSERT' | 'UPDATE' | 'DELETE'
  timestamp: string
  signature?: string
}

const syncService = new WebhookSyncService()

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const payload: SheetWebhookPayload = await request.json()

    console.log('📥 Webhook received:', {
      sheetId: payload.sheetId,
      eventType: payload.eventType,
      changeType: payload.changeType,
      timestamp: payload.timestamp,
    })

    // Validate required fields
    if (!payload.sheetId || !payload.eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: sheetId, eventType' },
        { status: 400 }
      )
    }

    // Security validation
    const signature = request.headers.get('x-webhook-signature') || payload.signature || null
    if (!WebhookSecurity.validateSignature(JSON.stringify(payload), signature)) {
      console.warn('⚠️ Invalid webhook signature for sheet:', payload.sheetId)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Rate limiting
    if (!WebhookSecurity.rateLimitBySheet(payload.sheetId)) {
      console.warn('⚠️ Rate limit exceeded for sheet:', payload.sheetId)
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Handle the webhook with debouncing
    await syncService.handleWebhook(payload)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      sheetId: payload.sheetId,
      debounced: true,
    })
  } catch (error) {
    console.error('❌ Webhook processing error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature',
    },
  })
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'sheets-webhook',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  })
}
