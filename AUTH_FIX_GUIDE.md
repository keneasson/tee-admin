# Authentication Fix Guide

## What we've fixed in the code:
✅ Added configurable owner emails (environment variable support)  
✅ Fixed credentials auth to prevent duplicate accounts  
✅ Improved DynamoDB integration timing  
✅ **Email Tester now available to both Admin AND Owner roles**  
✅ Added comprehensive tests  
✅ **Secured all files - no hardcoded secrets**

## What you need to do manually:

### 1. Run the working tests from project root:
```bash
yarn test:auth
```

### 2. Start the dev server:
```bash
yarn web
```

### 3. In a new terminal, fix your DynamoDB role:
```bash
# Test current role assignment
curl "http://localhost:3001/api/debug/check-role?email=ken.easson@gmail.com"

# Fix the role to owner
curl -X POST "http://localhost:3001/api/debug/fix-role" \
  -H "Content-Type: application/json" \
  -d '{"email": "ken.easson@gmail.com", "newRole": "owner"}'

# Verify the fix
curl "http://localhost:3001/api/debug/check-db" | grep -A5 -B5 "ken.easson@gmail.com"
```

### 4. Test the authentication flows:

**A. Google OAuth Test:**
- Sign in with Google using ken.easson@gmail.com
- You should now get "owner" role instead of "guest"

**B. Credentials Account Test:**
- Try to create a new account with ken.easson@gmail.com
- Should show error: "User with this email already exists. Please sign in with your existing account"

**C. Email Tester Access Test:**
- Sign in with your owner account
- You should now see "Email Tester" in the navigation menu
- Click it and verify you can access the Email Tester page

### 5. Run E2E tests (optional):
```bash
yarn test:e2e
```

## Key Changes Made:

1. **Role Assignment Fix:**
   - `packages/app/provider/auth/get-user-from-legacy.ts:27` - Added your email to owner list

2. **Account Linking Prevention:**
   - `apps/next/utils/dynamodb/credentials-users.ts:66` - Added `findAnyUserByEmail()` check
   - Now prevents creating duplicate accounts across providers

3. **DynamoDB Integration:**
   - `apps/next/utils/auth.ts:117` - Check DynamoDB first, then legacy fallback
   - `apps/next/utils/dynamodb/get-user.ts` - New function for user lookup

4. **Email Tester Permissions:**
   - `packages/app/features/with-navigation.tsx:133` - Show Email Tester for Admin AND Owner
   - `packages/app/features/email-tester/index.tsx:59` - Added role check in page component

5. **Test Coverage:**
   - Unit tests for role assignment logic
   - E2E tests for auth flows
   - DynamoDB integration tests

## Expected Results:
- ✅ Ken gets "owner" role from any provider
- ✅ No duplicate accounts can be created
- ✅ Legacy directory lookup works correctly
- ✅ **Email Tester accessible to Owner role**
- ✅ Tests pass and verify functionality

## Environment Variables (Optional):
You can now configure owner emails via environment variables:
```bash
# In your .env file or environment
OWNER_EMAILS=ken.easson@gmail.com,another.owner@example.com
TARGET_EMAIL=ken.easson@gmail.com  # For debug scripts
```

## Troubleshooting:
If the API calls fail, make sure:
- Dev server is running on port 3001
- AWS credentials are configured  
- DynamoDB table 'tee-admin' is accessible
- Check `.env.example` for required environment variables