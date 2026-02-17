# Search Improvements: Proper SES ↔ DynamoDB Linking

## Problem Identified

When searching for contacts, the system was showing **duplicate/overlapping records** that appeared to be the same person but weren't linked properly.

### Root Cause

The original search implementation used **only email string matching** to link SES contacts to directory records. This caused:

❌ **Case sensitivity issues**: `john@email.com` vs `John@Email.com`
❌ **Whitespace differences**: `john@email.com ` (trailing space)
❌ **Ignored proper links**: SES `AttributesData.dynamodbSK` was not checked
❌ **Stale links invisible**: SES contacts with invalid `dynamodbSK` appeared as separate people

## Solution Implemented

### Two-Tier Matching System

#### 1️⃣ **Primary Method: Use `dynamodbSK` Link (Authoritative)**

```typescript
// Check if SES contact has dynamodbSK in AttributesData
if (attributes?.dynamodbSK) {
  const linkedBaseSkey = attributes.dynamodbSK.split('#EMAIL')[0]
  const linkedPerson = personsMap.get(linkedBaseSkey)

  if (linkedPerson) {
    // Link to this specific directory record
    // Even if email addresses don't match perfectly
  }
}
```

**Benefits:**
- ✅ Respects established directory-email-sync links
- ✅ Works even if emails don't match (user changed email in one system)
- ✅ Detects stale links (when directory record was deleted)

#### 2️⃣ **Fallback Method: Exact Email Match**

```typescript
// If no dynamodbSK, fall back to email string matching
if (!foundInDirectory) {
  for (const person of personsMap.values()) {
    const emailInPerson = person.emails.find(e => e.email === email)
    if (emailInPerson) {
      // Matched by email
    }
  }
}
```

**Benefits:**
- ✅ Catches contacts not yet properly linked
- ✅ Works for new contacts before sync runs
- ✅ Case-insensitive matching

### Stale Link Detection

**New Warning Badge**: 🔴 **"Stale Link (was: MEMBER#123)"**

Shows when:
- SES contact has `dynamodbSK` in AttributesData
- BUT that directory record no longer exists in DynamoDB
- Indicates the directory record was deleted but SES wasn't updated

**Example Scenario:**
```
SES Contact: john@example.com
  AttributesData: { "dynamodbSK": "MEMBER#999" }

DynamoDB Query: MEMBER#999 → NOT FOUND ❌

Result: Shows as "SES-only" contact with stale link warning
```

## What You'll See Now

### Before Fix (Duplicates)
```
Search Results for "John Doe":

1. 👤 John Doe (MEMBER#123)
   📧 john@example.com
   ✅ In Directory | ❌ Not in SES

2. 👤 John Doe (SES#John@Example.com)
   📧 John@Example.com
   ❌ Not in Directory | ✅ In SES
   Lists: Newsletter ✓, Memorial ✓
```

### After Fix (Properly Linked)
```
Search Results for "John Doe":

1. 👤 John Doe (MEMBER#123)
   📧 john@example.com (PRIMARY)
   ✅ In Directory | ✅ In SES
   Lists: Newsletter ✓, Memorial ✓
```

### Stale Link Example
```
Search Results for "Jane Smith":

1. 👤 Jane Smith (SES#jane@test.com)
   🔴 Stale Link (was: MEMBER#456)
   📧 jane@test.com
   ❌ Not in Directory | ✅ In SES
   Lists: Newsletter ✓

   → Action needed: Re-create directory record or update SES
```

## How to Fix Stale Links

When you see a **"Stale Link"** warning:

### Option 1: Re-create Directory Record
If the person should still be in the directory:

1. Create new directory record with correct info
2. Run **Sync Members List** to update SES with new `dynamodbSK`
3. Old stale link will be overwritten

### Option 2: Update SES Manually
If the directory record was intentionally deleted:

1. Use **"Update Contact"** in SES
2. Remove the `dynamodbSK` from AttributesData
3. Contact will stay in SES as "SES-only"

