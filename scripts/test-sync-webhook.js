/**
 * Google Apps Script Webhook for Test Sync
 * SETUP: Copy this to your Google Sheet's Apps Script editor
 */

// CONFIGURATION - UPDATE THIS FOR YOUR ENVIRONMENT
// Option 1: Production (current setup)
const WEBHOOK_URL = 'https://www.tee-admin.com/api/test-sync/webhook'

// Option 2: ngrok tunnel (for local testing)
// const WEBHOOK_URL = 'https://03f466e15fe0.ngrok-free.app/api/test-sync/webhook'

// Option 3: Vercel Preview (for testing)
// const WEBHOOK_URL = 'https://tee-admin-d9eqlrk71-ken-eassons-projects.vercel.app/api/test-sync/webhook'

const WEBHOOK_SECRET = '8e1008de928c5ebc36d5d234d3344e39840795d6456dd59a254e58b2d9e20220'

// Install the webhook trigger
function setupWebhook() {
  const sheet = SpreadsheetApp.getActive()
  
  // Clear any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers()
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onSheetChange') {
      ScriptApp.deleteTrigger(trigger)
    }
  })
  
  // Create new onChange trigger
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(sheet)
    .onChange()
    .create()
  
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ Test sync webhook installed!', 'Success', 5)
  console.log('Webhook trigger installed for sheet:', sheet.getId())
}

// Handle sheet changes with property-based debouncing
function onSheetChange(e) {
  const properties = PropertiesService.getScriptProperties()
  const now = new Date().getTime()
  
  // Store this change time
  properties.setProperty('lastChangeTime', now.toString())
  
  // Wait 5 seconds, then check if this is still the most recent change
  Utilities.sleep(5000)
  
  const currentLastChange = properties.getProperty('lastChangeTime')
  
  // Only send webhook if no newer changes occurred during the wait
  if (currentLastChange === now.toString()) {
    sendWebhook(e)
  } else {
    console.log('Skipping webhook - newer change detected')
  }
}

function sendWebhook(e) {
  try {
    const payload = {
      source: 'google_sheets',
      eventType: 'SHEET_CHANGED',
      sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      changeType: 'UPDATE',
      timestamp: new Date().toISOString(),
      editedRange: e && e.range ? e.range.getA1Notation() : 'unknown',
      user: e && e.user ? e.user.getEmail() : 'system'
    }
    
    console.log('Sending webhook:', payload)
    
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    })
    
    const responseCode = response.getResponseCode()
    const responseText = response.getContentText()
    
    if (responseCode === 200) {
      console.log('✅ Webhook sent successfully:', responseText)
      SpreadsheetApp.getActiveSpreadsheet().toast('🔔 Data sync triggered!', 'Webhook', 3)
    } else {
      console.error('❌ Webhook failed:', responseCode, responseText)
      SpreadsheetApp.getActiveSpreadsheet().toast(`❌ Webhook failed: ${responseCode}`, 'Error', 5)
    }
    
  } catch (error) {
    console.error('❌ Webhook error:', error.toString())
    SpreadsheetApp.getActiveSpreadsheet().toast(`❌ Webhook error: ${error.message}`, 'Error', 5)
  }
}

// Test function to manually trigger webhook
function testWebhook() {
  console.log('Testing webhook manually...')
  sendWebhook(null)
}

// Check webhook status
function checkWebhookStatus() {
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'GET',
      muteHttpExceptions: true
    })
    
    const status = response.getResponseCode()
    const text = response.getContentText()
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Webhook endpoint: ${status === 200 ? '✅ Online' : '❌ Offline'} (${status})`, 
      'Status', 
      5
    )
    
    console.log('Webhook status:', status, text)
    
  } catch (error) {
    SpreadsheetApp.getActiveSpreadsheet().toast(`❌ Cannot reach webhook: ${error.message}`, 'Error', 5)
    console.error('Status check error:', error)
  }
}

// Remove all triggers (cleanup function)
function removeWebhook() {
  const triggers = ScriptApp.getProjectTriggers()
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onSheetChange') {
      ScriptApp.deleteTrigger(trigger)
    }
  })
  
  SpreadsheetApp.getActiveSpreadsheet().toast('🗑️ Webhook removed', 'Cleanup', 3)
  console.log('All webhook triggers removed')
}