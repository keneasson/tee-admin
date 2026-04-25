# Plan: Unified Member System Refactor

## Problem Statement

The TEE Admin member/user/people system has **5 overlapping identity systems** causing:
- **7+ full table scans** including Google Auth (HUGE red flag)
- Data inconsistencies between systems
- Inter-ecclesia contacts stored in completely different stores
- No unified source of truth for member identity

## Goal

Establish `PersonRecord` (UUID-based) as the **single canonical source of truth** for all member identity, eliminating scans and enabling multi-tenant architecture.

---

## Current State: The Mess

### 5 Overlapping Identity Systems

| System | Key Pattern | Identity | Purpose |
|--------|-------------|----------|---------|
| USER# Records | `pkey: USER#{userId}` | UUID | NextAuth (Google OAuth) |
| CredentialsUser | `pkey: USER#{userId}`, `gsi1pk: USER#{email}` | Email+UUID | Email/password auth |
| DirectoryRecord | `PK: USER#{email}`, `SK: DIRECTORY#{sheetId}` | Email | Google Sheets sync |
| PersonRecord | `pkey: PERSON#{personId}` | UUID | New unified system (exists!) |
| SES Contacts | AWS SES ContactList | Email | Email subscriptions |

### Critical Full Table Scans

| File | Line | Impact |
|------|------|--------|
| `apps/next/utils/dynamodb/get-user.ts` | 37 | **HIGH** - Every Google sign-in |
| `apps/next/utils/dynamodb/credentials-users.ts` | 145 | **HIGH** - Every registration check |
| `packages/app/provider/dynamodb/repositories/user-repository.ts` | 226 | MEDIUM - Email verification |
| `apps/next/utils/dynamodb/locations.ts` | 202, 256, 345 | LOW - Ecclesia lookups |

### Key Naming Inconsistency

- **Lowercase** (`pkey/skey`): PersonRecord, CredentialsUser
- **UPPERCASE** (`PK/SK`): DirectoryRecord, AddressRecord

---

## Target Architecture

### PersonRecord as Canonical Identity

```
PERSON#{personId}:PROFILE          → PersonRecord (core identity)
PERSON#{personId}:EMAIL#{emailId}  → PersonEmailRecord (multiple emails)
PERSON#{personId}:ADDRESS#{id}     → PersonAddressRecord
PERSON#{personId}:PHONE#{id}       → PersonPhoneRecord
PERSON#{personId}:TOKEN#{type}     → TokenRecord (verification/reset)
```

### GSI Structure (Already Exists - Just Need to Use)

| GSI | Pattern | Purpose |
|-----|---------|---------|
| GSI1 | `EMAIL#{email}` | O(1) email lookup (replaces scans!) |
| GSI2 | `ECCLESIA#{ecclesia}` | Directory browsing by ecclesia |
| GSI3 | `NAME#{lastName}` | Name search |
| GSI4 (NEW) | `TOKEN#{value}` | Token verification (replaces scan) |

### Member Model Requirements

- **Single Ecclesia**: Each member belongs to exactly one ecclesia
- **Member Status**: `'member' | 'visitor' | 'friend' | 'former'`
- **Multiple Emails**: PersonEmailRecord supports this (one primary, synced to SES)
- **Hyphenated Names**: Supported (no regex validation blocking this)
- **Family Relationships**: RelationshipRecord exists (spouse, parent, child, etc.)
- **Multi-Tenant Ready**: GSI2 partitions on `ECCLESIA#{ecclesia}`

### Friends vs Members Lists (Subscription-Based Model)

- **Members List**: PersonRecords where `ecclesia = 'Toronto East'` AND `memberStatus = 'member'`
  - For voting, member-only content, business meetings
- **Newsletter List**:
  - All Toronto East members (`ecclesia = 'Toronto East'`)
  - PLUS external subscribers via SES topic subscription (`newsletter` topic)
  - Friends keep their OWN ecclesia (e.g., `ecclesia = 'Peterborough'`) and subscribe to TEE newsletter
  - This is managed via PersonEmailRecord.sesTopicPreferences, NOT memberStatus

---

## Implementation Phases

### Phase 1: Create GSI4 for Token Lookups (Infrastructure)
**Priority**: HIGH | **Risk**: LOW | **Estimate**: 1 day

Create GSI4 on `tee-admin` table for O(1) token lookups.

```bash
aws dynamodb update-table \
  --table-name tee-admin \
  --attribute-definitions AttributeName=gsi4pk,AttributeType=S AttributeName=gsi4sk,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"gsi4\",\"KeySchema\":[{\"AttributeName\":\"gsi4pk\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"gsi4sk\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]"
```

---

### Phase 2: TokenRepository with GSI4 (Eliminate First Scan)
**Priority**: HIGH | **Blocked by**: Phase 1 | **Estimate**: 2 days

**Files to create/modify**:
- `packages/app/provider/dynamodb/repositories/token-repository.ts` (NEW)
- `packages/app/provider/dynamodb/types.ts` (add TokenRecord)

**Changes**:
```typescript
interface TokenRecord {
  pkey: string           // PERSON#{personId}
  skey: string           // TOKEN#{tokenType}#{tokenId}
  gsi4pk: string         // TOKEN#{tokenValue}
  gsi4sk: string         // {expiresAt}#{tokenType}
  tokenValue: string
  tokenType: 'email_verification' | 'password_reset' | 'invitation'
  email: string
  expiresAt: string
}
```

---

### Phase 3: Enhance PersonRepository for Auth (Core Change)
**Priority**: HIGH | **Estimate**: 3 days

