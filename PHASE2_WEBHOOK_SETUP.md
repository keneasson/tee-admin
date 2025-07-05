# Phase 2: Google Sheets Webhook Integration Setup

## ✅ **What's Complete**

### **1. Webhook Infrastructure**
- ✅ **Webhook Endpoint**: `/api/sheets/webhook` - Receives Google Sheets change notifications
- ✅ **Debounced Sync Service**: 30-second delay to handle rapid edits cost-effectively
- ✅ **Security Layer**: HMAC signature validation and rate limiting
- ✅ **Version Checking**: Prevents unnecessary DynamoDB updates
- ✅ **Admin Monitoring**: `/api/sheets/webhook/status` for webhook monitoring

### **2. Data Processing Pipeline**
- ✅ **Google Sheets Service**: Fetches data from Google Sheets API
- ✅ **Sheet Transformer**: Converts sheet data to DynamoDB format
- ✅ **Data Validation**: Integrity checks and error handling
- ✅ **Batch Operations**: Efficient DynamoDB writes

## 🚀 **Setup Instructions**

### **Step 1: Install Dependencies**
```bash
yarn install  # Installs googleapis dependency
```

### **Step 2: Configure Environment Variables**
Update `/apps/next/.env` with your settings:
```bash
# AWS Configuration (already set)
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Webhook Configuration
WEBHOOK_SECRET=tee-admin-webhook-secret-2025-change-in-production
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./tee-services-db47a9e534d3.json

# Sheet Configuration (add your actual sheet IDs)
SCHEDULE_SHEET_ID=your-schedule-sheet-id
DIRECTORY_SHEET_ID=your-directory-sheet-id
EVENTS_SHEET_ID=your-events-sheet-id
```

### **Step 3: Setup Google Apps Script Webhooks**

**For each Google Sheet you want to sync:**

1. **Open Google Apps Script**: Go to [script.google.com](https://script.google.com)
2. **Create New Project**: Click "New Project"
3. **Copy Script**: Replace default code with `/scripts/google-apps-script-webhook.js`
4. **Update Configuration**:
   ```javascript
   const WEBHOOK_URL = 'https://your-domain.vercel.app/api/sheets/webhook'
   const WEBHOOK_SECRET = 'tee-admin-webhook-secret-2025-change-in-production'
   ```
5. **Run Setup**: Execute the `setupWebhook()` function
6. **Authorize**: Grant necessary permissions when prompted

### **Step 4: Test Webhook Integration**

**Test locally:**
```bash
# Start development server
yarn web

# Test webhook endpoint
curl -X GET http://localhost:4000/api/sheets/webhook
# Should return: {"status":"healthy","service":"sheets-webhook",...}
```

**Test webhook status (admin only):**
```bash
# Login as admin user first, then visit:
# http://localhost:4000/api/sheets/webhook/status
```

## 📊 **How It Works**

### **Webhook Flow**
1. **Google Sheet Changes** → Google Apps Script detects edit
2. **Webhook Triggered** → Script sends secure POST to `/api/sheets/webhook`
3. **Debouncing** → System waits 30 seconds for additional edits
4. **Data Fetch** → Retrieves latest sheet data via Google Sheets API
5. **Transform & Validate** → Converts to DynamoDB format
6. **Batch Update** → Efficiently updates DynamoDB tables

### **Cost Optimization Features**
- **30-second debouncing** prevents excessive API calls during heavy editing
- **Version checking** skips updates when no actual changes occurred
- **Batch operations** minimize DynamoDB write units
- **Rate limiting** prevents abuse and unexpected costs

### **Security Features**
- **HMAC signature validation** ensures webhooks are from your Google Apps Scripts
- **Rate limiting** (20 requests/minute per sheet)
- **Admin-only monitoring** endpoints
- **Environment-based configuration**

## 🔍 **Monitoring & Debugging**

### **Webhook Status Endpoint**
- **URL**: `/api/sheets/webhook/status`
- **Access**: Admin/Owner only
- **Shows**: Pending syncs, rate limits, environment config

### **Manual Sync Trigger**
```bash
# POST to webhook status endpoint with admin auth
{
  "sheetId": "your-sheet-id"
}
```

### **Google Apps Script Logs**
- Open your Google Apps Script project
- Go to **Executions** tab to see webhook logs
- Use `console.log()` statements for debugging

### **Server Logs**
```bash
# Development logs show:
📥 Webhook received: {sheetId, eventType, changeType, timestamp}
🔄 Debouncing sync for sheet: sheet-id
⏱️ Cleared existing timeout for sheet: sheet-id
🚀 Starting debounced sync for sheet: sheet-id
📊 Sync completed for sheet-id: {recordsProcessed, recordsSuccessful, ...}
```

## ⚠️ **Important Notes**

### **Google Apps Script Limitations**
- **Trigger limit**: 20 time-based triggers per script
- **Execution time**: 6 minutes maximum per execution
- **Quota**: 6 hours/day for free accounts

### **Production Considerations**
- **Change WEBHOOK_SECRET** in production
- **Use HTTPS** for webhook URL
- **Monitor costs** - watch DynamoDB write units
- **Set up alerts** for failed webhooks

## 🧪 **Testing Scenarios**

### **Test 1: Single Edit**
1. Edit a cell in your Google Sheet
2. Wait 30 seconds
3. Check DynamoDB table for updates
4. Verify data accuracy

### **Test 2: Rapid Edits**
1. Make multiple edits quickly (within 30 seconds)
2. Only one sync should occur after debounce period
3. All changes should be captured

### **Test 3: Rate Limiting**
1. Trigger many webhooks rapidly
2. Should see rate limit warnings after 20 requests/minute
3. System should continue working after rate limit resets

### **Test 4: Invalid Signature**
1. Send webhook with wrong signature
2. Should get 401 Unauthorized response
3. No sync should occur

## 🔄 **Next Steps**

Phase 2 is complete! You can now:

1. **Configure your sheet IDs** in environment variables
2. **Set up Google Apps Script webhooks** for each sheet
3. **Test the integration** with real data
4. **Move to Phase 3**: API Migration to replace Google Sheets calls

The webhook system will automatically keep your DynamoDB tables in sync with Google Sheets changes in real-time!