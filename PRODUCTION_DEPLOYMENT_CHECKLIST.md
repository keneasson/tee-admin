# Production Deployment Checklist

## ✅ Pre-Deployment Verification

### DynamoDB Tables Migration (COMPLETED)
- [x] Migrated `dev-tee-schedules` → `tee-schedules` (398 items)
- [x] Migrated `dev-tee-sync-status` → `tee-sync-status` (3 items)
- [x] Using existing `tee-admin` table (no migration needed)
- [x] Deleted old tables with stage prefixes

### Code Changes (COMPLETED)
- [x] Removed `STAGE` environment variable usage
- [x] Updated table configuration to use clean names
- [x] Removed Google Sheets fallback logic
- [x] Fixed date formatting in newsletter API
- [x] Updated webhook status endpoint
- [x] All repositories use centralized table configuration

### Local Testing (COMPLETED)
- [x] Schedule pages loading from DynamoDB
- [x] Newsletter showing formatted dates
- [x] Authentication working with `tee-admin` table
- [x] Webhook endpoints functional
- [x] All APIs returning data successfully

## 📋 Deployment Steps

### 1. Verify Vercel Environment Variables
Ensure these existing variables are set in Vercel:
```
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=<existing>
AWS_SECRET_ACCESS_KEY=<existing>
WEBHOOK_SECRET=8e1008de928c5ebc36d5d234d3344e39840795d6456dd59a254e58b2d9e20220
```

**Important**: The `WEBHOOK_SECRET` must match the value in your Google Apps Scripts!
**Security**: This secret was generated using `openssl rand -hex 32` for cryptographic security.

**Note**: Do NOT add `STAGE` variable - it's no longer used!

### 2. Deploy to Vercel
```bash
git add .
git commit -m "Remove DynamoDB stage prefixes and simplify configuration"
git push origin main
```

Or for preview deployment:
```bash
vercel deploy
```

### 3. Verify Production Deployment
After deployment, check:
- [ ] `/schedule` - Schedule data loads correctly
- [ ] `/newsletter` - Newsletter shows proper date formatting  
- [ ] `/admin/data-sync` - Shows sync status (requires admin login)
- [ ] Authentication - Login/logout works
- [ ] API endpoints - Return data from correct tables

**Production Monitoring URLs:**
- **Admin Panel**: https://www.tee-admin.com/admin/data-sync (requires login)
- **Public APIs**: 
  - https://www.tee-admin.com/api/upcoming-program
  - https://www.tee-admin.com/api/enhanced-schedule?type=memorial
- **Webhook Status**: https://www.tee-admin.com/api/sheets/webhook/status (requires admin login)

### 4. Update Google Sheets Webhooks
For each production Google Sheet:
1. Open Extensions → Apps Script
2. Update webhook URL to production:
   ```javascript
   const WEBHOOK_URL = 'https://www.tee-admin.com/api/sheets/webhook'
   ```
3. Save and run `setupWebhook()`

## 🎯 What Changed

### Simplified Configuration
- **Before**: Tables with stage prefixes (`dev-tee-admin`, `dev-tee-schedules`)
- **After**: Clean table names (`tee-admin`, `tee-schedules`, `tee-sync-status`)

### Single Production Database
- **Before**: Stage-based table isolation
- **After**: All environments use production DynamoDB

### No Fallback Strategy
- **Before**: Fallback to Google Sheets if DynamoDB data was stale
- **After**: Direct DynamoDB access only (webhook keeps it fresh)

### Environment Variables
- **Removed**: `STAGE` variable no longer needed
- **Unchanged**: AWS credentials remain the same

## ⚠️ Important Notes

1. **No new environment variables needed** - Uses existing AWS configuration
2. **Tables already migrated** - Data is live in new tables
3. **Backwards compatible** - All APIs maintain same structure
4. **Single database strategy** - Be careful with test data in production

## 🚀 Rollback Plan

If issues arise:
1. Revert the git commit
2. Recreate old tables from backup if needed
3. Update table names back in `config.ts`
4. Redeploy previous version

## ✅ Post-Deployment Verification

- [ ] All pages load without errors
- [ ] Data displays correctly from DynamoDB
- [ ] Webhook syncs working (test with sheet edit)
- [ ] Authentication functional
- [ ] No console errors in browser
- [ ] API responses include correct data

## 📊 Success Metrics

- Simplified deployment (no stage management)
- Unified data visibility across environments
- Cleaner configuration without stage prefixes
- Direct production database access for debugging
- Reduced complexity in table management

---

**Status**: Ready for Production Deployment ✅