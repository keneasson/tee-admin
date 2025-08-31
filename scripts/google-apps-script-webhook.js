/**
 * Google Apps Script for TEE Admin Webhook Integration
 * 
 * Instructions:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create a new project
 * 3. Replace the default code with this script
 * 4. Update the WEBHOOK_URL and WEBHOOK_SECRET constants below
 * 5. Save and run the 'setupWebhook' function
 * 6. Authorize the script when prompted
 * 7. The webhook will be automatically triggered on sheet changes
 */

// Configuration - UPDATE THESE VALUES
const WEBHOOK_URL = 'https://www.tee-admin.com/api/sheets/webhook'  // Production URL
const WEBHOOK_SECRET = '8e1008de928c5ebc36d5d234d3344e39840795d6456dd59a254e58b2d9e20220'  // Secure secret (must match server)
const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId()

/**
 * Setup webhook trigger for the current spreadsheet
 * Run this function once to set up the webhook
 */
function setupWebhook() {
  try {
    // Delete existing triggers for this spreadsheet
    const triggers = ScriptApp.getProjectTriggers()
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onSheetChange') {
        ScriptApp.deleteTrigger(trigger)
      }
    })
    
    // Create new trigger
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    ScriptApp.newTrigger('onSheetChange')
      .timeBased()
      .everyMinutes(1)  // Check for changes every minute
      .create()
    
    // Also create an edit trigger for immediate detection
    ScriptApp.newTrigger('onSheetEdit')
      .timeBased()
      .everyMinutes(1)
      .create()
    
    console.log('✅ Webhook triggers set up successfully for sheet:', SHEET_ID)
    console.log('🔗 Webhook URL:', WEBHOOK_URL)
    
    // Test the webhook
    testWebhook()
    
  } catch (error) {
    console.error('❌ Error setting up webhook:', error)
    throw error
  }
}

/**
 * Handle sheet changes (triggered by timer)
 */
function onSheetChange() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const lastModified = new Date(spreadsheet.getLastUpdated())
    const now = new Date()
    
    // Only trigger if sheet was modified in the last 2 minutes
    const timeDiff = (now.getTime() - lastModified.getTime()) / 1000 / 60
    if (timeDiff > 2) {
      return // No recent changes
    }
    
    sendWebhook({
      eventType: 'SHEET_CHANGED',
      sheetId: SHEET_ID,
      changeType: 'UPDATE',
      timestamp: new Date().toISOString(),
      lastModified: lastModified.toISOString(),
    })
    
  } catch (error) {
    console.error('❌ Error in onSheetChange:', error)
  }
}

/**
 * Handle sheet edits (triggered immediately on edit)
 */
function onSheetEdit(event) {
  try {
    const range = event?.range
    const rangeA1Notation = range ? range.getA1Notation() : 'Unknown'
    
    sendWebhook({
      eventType: 'SHEET_CHANGED',
      sheetId: SHEET_ID,
      range: rangeA1Notation,
      changeType: 'UPDATE',
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('❌ Error in onSheetEdit:', error)
  }
}

/**
 * Send webhook to TEE Admin API
 */
function sendWebhook(payload) {
  try {
    const payloadString = JSON.stringify(payload)
    const signature = generateSignature(payloadString)
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': `sha256=${signature}`,
        'User-Agent': 'GoogleAppsScript/TEE-Admin-Webhook',
      },
      payload: payloadString,
    }
    
    console.log('📤 Sending webhook:', payload)
    
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options)
    const responseText = response.getContentText()
    
    if (response.getResponseCode() === 200) {
      console.log('✅ Webhook sent successfully:', responseText)
    } else {
      console.error('❌ Webhook failed:', response.getResponseCode(), responseText)
    }
    
  } catch (error) {
    console.error('❌ Error sending webhook:', error)
  }
}

/**
 * Generate HMAC signature for webhook security
 */
function generateSignature(payload) {
  try {
    const signature = Utilities.computeHmacSha256Signature(payload, WEBHOOK_SECRET)
    return Utilities.base64Encode(signature)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  } catch (error) {
    console.error('❌ Error generating signature:', error)
    return ''
  }
}

/**
 * Test webhook functionality
 */
function testWebhook() {
  try {
    console.log('🧪 Testing webhook...')
    
    sendWebhook({
      eventType: 'SHEET_CHANGED',
      sheetId: SHEET_ID,
      changeType: 'UPDATE',
      timestamp: new Date().toISOString(),
      test: true,
    })
    
    console.log('✅ Test webhook sent')
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error)
  }
}

/**
 * Remove all webhook triggers (cleanup function)
 */
function removeWebhooks() {
  try {
    const triggers = ScriptApp.getProjectTriggers()
    let removedCount = 0
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onSheetChange' || 
          trigger.getHandlerFunction() === 'onSheetEdit') {
        ScriptApp.deleteTrigger(trigger)
        removedCount++
      }
    })
    
    console.log(`🗑️ Removed ${removedCount} webhook triggers`)
    
  } catch (error) {
    console.error('❌ Error removing webhooks:', error)
  }
}

/**
 * Get current webhook status
 */
function getWebhookStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers()
    const webhookTriggers = triggers.filter(trigger => 
      trigger.getHandlerFunction() === 'onSheetChange' || 
      trigger.getHandlerFunction() === 'onSheetEdit'
    )
    
    console.log('📊 Webhook Status:')
    console.log('  Sheet ID:', SHEET_ID)
    console.log('  Webhook URL:', WEBHOOK_URL)
    console.log('  Active Triggers:', webhookTriggers.length)
    
    webhookTriggers.forEach((trigger, index) => {
      console.log(`  Trigger ${index + 1}:`, trigger.getHandlerFunction())
    })
    
    return {
      sheetId: SHEET_ID,
      webhookUrl: WEBHOOK_URL,
      activeTriggers: webhookTriggers.length,
      triggers: webhookTriggers.map(t => t.getHandlerFunction()),
    }
    
  } catch (error) {
    console.error('❌ Error getting webhook status:', error)
    return null
  }
}

/**
 * Manual webhook trigger (for testing)
 */
function triggerManualWebhook() {
  console.log('🔧 Triggering manual webhook...')
  onSheetChange()
}