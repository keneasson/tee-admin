# 📋 Google Sheets Webhook Setup Instructions

## **Production-Ready Webhook System**

The webhook infrastructure is **100% ready** for production deployment. The system now uses simplified table names without stage prefixes (`tee-admin`, `tee-schedules`, `tee-sync-status`) and connects directly to production DynamoDB.

## **Quick Setup (5 minutes)**

### Step 1: Open Your Test Google Sheet
Open: https://docs.google.com/spreadsheets/d/1ffB9-VWxaTQudAskm_m9vP2bbaFwA5l_tkGimTkzXAw/edit

### Step 2: Open Apps Script Editor
1. In the Google Sheet, go to **Extensions → Apps Script**
2. A new tab will open with the script editor

### Step 3: Install the Webhook Script
1. Delete any existing code in the editor
2. Copy ALL the code from: `/scripts/google-apps-script-webhook.js`
3. Paste it into the Apps Script editor

### Step 4: Configure the Webhook URL
In the script, update this line based on your environment:

**For Production (Recommended):**
```javascript
const WEBHOOK_URL = 'https://www.tee-admin.com/api/sheets/webhook'
```

**For Local Testing (with ngrok):**
```javascript
const WEBHOOK_URL = 'https://your-ngrok-id.ngrok.io/api/sheets/webhook'
```

**For Test Sync Endpoint:**
```javascript
const WEBHOOK_URL = 'https://www.tee-admin.com/api/admin/test-sync/webhook'
```

### Step 5: Save & Deploy
1. Click **File → Save** (or Ctrl+S)
2. Name the project (e.g., "TEE Webhook")

### Step 6: Run Setup Function
1. In the function dropdown (top of editor), select `setupWebhook`
2. Click **Run** button
3. **IMPORTANT**: Grant permissions when prompted:
   - "This app isn't verified" → Advanced → Go to [Project Name] (unsafe)
   - Allow all requested permissions

### Step 7: Verify Installation
You should see a toast notification in your Google Sheet:
"✅ Webhook installed!"

## **Testing the Webhook**

### Method 1: Edit the Sheet
1. Make any change in the Google Sheet
2. Wait 30 seconds (debounce period)
3. Check admin interface - DynamoDB should update

### Method 2: Run Test Function
1. In Apps Script editor, select `testWebhook` function
2. Click **Run**
3. Check server logs for webhook receipt

### Method 3: Check Status
1. In Apps Script editor, select `checkWebhookStatus` function
2. Click **Run**
3. See toast notification with webhook status

## **How the Webhook System Works**

The webhook endpoints are production-ready and will sync data directly to the production DynamoDB tables:
- `tee-admin` - User authentication and directory data
- `tee-schedules` - All schedule and event data  
- `tee-sync-status` - Webhook sync tracking

The Google Apps Script creates an **onChange trigger** that:
1. Detects when the sheet is edited
2. Waits 30 seconds (debouncing multiple rapid edits)
3. Sends a POST request to your webhook endpoint
4. Includes security signature for validation
5. Syncs data directly to production DynamoDB (no stage prefixes)

## **Troubleshooting**

### If webhook isn't triggering:
1. Check Apps Script logs: **View → Logs** in script editor
2. Verify the webhook URL is accessible from internet
3. For localhost, use ngrok: `ngrok http 4000`
4. Check server logs for webhook receipts

### Common Issues:
- **403 Forbidden**: Grant permissions in Apps Script
- **404 Not Found**: Wrong webhook URL
- **401 Unauthorized**: Signature mismatch (check WEBHOOK_SECRET)
- **No trigger**: Run `setupWebhook()` again

## **Production Deployment**

### DynamoDB Tables (Already Migrated)
The system now uses simplified table names:
- ✅ `tee-admin` (was `dev-tee-admin`)  
- ✅ `tee-schedules` (was `dev-tee-schedules`)
- ✅ `tee-sync-status` (was `dev-tee-sync-status`)

### Environment Variables Required
No new environment variables needed! Uses existing:
- `AWS_REGION=ca-central-1`
- `AWS_ACCESS_KEY_ID` (existing)
- `AWS_SECRET_ACCESS_KEY` (existing)
- `WEBHOOK_SECRET=8e1008de928c5ebc36d5d234d3344e39840795d6456dd59a254e58b2d9e20220` (for signature validation)

**Security Note**: The webhook secret is now a cryptographically secure 256-bit key generated with `openssl rand -hex 32`.

### For Production Google Sheets:
1. Repeat the setup steps for each production sheet
2. Use the main production webhook URL: `https://www.tee-admin.com/api/sheets/webhook`
   - **Smart routing**: Automatically detects sheet type from Sheet ID
   - **Single endpoint**: Works for all sheet types (Memorial, Bible Class, Sunday School, Directory, Events)
3. Monitor webhook status at: `https://www.tee-admin.com/admin/data-sync` (requires admin login)

## **Verification in Admin Interface**

After setup, the admin interface will show:
- ✅ Google Sheets data (live from API)
- ✅ DynamoDB data (synced to production tables)
- ✅ Last webhook timestamp
- ✅ Sync status (should show "In Sync")

## **Summary of Changes for Production**

### What Changed:
- **Table Names**: Removed stage prefixes (`dev-tee-*` → `tee-*`)
- **Single Database**: All environments use production DynamoDB
- **No Fallback**: Direct DynamoDB access only (no Google Sheets fallback)
- **Simplified Config**: Removed `STAGE` environment variable

### What Stayed the Same:
- ✅ Same webhook URLs and endpoints
- ✅ Same AWS credentials  
- ✅ Same Google Sheets integration
- ✅ Same authentication system
- ✅ Same API structure

**Ready for Production**: The webhook system is fully production-ready with cleaner table names and simplified configuration.