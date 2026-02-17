# AI Architecture Reference - TEE Admin System

> **PURPOSE**: AI-optimized documentation for accurate, assumption-free development
> **SCAN PATTERN**: Read only relevant sections based on task keywords

## 🚨 CRITICAL RULES - ALWAYS READ FIRST

### Deployment
- **DEPLOY**: `vercel deploy` (preview) or `vercel deploy --prod` (production)
- **NEVER**: Use git commits/push for deployment
- **NEVER**: Create staging/dev environment variables
- **PRINCIPLE**: Everything is production-ready, feature flags control rollout

### Environment Variables
- **ONLY FOR SECRETS**: AWS keys, OAuth secrets, API keys
- **CONFIG FILE PATH**: GOOGLE_SERVICE_ACCOUNT_KEY_FILE points to JSON config
- **NOT FOR CONFIG VALUES**: Sheet IDs, table names, feature flags
- **LOCATION**: Only in `.env` or Vercel dashboard
- **REQUIRED VARIABLES**:
  ```
  # Secrets
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_REGION
  NEXTAUTH_SECRET
  NEXT_PUBLIC_GOOGLE_CLIENTID
  NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET
  WEBHOOK_SECRET
  
  # Config file path (points to YOUR specific config file)
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./tee-services-db47a9e534d3.json
  ```

### DynamoDB Patterns
- **MULTIPLE TABLES**: Not single massive table
- **TABLE NAMES**: Hardcoded in `table-definitions.ts`, NOT in .env
- **KEY NAMING**: Use `PK` and `SK` (not pkey/skey) for consistency
- **ACCESS PATTERN**: Route → Service → Repository → DynamoDB
- **NEVER**: Direct DynamoDB calls in routes/pages

## 📊 SYSTEM BOUNDARIES

### 1. DATABASE LAYER
**Location**: `packages/app/provider/dynamodb/`
**Tables**: 
- `tee-admin` - Users, invitations, roles
- `tee-schedules` - All schedule data
- `tee-sync-status` - Sync metadata

**Access Patterns**:
```
ALWAYS USE REPOSITORIES:
- adminRepo: packages/app/provider/dynamodb/repositories/admin-repository.ts
- scheduleRepo: packages/app/provider/dynamodb/repositories/schedule-repository.ts
- syncRepo: packages/app/provider/dynamodb/repositories/sync-repository.ts
```

**Key Structures**:
```typescript
// Schedule Keys
PK: `SCHEDULE#${sheetType}` // e.g., SCHEDULE#SUNDAYSCHOOL
SK: `${date}#${id}` // e.g., 2025-01-15#uuid

// User Keys
PK: `USER#${email}`
SK: `PROFILE`

// Sync Status Keys
PK: `SYNC#${sheetId}`
SK: `STATUS`
```

### 2. GOOGLE SHEETS INTEGRATION
**Location**: `packages/app/provider/sync/`
**Config Service**: `packages/app/config/google-sheets.ts`
**Flow**: Webhook → WebhookSyncService → Repository → DynamoDB
**Sheet Types**: memorial, bibleClass, sundaySchool, directory, testSync

**Configuration Requirements**:
- **FAIL FAST**: No fallbacks, config file MUST exist
- **ENV VAR**: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` points to YOUR config file
- **Template**: Copy `tee-services-db47a9e534d3.tmpt.json` and add YOUR credentials
- **Git**: Config file must be in .gitignore (contains private data)

**Access Pattern**: 
```typescript
import { googleSheetsConfig } from '@my/app/config/google-sheets'
const sheetType = googleSheetsConfig.getSheetType(sheetId)  // Throws if not configured
const sheetId = googleSheetsConfig.getSheetId(type)         // Returns null if not found
```

### 3. AUTHENTICATION
**Location**: `apps/next/app/api/auth/`
**Provider**: NextAuth v5 with Google OAuth + Credentials
**Roles**: owner, admin, member, guest
**Storage**: DynamoDB `tee-admin` table

