# TEE Admin Architecture Reference

> **Purpose**: Single source of truth for system architecture, data contracts, and integration patterns.
> **Audience**: Developers (human and AI) working on TEE Admin codebase

---

## Critical Rules

### Deployment
- **Deploy**: `vercel deploy` (preview) or `vercel deploy --prod` (production)
- **Never**: Use git commits/push for deployment
- **Never**: Create staging/dev environment variables
- **Principle**: Everything is production-ready, feature flags control rollout

### Environment Variables
Environment variables are **only for secrets**:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
NEXTAUTH_SECRET
NEXT_PUBLIC_GOOGLE_CLIENTID
NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET
WEBHOOK_SECRET
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./tee-services-db47a9e534d3.json
```

Configuration values (Sheet IDs, table names, feature flags) belong in **config files**, not environment variables.

### Cross-Platform Architecture
`packages/app/` and `packages/ui/` are shared between Next.js and Expo:
- **Never** import `next-auth/*`, `next/*`, or `next-app/*` in shared packages
- Session data must be passed as **props** from platform-specific code
- Use callbacks for navigation (e.g., `onNavigate` prop instead of `useRouter`)

---

## System Boundaries

### 1. Database Layer
**Location**: `packages/app/provider/dynamodb/`

**Tables**:
| Table | Purpose |
|-------|---------|
| `tee-admin` | Users, invitations, roles |
| `tee-schedules` | All schedule data |
| `tee-sync-status` | Sync metadata |

**Access Pattern**: Always use repositories
```typescript
import { adminRepo } from '@my/app/provider/dynamodb/repositories/admin-repository'
import { scheduleRepo } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { syncRepo } from '@my/app/provider/dynamodb/repositories/sync-repository'
```

### 2. Google Sheets Integration
**Location**: `packages/app/provider/sync/`
**Config Service**: `packages/app/config/google-sheets.ts`
**Flow**: Webhook → WebhookSyncService → Repository → DynamoDB
**Sheet Types**: memorial, bibleClass, sundaySchool, directory, testSync

### 3. Authentication
**Location**: `apps/next/app/api/auth/`
**Provider**: NextAuth v5 with Google OAuth + Credentials
**Roles**: owner, admin, member, guest
**Storage**: DynamoDB `tee-admin` table

### 4. Email System
**Location**: `packages/app/provider/email/`
**Service**: AWS SES
**Templates**: `apps/email-builder/`
**Campaigns**: Vercel cron jobs (see INFRASTRUCTURE.md for EventBridge future)

### 5. UI Components
**Location**: `packages/ui/src/`
**Framework**: Tamagui
**Pattern**: Cross-platform (web + mobile)
**Testing**: `/brand/*` routes for component development

### 6. Feature Flags
**Location**: `packages/app/features/feature-flags/`
**Purpose**: Production-safe feature rollout
**Never**: Environment-based flags

---

## DynamoDB Data Contracts

> **Rule**: If it's not documented here, it doesn't exist in the database

### Key Naming Conventions
- **Legacy tables**: Use `pkey/skey` attribute names
- **New standard**: Use `PK/SK` following AWS best practices
- **Do not change existing tables**; maintain backward compatibility

### Table: `tee-admin`

#### Entity: User
```typescript
PK: `USER#${email}`
SK: `PROFILE`

{
  PK: string,           // USER#user@example.com
  SK: string,           // PROFILE
  email: string,
  name: string,
  role: 'owner' | 'admin' | 'member' | 'guest',
  createdAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp
  lastLogin?: string,
  emailVerified?: boolean,
  image?: string,
}

// Access: adminRepo.getUserByEmail(email)
```

#### Entity: Invitation
```typescript
PK: `INVITATION#${code}`
SK: `METADATA`

{
  PK: string,           // INVITATION#ABC12345
  SK: string,           // METADATA
  code: string,         // 8 characters
  email: string,
  role: 'admin' | 'member' | 'guest',
  createdBy: string,
  createdAt: string,    // ISO timestamp
  expiresAt: string,    // 7 days
  used: boolean,
  usedBy?: string,
  usedAt?: string,
}

// Access: adminRepo.getInvitationByCode(code)
```

### Table: `tee-schedules`

#### Entity: Schedule Record
```typescript
PK: `SCHEDULE#${sheetType.toUpperCase()}`
SK: `${date}#${id}`

// Valid sheetTypes: SUNDAYSCHOOL | MEMORIAL | CALENDAR | DIRECTORY

{
  PK: string,           // SCHEDULE#SUNDAYSCHOOL
  SK: string,           // 2025-01-15#uuid
  id: string,
  date: string,         // YYYY-MM-DD
  sheetId: string,
  sheetType: string,

  // Type-specific fields vary by schedule type
  createdAt: string,
  updatedAt: string,
  syncedAt?: string,
}

// Access: scheduleRepo.getSchedulesByType(sheetType)
```

### Table: `tee-sync-status`

#### Entity: Sync Status
```typescript
PK: `SYNC#${sheetId}`
SK: `STATUS`

{
  PK: string,
  SK: string,
  sheetId: string,
  sheetType: string,
  lastSyncedAt: string,
  lastVersion: string,
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  recordCount?: number,
  errors?: string[],
  executionTime?: number,
}

// Access: syncRepo.getSyncStatus(sheetId)
```

---

## Integration Patterns

### Webhook → Database Flow
```typescript
POST /api/sheets/webhook
  → WebhookSyncService.handleWebhook()
    → SheetTransformer.transform*Data()
      → scheduleRepo.replaceSheetSchedules()
        → DynamoDB
```

### Auth → Role Checks
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
const session = await getServerSession(authOptions)
```

---

## Anti-Patterns (Never Do)

1. **Never** create staging/dev environment splits
2. **Never** put config values in .env (only secrets)
3. **Never** make direct DynamoDB calls outside repositories
4. **Never** assume library availability without checking package.json
5. **Never** deploy via git push (use `vercel deploy`)
6. **Never** create new key patterns without documenting here
7. **Never** bypass repository pattern for data access
8. **Never** import Next.js modules in `packages/app/` or `packages/ui/`

---

## Quick Reference

| Operation | Method |
|-----------|--------|
| Find schedule data | `scheduleRepo.getSchedulesByType()` |
| Find user data | `adminRepo.getUserByEmail()` |
| Update sync status | `syncRepo.updateSyncStatus()` |
| Check feature flag | `checkFeatureFlag('flag-name', session)` |
| Invalidate cache | `revalidateScheduleCache()` |

---

*Consolidated from AI_ARCHITECTURE.md and AI_DYNAMODB_CONTRACTS.md*
