# Google Sheets Webhook Setup Guide

## 🔍 **The Problem**

Google Sheets **does NOT automatically send webhooks** when data changes. This is why your changes in Google Sheets aren't triggering updates in DynamoDB.

## 📊 **Current Status**

### ✅ What's Working:
- Google Sheets API connection (can read data)
- DynamoDB integration (shared credentials working)
- Manual sync button (forces data sync)
- Webhook endpoint ready (`/api/admin/test-sync/webhook`)
- Admin interface shows both data sources

### ❌ What's Missing:
- Google Sheets doesn't know about our webhook endpoint
- No automatic trigger when sheet data changes
- Webhook never gets called on sheet edits

## 🔧 **Solutions**

### Option 1: Manual Webhook Simulation (Available Now)
1. Edit your Google Sheet
2. Click "🔔 Simulate Webhook" button in admin interface
3. This manually triggers the sync flow
4. DynamoDB gets updated with Google Sheets data

### Option 2: Google Apps Script (Recommended)
Create an onChange trigger in Google Sheets:

```javascript
// In Google Sheets: Extensions → Apps Script
function onEdit(e) {
  // Your webhook endpoint
  const webhookUrl = 'https://your-domain.com/api/admin/test-sync/webhook';
  
  // Debounce to prevent too many calls
  Utilities.sleep(1000);
  
  // Send webhook
  UrlFetchApp.fetch(webhookUrl, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({
      source: 'google_sheets',
      sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      timestamp: new Date().toISOString(),
      editedRange: e.range.getA1Notation(),
      user: e.user.email
    })
  });
}
```

**Setup Steps:**
1. Open your Google Sheet
2. Go to Extensions → Apps Script
3. Paste the code above
4. Update the webhook URL
5. Save and deploy
6. Set up onChange trigger

### Option 3: Google Sheets API Watch (Complex)
Use the Google Sheets API push notifications:

```javascript
// Requires setting up Google Cloud Pub/Sub
const { google } = require('googleapis');

async function watchSheet() {
  const sheets = google.sheets('v4');
  
  const response = await sheets.spreadsheets.watch({
    spreadsheetId: 'YOUR_SHEET_ID',
    requestBody: {
      id: 'unique-channel-id',
      type: 'web_hook',
      address: 'https://your-domain.com/api/admin/test-sync/webhook',
      token: 'your-verification-token'
    }
  });
}
```

**Requirements:**
- Google Cloud Project
- Pub/Sub API enabled
- Domain verification
- SSL certificate

### Option 4: Third-Party Services
- **Zapier**: Connect Google Sheets → Webhook
- **Make (Integromat)**: Google Sheets trigger → HTTP request
- **IFTTT**: Google Sheets → Webhooks service
- **n8n**: Self-hosted automation

## 🎯 **Current Workaround**

The admin interface now provides:

1. **Manual Sync Button**: Forces immediate sync
2. **Simulate Webhook Button**: Triggers the webhook flow manually
3. **Human Edit Workflow**: 
   - Edit sheet manually
   - Monitor for changes
   - Shows what's in Sheets vs DynamoDB

## 📋 **Diagnosis in Admin Interface**

The enhanced admin page now shows:
- **Side-by-side comparison** of Google Sheets vs DynamoDB
- **Diff highlighting** showing records only in Sheets (webhook didn't trigger)
- **Webhook status** showing last trigger time
- **Sync analysis** explaining why data might be out of sync

## 💡 **Recommended Approach**

For testing and development:
1. Use the **"Simulate Webhook"** button after editing sheets
2. This proves the sync mechanism works

For production:
1. Implement Google Apps Script onChange trigger
2. Or use a service like Zapier for reliability

## 🚀 **Next Steps**

1. **Test the manual webhook simulation**:
   - Edit Google Sheet
   - Click "Simulate Webhook"
   - Verify DynamoDB updates

2. **Implement automatic triggers**:
   - Choose Apps Script or third-party service
   - Set up the webhook connection
   - Test automatic sync on sheet changes

3. **Monitor the sync**:
   - Use admin interface to track sync status
   - Check webhook timestamps
   - Verify data consistency

## 🔍 **Debugging Tips**

If sync isn't working:
1. Check webhook endpoint health: `GET /api/admin/test-sync/webhook`
2. Check DynamoDB credentials are correct
3. Verify Google Sheets API access
4. Look for errors in the admin interface
5. Check server logs for webhook receipt

---

**Key Insight**: The infrastructure is working correctly. The only missing piece is Google Sheets doesn't automatically notify our webhook. The manual simulation proves the entire flow works when triggered.