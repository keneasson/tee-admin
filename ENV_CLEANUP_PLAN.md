# Environment Variables Cleanup Plan

## Variables to REMOVE from .env

### 1. DynamoDB Table Name (Line 37)
```
DYNAMODB_TABLE_NAME=tee-admin  ❌ REMOVE
```
**Reason**: We use multiple tables, names should be in `table-definitions.ts`
**Action**: Delete line, update any references to use `tableNames` from config

### 2. Sheet IDs (Lines 24-27, 30)
```
MEMORIAL_SHEET_ID=...        ❌ REMOVE
BIBLE_CLASS_SHEET_ID=...     ❌ REMOVE  
SUNDAY_SCHOOL_SHEET_ID=...   ❌ REMOVE
DIRECTORY_SHEET_ID=...       ❌ REMOVE
TEST_SYNC_SHEET_ID=...       ❌ REMOVE
```
**Reason**: Configuration, not secrets. Should be in config file
**Action**: Move to `tee-services-db47a9e534d3.json` or dedicated config

### 3. Google Service Account Key Path (Line 21)
```
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./tee-services-db47a9e534d3.json  ✅ KEEP
```
**Reason**: Filename contains unique ID and file has sensitive data (not in git)
**Pattern**: Similar to AWS Amplify, Firebase - env vars for paths to sensitive files

## Variables to KEEP (True Secrets)

### AWS Credentials ✅
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### Authentication Secrets ✅
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SECRET` (verify if needed)

### External Service Keys ✅
- `POSTMARK_API_TOKEN`
- `NEXT_PUBLIC_GOOGLE_CLIENTID`
- `NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET`
- `WEBHOOK_SECRET`

### Service Account ✅
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (path to sensitive file)

## Variables to VERIFY

### Build Configuration (Lines 1-3) ✅ KEEP
```
IGNORE_TS_CONFIG_PATHS=true
TAMAGUI_TARGET=web
TAMAGUI_DISABLE_WARN_DYNAMIC_LOAD=1
```
**Reason**: Required by Tamagui compiler and build process

### URLs/Paths (Lines 8, 33) ✅ KEEP
```
NEXT_PUBLIC_API_PATH=/
NEXTAUTH_URL=http://localhost:4000
```
**Reason**: Environment-specific - different values needed for local vs production

## Implementation Steps

1. **Update existing Google services config file**
   - Sheet IDs already exist in `apps/next/tee-services-db47a9e534d3.json`
   - Add `TEST_SYNC` sheet ID if missing
   - Template available at `apps/next/tee-services-db47a9e534d3.tmpt.json`

2. **Update all references**
   - Search for `process.env.DYNAMODB_TABLE_NAME`
   - Search for `process.env.*_SHEET_ID`
   - Replace with config imports

3. **Test locally**
   - Remove variables from .env
   - Run application
   - Verify all features work

4. **Update Vercel**
   - Remove non-secret variables from Vercel dashboard
   - Deploy and verify

## Files REQUIRING Updates (Complete Audit)

**See `COMPLETE_ENV_VAR_AUDIT.md` for detailed analysis**

### HIGH PRIORITY - Core Business Logic
- `apps/next/utils/cache.ts` - 3 functions using env vars inappropriately
- `packages/app/provider/sync/webhook-sync-service.ts` - Direct env var mapping
- `packages/app/provider/sync/sheet-transformer.ts` - Env vars in transformer

### MEDIUM PRIORITY - API Routes  
- `apps/next/app/api/webhook/route.ts` - Health check using env vars
- `apps/next/app/api/test-sync/webhook/route.ts` - Duplicated pattern
- `apps/next/app/api/admin/test-sync/webhook/route.ts` - Third duplication

### LOW PRIORITY - Dev/Test Utilities
- `apps/next/utils/test-sync/service.ts` - Test service (acceptable)
- Various scripts (acceptable for scripts)

**CRITICAL**: Environment variables have leaked into business logic layers, violating architecture patterns and creating maintenance issues.

## Verification Checklist

- [ ] All DynamoDB operations use `tableNames` config
- [ ] All Sheet IDs come from config file
- [ ] No hardcoded staging/production splits
- [ ] Vercel dashboard updated
- [ ] Local development still works
- [ ] Production deployment successful

---
**IMPORTANT**: Do NOT commit .env file with secrets to git!