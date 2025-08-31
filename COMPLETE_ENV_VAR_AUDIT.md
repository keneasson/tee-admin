# Complete Environment Variable Usage Audit

## 🚨 ANTI-PATTERNS DISCOVERED

### MAJOR VIOLATION: Environment Variables Used Throughout Business Logic

Environment variables for Sheet IDs are scattered across **10 different files** in inappropriate places, violating the established architecture patterns.

## Files Requiring Updates (COMPLETE LIST)

### ❌ HIGH PRIORITY - Core Business Logic (WRONG LAYER)

**1. `apps/next/utils/cache.ts`** - Lines 142-147, 202-207, 233-256
- **VIOLATION**: Cache layer directly reading environment variables
- **SHOULD USE**: Google services config file
- **FUNCTIONS**: `loadSheetConfig()`, `getSheetIdFromType()`, `getAllSheetMappings()`

**2. `packages/app/provider/sync/webhook-sync-service.ts`** - Lines 165-169
- **VIOLATION**: Service layer hardcoding env var mapping
- **SHOULD USE**: Configuration service or Google services file
- **FUNCTION**: `determineSheetType()` method

**3. `packages/app/provider/sync/sheet-transformer.ts`** - Lines 236-240
- **VIOLATION**: Transformer layer reading environment variables directly
- **SHOULD USE**: Configuration passed from service layer
- **FUNCTION**: `getSheetTypeFromId()` method

### ❌ MEDIUM PRIORITY - API Routes (INAPPROPRIATE COUPLING)

**4. `apps/next/app/api/webhook/route.ts`** - Lines 76-79
- **VIOLATION**: API route checking environment variable existence
- **SHOULD USE**: Configuration service to check available sheets
- **PURPOSE**: Health check response

**5. `apps/next/app/api/test-sync/webhook/route.ts`** - Lines 76-79
- **VIOLATION**: Same as above, duplicated code
- **SHOULD USE**: Shared configuration service

**6. `apps/next/app/api/admin/test-sync/webhook/route.ts`** - Lines 110-113
- **VIOLATION**: Same pattern, third duplication
- **SHOULD USE**: Shared configuration service

### ⚠️ LOW PRIORITY - Test/Dev Utilities

**7. `apps/next/utils/test-sync/service.ts`** - Line 29
- **VIOLATION**: Test service directly reading env var
- **ACCEPTABLE**: Dev/test utilities can use env vars as fallback

**8. `scripts/populate-dynamodb.ts`**
- **ACCEPTABLE**: Scripts can use env vars

**9. `scripts/create-test-sync-sheet.ts`**
- **ACCEPTABLE**: Scripts can use env vars

### ✅ DOCUMENTATION ONLY (No Code Changes)

**10. Various `.md` files**
- **ACTION**: Update documentation after cleanup

## ARCHITECTURE VIOLATIONS IDENTIFIED

### 1. **Cache Layer Reading Environment Variables**
The cache utility (`apps/next/utils/cache.ts`) contains complex fallback logic reading from both config file AND environment variables. This creates:
- **Inconsistent behavior** between environments
- **Tight coupling** between cache and environment configuration
- **Difficult testing** scenarios

### 2. **Business Logic Scattered Across Layers**
Sheet ID → Type mapping logic exists in **THREE different places**:
- `apps/next/utils/cache.ts` (lines 118-163, 192-211)
- `packages/app/provider/sync/webhook-sync-service.ts` (lines 164-172)  
- `packages/app/provider/sync/sheet-transformer.ts` (lines 235-242)

### 3. **Duplicated Environment Variable Checks**
The same boolean check pattern (`!!process.env.SHEET_ID`) is copy-pasted across **THREE API routes**.

## RECOMMENDED SOLUTION

### 1. Create Configuration Service
```typescript
// packages/app/config/google-sheets.ts
export class GoogleSheetsConfig {
  private static instance: GoogleSheetsConfig
  private sheetMapping: Record<string, SheetTypeInfo>
  
  static getInstance(): GoogleSheetsConfig {
    if (!GoogleSheetsConfig.instance) {
      GoogleSheetsConfig.instance = new GoogleSheetsConfig()
    }
    return GoogleSheetsConfig.instance
  }
  
  private constructor() {
    // Load from tee-services-db47a9e534d3.json
    this.sheetMapping = this.loadSheetConfiguration()
  }
  
  getSheetType(sheetId: string): string
  getSheetId(type: string): string | null
  getAllSheets(): SheetInfo[]
  isSheetConfigured(type: string): boolean
}
```

### 2. Update All Files to Use Config Service
- Remove all `process.env.*_SHEET_ID` usage
- Import and use `GoogleSheetsConfig.getInstance()`
- Eliminate duplicated mapping logic

### 3. Remove Environment Variables
Only after ALL files are updated:
- Remove Sheet ID variables from `.env`
- Update Vercel environment variables
- Add `TEST_SYNC` to Google services config if missing

## DEPLOYMENT RISK ASSESSMENT

**HIGH RISK**: This cleanup touches core business logic across multiple layers. Must be done carefully:

1. **Create config service first**
2. **Update files one by one**
3. **Test each change thoroughly**
4. **Remove environment variables LAST**

## Files Modified During Recent Webhook Work

These files were recently changed and contain the problematic patterns:
- `webhook-sync-service.ts` ✅ **PRIORITY 1**
- `sheet-transformer.ts` ✅ **PRIORITY 1**  
- API webhook routes ✅ **PRIORITY 2**

---
**CONCLUSION**: Environment variables have leaked into business logic layers where they don't belong, creating exactly the type of coupling and maintenance nightmare you were concerned about.