### 4. EMAIL SYSTEM
**Location**: `packages/app/provider/email/`
**Service**: AWS SES
**Templates**: `apps/email-builder/`
**Campaigns**: Vercel cron jobs

### 5. UI COMPONENTS
**Location**: `packages/ui/src/`
**Framework**: Tamagui
**Pattern**: Cross-platform (web + mobile)
**Testing**: `/brand/*` routes for component development

### 6. FEATURE FLAGS
**Location**: `packages/app/features/feature-flags/`
**Purpose**: Production-safe feature rollout
**Never**: Environment-based flags

## 🔄 INTEGRATION POINTS

### Schedule + Newsletter
- **Shared Data**: Both read from `scheduleRepo`
- **Key**: `SCHEDULE#MEMORIAL`, `SCHEDULE#SUNDAYSCHOOL`
- **Cache**: Use `revalidateScheduleCache()` after updates

### Webhook → Database
```typescript
// CORRECT FLOW:
POST /api/sheets/webhook
  → WebhookSyncService.handleWebhook()
    → SheetTransformer.transform*Data()
      → scheduleRepo.replaceSheetSchedules()
        → DynamoDB
```

### Auth → Role Checks
```typescript
// ALWAYS USE:
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
const session = await getServerSession(authOptions)
```

## ❌ ANTI-PATTERNS - NEVER DO

1. **NEVER** create staging/dev environment splits
2. **NEVER** put config values in .env (only secrets)
3. **NEVER** make direct DynamoDB calls outside repositories
4. **NEVER** assume library availability without checking package.json
5. **NEVER** deploy via git push (use `vercel deploy`)
6. **NEVER** create new key patterns without documenting here
7. **NEVER** bypass repository pattern for data access

## 🛠️ COMMON OPERATIONS

### Add New Schedule Type
1. Define key pattern in this doc
2. Add to `SheetTransformer`
3. Update `scheduleRepo` with access method
4. Test with `/api/admin/test-sync/*` endpoints

### Add Environment Variable
1. **STOP** - Is it a secret?
2. If NO → Add to config file instead
3. If YES → Add to `.env` AND Vercel dashboard

### Deploy Changes
```bash
# Preview
vercel deploy

# Production (after testing)
vercel deploy --prod
```

## 📝 RECENT FIXES

### Environment Variable Cleanup (Fixed 2025-01-31)
- **Issue**: Sheet IDs scattered in env vars throughout business logic
- **Solution**: Created GoogleSheetsConfig service, removed all Sheet ID env vars
- **Files Updated**: cache.ts, webhook-sync-service.ts, sheet-transformer.ts, all webhook routes
- **Status**: Complete - Sheet IDs now centralized in Google services config

### Webhook Integration (Fixed 2025-01-31)
- **Issue**: Wrong key patterns, missing env vars
- **Solution**: Standardized on `PK: SCHEDULE#TYPE` pattern
- **Status**: Working, now using centralized config

## 🔍 QUICK REFERENCE

**Find schedule data**: `scheduleRepo.getSchedulesByType()`
**Find user data**: `adminRepo.getUserByEmail()`
**Update sync status**: `syncRepo.updateSyncStatus()`
**Check feature flag**: `isFeatureEnabled('flag-name')`
**Invalidate cache**: `revalidateScheduleCache()`

## 📚 RELATED DOCUMENTATION

### Development Patterns
- **Feature Development**: See `AI_FEATURE_DEVELOPMENT_PATTERNS.md`
- **Navigation Audit**: See `AI_NAVIGATION_AUDIT.md`
- **DynamoDB Contracts**: See `AI_DYNAMODB_CONTRACTS.md`
- **Environment Variables**: See `COMPLETE_ENV_VAR_AUDIT.md`

### Critical Rules
1. **ALWAYS** test mobile responsiveness
2. **NEVER** put business logic in routes/pages
3. **ALWAYS** use repository pattern for data access
4. **NEVER** create multiple versions of same component
5. **ALWAYS** remove experiments after promotion

---
**REMEMBER**: When in doubt, check existing patterns in repositories first!