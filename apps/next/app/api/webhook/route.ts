import { NextRequest, NextResponse } from 'next/server'
import { WebhookSyncService } from '@my/app/provider/sync/webhook-sync-service'
import { WebhookSecurity } from '@my/app/provider/sync/webhook-security'
import { googleSheetsConfig } from '@my/app/config/google-sheets'

// Webhook handler — requires WEBHOOK_SECRET for authentication
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Read raw body for HMAC signature validation
    const rawBody = await request.text()

    // Validate webhook secret — supports multiple auth methods:
    // 1. Authorization: Bearer <secret> or x-webhook-secret: <secret> (direct secret)
    // 2. x-webhook-signature: sha256=<hmac> (HMAC signature from Google Apps Script)
    const webhookSecret = process.env.WEBHOOK_SECRET
    const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-secret')
    const signatureHeader = request.headers.get('x-webhook-signature')

    let authenticated = false
    if (authHeader && webhookSecret) {
      authenticated = authHeader === `Bearer ${webhookSecret}` || authHeader === webhookSecret
    }
    if (!authenticated && signatureHeader) {
      authenticated = WebhookSecurity.validateSignature(rawBody, signatureHeader)
    }
    if (webhookSecret && !authenticated) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

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