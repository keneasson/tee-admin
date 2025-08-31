# DynamoDB Configuration Documentation

## Overview

TEE Admin uses AWS DynamoDB as its primary database for user authentication, schedule data, and sync status tracking. This document outlines the complete DynamoDB configuration, table structure, and environment setup.

## Table Structure

The application uses **three main DynamoDB tables**:

### 1. `tee-admin`
- **Purpose**: User authentication, sessions, and user data
- **Primary Key**: `pkey` (Partition Key), `skey` (Sort Key)
- **GSI**: `gsi1` with `gsi1pk` and `gsi1sk`
- **Used by**: NextAuth.js authentication system
- **Status**: Existing production table

### 2. `tee-schedules`
- **Purpose**: Schedule and event data from Google Sheets
- **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)
- **GSI1**: Ecclesia + Date Range access pattern
- **GSI2**: Type + Date Range OR Date + Type access pattern
- **Status**: Required for schedule functionality

### 3. `tee-sync-status`
- **Purpose**: Tracking sync status between Google Sheets and DynamoDB
- **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)
- **Status**: Helper table for monitoring sync health

## Configuration Location

All DynamoDB configuration is centralized in:
```
packages/app/provider/dynamodb/
├── config.ts           # Connection and table name configuration
├── schedule-service.ts  # Schedule data operations
├── table-definitions.ts # Table schemas and creation scripts
└── types.ts            # TypeScript type definitions
```

## Environment Variables

### Required AWS Credentials
```bash
AWS_REGION=ca-central-1              # AWS region (Canada Central)
AWS_ACCESS_KEY_ID=your_key_here      # AWS IAM access key
AWS_SECRET_ACCESS_KEY=your_secret    # AWS IAM secret key
```

### Single Production Database
**Important**: This application uses a single production database for all environments. No stage prefixes are used.
- Local development connects directly to production DynamoDB
- Preview/staging deployments use the same production tables
- This provides unified login and real data visibility for debugging

## Setting Up DynamoDB

### 1. Local Development

Local development connects to the **production DynamoDB** (single database strategy). Ensure you have:

1. AWS credentials configured in `.env`
2. Proper IAM permissions for DynamoDB access

### 2. Production/Vercel Deployment

For Vercel deployments, add the following environment variables in Vercel Dashboard:

```bash
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

### 3. Creating Tables

Tables can be created using the helper functions:

```typescript
// From packages/app/provider/dynamodb/table-definitions.ts
import { createAllTables } from '@my/app/provider/dynamodb/table-definitions'

// Creates all required tables
await createAllTables()
```

## IAM Permissions Required

The AWS IAM user/role needs the following DynamoDB permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ca-central-1:*:table/tee-admin",
        "arn:aws:dynamodb:ca-central-1:*:table/tee-admin/index/*",
        "arn:aws:dynamodb:ca-central-1:*:table/tee-schedules",
        "arn:aws:dynamodb:ca-central-1:*:table/tee-schedules/index/*",
        "arn:aws:dynamodb:ca-central-1:*:table/tee-sync-status",
        "arn:aws:dynamodb:ca-central-1:*:table/tee-sync-status/index/*"
      ]
    }
  ]
}
```

## Common Issues and Solutions

### Issue: "ResourceNotFoundException" 
**Solution**: Tables don't exist. Run `createAllTables()` to create them.

### Issue: "AccessDeniedException"
**Solution**: Check AWS credentials and IAM permissions.

### Issue: Preview/Production deployment shows no data
**Solution**: 
1. Verify AWS environment variables are set in Vercel
2. Check that tables exist: `tee-admin`, `tee-schedules`, `tee-sync-status`
3. Ensure data has been synced from Google Sheets

## Migration from Google Sheets

The system is designed to:
1. Read from Google Sheets via service account
2. Sync data to DynamoDB tables
3. Use DynamoDB as primary data source
4. No fallback to Google Sheets (as of recent updates)

## Monitoring and Debugging

### Check Table Status
```bash
# List all tables
aws dynamodb list-tables --region ca-central-1

# Describe specific table
aws dynamodb describe-table --table-name tee-admin --region ca-central-1
```

### View Sync Status
Visit `/admin/data-sync` in the application to monitor:
- Last sync timestamps
- Record counts
- Sync errors
- Webhook status

## Best Practices

1. **Never hardcode table names** - Always use `tableNames` from config.ts
2. **Single production database** - All environments use the same tables
3. **Monitor sync status** - Regular checks via admin panel
4. **Secure credentials** - Never commit AWS credentials to git
5. **Use IAM roles** in production rather than access keys when possible
6. **Test carefully** - Working with production data requires extra care

## Related Documentation

- [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)
- [Google Sheets Integration](./GOOGLE_SHEETS_INTEGRATION.md)
- [Authentication Setup](./AUTHENTICATION.md)