**Files to modify**:
- `packages/app/provider/dynamodb/repositories/person-repository.ts`

**New methods**:
```typescript
// Auth integration
getByEmail(email: string): Promise<PersonRecord | null>  // Uses GSI1
createFromOAuth(googleProfile: GoogleProfile): Promise<PersonRecord>
createFromCredentials(registration: RegistrationData): Promise<PersonRecord>
linkLegacyUser(personId: string, userId: string): Promise<void>

// Add hashedPassword to PersonRecord for credentials users
updatePassword(personId: string, hashedPassword: string): Promise<void>
```

---

### Phase 4: Migrate Auth Callbacks (Eliminate Main Scans)
**Priority**: HIGH | **Blocked by**: Phase 3 | **Estimate**: 3 days

**Files to modify**:
- `apps/next/utils/auth.ts` - NextAuth callbacks
- `apps/next/utils/dynamodb/get-user.ts` - Mark deprecated

**Before** (`get-user.ts:37`):
```typescript
const scanCommand = new ScanCommand(params)  // FULL TABLE SCAN!
```

**After**:
```typescript
const person = await personRepository.getByEmail(email)  // GSI1 Query - O(1)
```

**Feature flag**: `UNIFIED_PEOPLE_READ=true` for gradual rollout

---

### Phase 5: Data Migration Script
**Priority**: HIGH | **Blocked by**: Phase 3 | **Estimate**: 3 days

**Files to modify**:
- `scripts/migrate-to-unified-people.ts` (update existing)
- `scripts/validate-person-migration.ts` (NEW)

**Migration logic**:
1. Scan all USER# records
2. For each, create/update PersonRecord with:
   - Same email as primaryEmail
   - Extract firstName/lastName from name or profile
   - Preserve role
   - Set `userId` to link back
3. Validate: count match, spot-check data

**Dry-run mode required** - no writes until verified.

---

### Phase 6: Unify Inter-Ecclesia Contacts
**Priority**: MEDIUM | **Blocked by**: Phase 3 | **Estimate**: 4 days

**Problem**: Inter-ecclesia contacts stored in BOTH PersonRecord AND SES ContactList

**Solution**: PersonRecord is source of truth, one-way sync to SES

**Files to modify**:
- `apps/next/app/api/admin/email/import-inter-ecclesia/route.ts` - Write only to PersonRecord
- Create `apps/next/app/api/cron/sync-ses-contacts/route.ts` - Scheduled sync

---

### Phase 7: Cleanup Legacy Code
**Priority**: LOW | **Blocked by**: Phases 4, 5 | **Estimate**: 2 days

**Files to modify**:
- `apps/next/utils/dynamodb/get-user.ts` - Delete or mark deprecated
- `apps/next/utils/dynamodb/credentials-users.ts` - Remove legacy patterns

**Do NOT delete** legacy USER# records - archive for audit trail.

---

### Phase 8: Comprehensive Test Suite
**Priority**: MEDIUM | **Parallel with all phases** | **Estimate**: 4 days

**Test files to create**:
```
packages/app/provider/dynamodb/repositories/__tests__/
  person-repository.test.ts      (>90% coverage)
  token-repository.test.ts       (>90% coverage)

apps/next/tests/auth/
  unified-people-auth.test.ts    (integration)

apps/next/tests/db/
  person-migration.test.ts       (migration validation)
```

---

## Key Files Summary

| File | Change |
|------|--------|
| `packages/app/provider/dynamodb/types.ts` | Add TokenRecord, enhance PersonRecord |
| `packages/app/provider/dynamodb/repositories/person-repository.ts` | Add auth methods |
| `packages/app/provider/dynamodb/repositories/token-repository.ts` | NEW - GSI4 queries |
| `apps/next/utils/auth.ts` | Use PersonRecord for auth |
| `apps/next/utils/dynamodb/get-user.ts` | DEPRECATE - scan-based |
| `scripts/migrate-to-unified-people.ts` | Update migration |
| `scripts/validate-person-migration.ts` | NEW - validation |

---

## Verification Plan

1. **Unit tests**: PersonRepository and TokenRepository >90% coverage
2. **Integration tests**: Full auth flows (Google OAuth, Credentials)
3. **Migration validation**: 100% of users have PersonRecords
4. **Performance test**: Email lookup < 50ms (vs ~500ms scan)
5. **E2E regression**: All existing auth tests pass

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Auth outage during switch | Feature flag, instant rollback |
| Data loss during migration | Dry-run mode, no deletes, rollback script |
| Legacy code still scans | Console warnings, code review gates |

---

## GitHub Issues (To Create)

1. **Create GSI4 for Token Lookups** - Infrastructure, 1 day
2. **Implement TokenRepository with GSI4** - Feature, 2 days
3. **Enhance PersonRepository for Auth** - Feature, 3 days
4. **Migrate Auth Callbacks to PersonRecord** - Refactor, 3 days
5. **Data Migration: Users to PersonRecords** - Migration, 3 days
6. **Unify Inter-Ecclesia Contact Management** - Feature, 4 days
7. **Cleanup Legacy Auth Code** - Tech debt, 2 days
8. **Comprehensive Test Suite** - Testing, 4 days
9. **Multi-Tenant Foundation (Documentation)** - Architecture, 2 days

**Total estimate**: ~24 days of work

---

## Success Metrics

- [ ] 0 full table scans in production auth flows
- [ ] Email lookup latency < 50ms
- [ ] 100% of users have PersonRecords
- [ ] >90% test coverage on new repositories
- [ ] 0 divergence between PersonRecord and SES for inter-ecclesia
