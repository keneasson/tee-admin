/**
 * Google Apps Script Webhook for Google Sheets
 * SETUP: Copy this to your Google Sheet's Apps Script editor
 */

// CONFIGURATION - UPDATE THIS
const WEBHOOK_URL = 'http://localhost:4000/api/sheets/webhook'  // Change for production
const WEBHOOK_SECRET = 'tee-admin-webhook-secret-2025-change-in-production'

function setupWebhook() {
  const sheet = SpreadsheetApp.getActive()
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(sheet)
    .onChange()
    .create()
  
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ Webhook installed!', 'Success', 5)
}

function onSheetChange(e) {
  const payload = {
    eventType: 'SHEET_CHANGED',
    sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    changeType: 'UPDATE',
    timestamp: new Date().toISOString()
  }
  
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  })
}
