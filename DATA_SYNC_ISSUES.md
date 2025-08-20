# Data Sync Issues - Root Cause Analysis

## Current State (BROKEN)
```
Google Sheets → [Webhook] → ❌ DynamoDB (NOT updating)
                    ↓
            Frontend bypasses and hits Google Sheets directly
```

## Desired State
```
Google Sheets → Webhook → DynamoDB → Cache → Frontend (FAST)
```

## Issues Found

### 1. Webhook Not Updating DynamoDB
- `WebhookSyncService` exists but may not be working correctly
- Uses 30-second debounce which might be too long
- No clear error logging showing why updates fail

### 2. API Falls Back to Google Sheets
- `/api/upcoming-program/route.ts` line 62: When DynamoDB data is stale, it directly fetches from Google Sheets
- This defeats the entire purpose of the caching layer
- Performance impact: Every request hits Google Sheets API

### 3. Architecture Issues
- Using classes (`WebhookSyncService`, `ScheduleService`) instead of pure functions
- Logic mixed in routes instead of separate service layer (MVC pattern)
- No clear separation of concerns

## Fix Strategy

### Phase 1: Debug Webhook
1. Add comprehensive logging to webhook handler
2. Test webhook manually to see if it's even being triggered
3. Check DynamoDB write permissions and errors
4. Verify Google Sheets webhook configuration

### Phase 2: Fix Data Flow
1. Remove Google Sheets fallback from API routes
2. Ensure webhook properly updates DynamoDB
3. Add proper error handling and monitoring
4. Implement retry mechanism for failed syncs

### Phase 3: Refactor to MVC + Pure Functions
1. Extract all logic from routes to service functions
2. Convert classes to pure functions
3. Create clear data flow: Controller (route) → Service (logic) → Repository (data)
4. Share service functions between different access patterns (HTTP, API, webhook)

## Immediate Actions
1. Check webhook logs to see if it's being triggered
2. Test DynamoDB write operations manually
3. Remove Google Sheets fallback temporarily to force DynamoDB usage
4. Add proper monitoring/alerting for sync failures