### Option 3: Merge with Existing Person
If this is a duplicate:

1. Use **"Merge with Another Contact"** button
2. Select the correct directory person
3. System will update SES with correct link

## Technical Details

### SES AttributesData Structure

**Properly Linked Contact:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John Doe",
  "dynamodbSK": "MEMBER#123",
  "ecclesia": "TEE",
  "isMember": true
}
```

**SES-Only Contact (No Link):**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "displayName": "Jane Smith",
  "isMember": false
}
```

**Stale Link (Directory Record Deleted):**
```json
{
  "firstName": "Bob",
  "lastName": "Jones",
  "displayName": "Bob Jones",
  "dynamodbSK": "MEMBER#999",  // ← This record doesn't exist anymore
  "ecclesia": "Former",
  "isMember": false
}
```

## Benefits of This Fix

### For Admins
✅ **Clearer search results** - No more confusing duplicates
✅ **Visible sync status** - Know exactly what's linked where
✅ **Stale link alerts** - Proactively fix orphaned records
✅ **Better data quality** - Trust the links are correct

### For System
✅ **Respects existing links** - Uses `dynamodbSK` as source of truth
✅ **Graceful degradation** - Falls back to email matching
✅ **Audit trail ready** - Logs when stale links are found
✅ **Event-sync ready** - Foundation for Phase 4 automation

## Example Search Scenarios

### Scenario 1: Perfectly Synced Contact
```
DynamoDB: MEMBER#100
  firstName: "Alice"
  lastName: "Wilson"
  email: "alice@example.com"
  ecclesia: "TEE"

SES: alice@example.com
  AttributesData: { "dynamodbSK": "MEMBER#100", "isMember": true }
  Lists: Newsletter ✓, Members ✓

Search Result:
  👤 Alice Wilson (MEMBER#100)
  📧 alice@example.com (PRIMARY)
  ✅ In Directory | ✅ In SES
  🟢 Member
  Lists: Newsletter ✓, Members ✓
```

### Scenario 2: Email Changed in Directory
```
DynamoDB: MEMBER#200
  firstName: "Bob"
  lastName: "Smith"
  email: "bob.new@example.com"  ← Changed email
  ecclesia: "TEE"

SES: bob.old@example.com
  AttributesData: { "dynamodbSK": "MEMBER#200", "isMember": true }
  Lists: Newsletter ✓

Search Result:
  👤 Bob Smith (MEMBER#200)
  📧 bob.new@example.com (PRIMARY) ✅ In Directory | ❌ Not in SES
  📧 bob.old@example.com           ❌ Not in Directory | ✅ In SES
  Lists: Newsletter ✓

  → Action: Use "Migrate Email" to copy subscriptions to new address
```

### Scenario 3: Stale Link (Deleted Member)
```
DynamoDB: MEMBER#300 → NOT FOUND ❌

SES: charlie@example.com
  AttributesData: { "dynamodbSK": "MEMBER#300", "isMember": false }
  Lists: Newsletter ✓

Search Result:
  👤 Charlie Brown (SES#charlie@example.com)
  🔴 Stale Link (was: MEMBER#300)
  📧 charlie@example.com
  ❌ Not in Directory | ✅ In SES
  Lists: Newsletter ✓

  → Action: Either re-create directory record or remove from SES
```

## Next Steps

With proper linking in place, the system is now ready for:

1. **Phase 2**: Build dialogs to fix stale links (Merge, Migrate, Add Email)
2. **Phase 4**: Event-driven sync to prevent stale links automatically
3. **Reconciliation**: Daily job to detect and alert on sync drift

## Testing Checklist

Test these scenarios after deploying:

- [ ] Search for contact in both systems → Shows as single person
- [ ] Search for contact with different case emails → Properly linked
- [ ] Search for contact with stale link → Shows warning badge
- [ ] Search for SES-only contact → Shows as separate, no directory data
- [ ] Search for directory-only contact → Shows as separate, no SES lists
- [ ] Search for person with 2 emails → Both emails grouped under one person
