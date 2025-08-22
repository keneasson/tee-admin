# Setup Test Sync Sheet

## Manual Setup Steps

1. **Create Google Sheet**
   - Go to https://sheets.google.com
   - Create new spreadsheet
   - Name it: "Data Sheet Exploration Solution"
   - Add three columns: Date, Name, Topic
   - Add sample data:
     ```
     Date        | Name          | Topic
     2025-01-20  | Initial Test  | Test Sync Setup
     2025-01-21  | System Check  | Webhook Validation
     ```

2. **Share with Service Account**
   - Click Share button
   - Add email: `tee-newsletter@tee-services.iam.gserviceaccount.com`
   - Give "Editor" permission

3. **Get Sheet ID**
   - The sheet ID is in the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
   - Copy this ID

4. **Update Configuration**
   - Add the sheet ID to the configuration files (see below)

## Configuration Updates Needed

Once you have the sheet ID, update these files:

### 1. `/apps/next/tee-services-db47a9e534d3.json`
Add to `sheet_ids`:
```json
"testSync": {
  "name": "Test Sync",
  "startTime": "",
  "key": "YOUR_SHEET_ID_HERE"
}
```

### 2. `/apps/next/.env`
Add:
```
TEST_SYNC_SHEET_ID=YOUR_SHEET_ID_HERE
```

## Webhook Setup

The existing webhook at `/api/sheets/webhook` will automatically handle this sheet since it's in the configuration. When changes are made to the sheet, the webhook should trigger and update DynamoDB.

## Testing with Playwright

Use the Playwright test at `/apps/next/tests/e2e/test-sync.spec.ts` to simulate human interaction with the sheet.