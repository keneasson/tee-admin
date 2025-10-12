# AWS EventBridge Scheduler Setup

> **⚠️ FUTURE IMPLEMENTATION**: This document describes an advanced email scheduling system that is **not currently in use**. The current system uses a simple Vercel cron job (Thursday 9:30pm test email). This EventBridge setup is documented for future scalability needs.

## Overview

This guide explains how to implement an advanced email scheduling system using AWS EventBridge Scheduler and DynamoDB queues.

**Why EventBridge?**
- Vercel Free tier: 1 daily cron job maximum
- EventBridge Free tier: 14 million invocations/month
- Already using AWS (DynamoDB, SES)
- More flexible scheduling options
- Better for production workloads

## Current Architecture

### Vercel Cron (Legacy - Being Phased Out)
```json
{
  "crons": [
    {
      "path": "/api/email/bible-class",
      "schedule": "0 17 * * 3"  // Wednesday 5pm
    },
    {
      "path": "/api/email/recap",
      "schedule": "0 18 * * 6"  // Saturday 6pm
    }
  ]
}
```

### EventBridge Scheduler (New System)
- **Target**: `https://yourdomain.vercel.app/api/cron/email-queue`
- **Frequency**: Every 15 minutes (or custom schedule)
- **Authentication**: Bearer token via `EMAIL_SENDER_SECRET` environment variable
- **Responsibility**: Checks scheduled emails, sends ready ones, retries failures

## Prerequisites

1. **AWS CLI** installed and configured
2. **AWS Account** with appropriate permissions (EventBridge, IAM)
3. **Production domain** deployed on Vercel
4. **EMAIL_SENDER_SECRET** environment variable set in Vercel

## Step 1: Set Environment Variables

Ensure `EMAIL_SENDER_SECRET` is set in your Vercel deployment:

```bash
# Generate a secure random secret (if not already done)
openssl rand -base64 32

# Add to Vercel (replace with your generated secret)
vercel env add EMAIL_SENDER_SECRET
# Select: Production
# Paste the secret when prompted
```

## Step 2: Create IAM Role for EventBridge

EventBridge needs permission to invoke HTTP endpoints:

```bash
# Create trust policy file
cat > eventbridge-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "scheduler.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the IAM role
aws iam create-role \
  --role-name EventBridgeSchedulerHttpRole \
  --assume-role-policy-document file://eventbridge-trust-policy.json

# Attach policy for HTTP invocation
aws iam attach-role-policy \
  --role-name EventBridgeSchedulerHttpRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEventBridgeSchedulerFullAccess

# Get the role ARN (save this for next step)
aws iam get-role --role-name EventBridgeSchedulerHttpRole --query 'Role.Arn' --output text
```

Save the ARN output - you'll need it in the next step.

## Step 3: Create EventBridge Schedule

Replace the placeholders:
- `YOUR_DOMAIN` - Your production Vercel domain
- `YOUR_EMAIL_SENDER_SECRET` - The secret from Step 1
- `YOUR_ROLE_ARN` - The ARN from Step 2

```bash
# Option A: Every 15 minutes (recommended for queue processing)
aws scheduler create-schedule \
  --name tee-email-queue-processor \
  --schedule-expression "rate(15 minutes)" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:http:invoke",
    "RoleArn": "YOUR_ROLE_ARN",
    "Input": "{
      \"Method\": \"GET\",
      \"Url\": \"https://YOUR_DOMAIN.vercel.app/api/cron/email-queue\",
      \"Headers\": {
        \"Authorization\": [\"Bearer YOUR_EMAIL_SENDER_SECRET\"]
      }
    }",
    "RetryPolicy": {
      "MaximumRetryAttempts": 2,
      "MaximumEventAge": 3600
    }
  }' \
  --flexible-time-window '{"Mode": "OFF"}'

# Option B: Every 10 minutes (for more responsive processing)
aws scheduler create-schedule \
  --name tee-email-queue-processor \
  --schedule-expression "rate(10 minutes)" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:http:invoke",
    "RoleArn": "YOUR_ROLE_ARN",
    "Input": "{
      \"Method\": \"GET\",
      \"Url\": \"https://YOUR_DOMAIN.vercel.app/api/cron/email-queue\",
      \"Headers\": {
        \"Authorization\": [\"Bearer YOUR_EMAIL_SENDER_SECRET\"]
      }
    }",
    "RetryPolicy": {
      "MaximumRetryAttempts": 2,
      "MaximumEventAge": 3600
    }
  }' \
  --flexible-time-window '{"Mode": "OFF"}'

# Option C: Cron expression (e.g., every hour at minute 0)
aws scheduler create-schedule \
  --name tee-email-queue-processor \
  --schedule-expression "cron(0 * * * ? *)" \
  --schedule-expression-timezone "America/Toronto" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:http:invoke",
    "RoleArn": "YOUR_ROLE_ARN",
    "Input": "{
      \"Method\": \"GET\",
      \"Url\": \"https://YOUR_DOMAIN.vercel.app/api/cron/email-queue\",
      \"Headers\": {
        \"Authorization\": [\"Bearer YOUR_EMAIL_SENDER_SECRET\"]
      }
    }",
    "RetryPolicy": {
      "MaximumRetryAttempts": 2,
      "MaximumEventAge": 3600
    }
  }' \
  --flexible-time-window '{"Mode": "OFF"}'
```

## Step 4: Verify Setup

### Test the endpoint manually:
```bash
# Replace with your domain and secret
curl -H "Authorization: Bearer YOUR_EMAIL_SENDER_SECRET" \
  https://YOUR_DOMAIN.vercel.app/api/cron/email-queue
```

Expected response:
```json
{
  "processed": {
    "sent": 0,
    "queued": 0,
    "errors": 0
  },
  "details": {
    "sentEmails": [],
    "queuedEmails": [],
    "errors": []
  }
}
```

### Check EventBridge execution:
```bash
# List your schedules
aws scheduler list-schedules

# Get specific schedule details
aws scheduler get-schedule --name tee-email-queue-processor
```

### Monitor in AWS Console:
1. Open [AWS EventBridge Console](https://console.aws.amazon.com/scheduler)
2. Navigate to Schedules
3. Find `tee-email-queue-processor`
4. Check execution history and metrics

## Step 5: Deploy and Monitor

1. **Deploy to Vercel**:
   ```bash
   vercel deploy --prod
   ```

2. **Monitor CloudWatch Logs**:
   - EventBridge logs schedule executions
   - Your Next.js app logs email processing

3. **Check Email Queue**:
   - Use the admin interface at `/admin/email`
   - Monitor queue status and delivery metrics

## Management Commands

### Update schedule frequency:
```bash
aws scheduler update-schedule \
  --name tee-email-queue-processor \
  --schedule-expression "rate(20 minutes)" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:http:invoke",
    "RoleArn": "YOUR_ROLE_ARN",
    "Input": "{...same as before...}"
  }' \
  --flexible-time-window '{"Mode": "OFF"}'
```

### Disable schedule temporarily:
```bash
aws scheduler update-schedule \
  --name tee-email-queue-processor \
  --state DISABLED
```

### Re-enable schedule:
```bash
aws scheduler update-schedule \
  --name tee-email-queue-processor \
  --state ENABLED
```

### Delete schedule:
```bash
aws scheduler delete-schedule --name tee-email-queue-processor
```

## Troubleshooting

### Issue: Unauthorized (401) errors
**Solution**: Verify `EMAIL_SENDER_SECRET` environment variable matches in both:
- Vercel environment variables
- EventBridge schedule configuration

### Issue: No emails being sent
**Solution**:
1. Check `/api/cron/email-queue` is accessible
2. Verify email schedules exist in DynamoDB `tee-schedules` table
3. Check logs in Vercel dashboard for errors

### Issue: Schedule not triggering
**Solution**:
1. Verify IAM role has correct permissions
2. Check EventBridge schedule is `ENABLED`
3. Review CloudWatch logs for execution failures

### Issue: Rate limit errors
**Solution**:
- Reduce schedule frequency (e.g., from 10 to 15 minutes)
- Check Vercel function execution limits

## Cost Considerations

### EventBridge Scheduler Pricing:
- **Free tier**: 14 million invocations/month
- **After free tier**: $1.00 per million invocations

### Expected Usage:
- Every 15 minutes = 2,880 invocations/month
- Every 10 minutes = 4,320 invocations/month
- Every 5 minutes = 8,640 invocations/month

**All well within free tier limits!**

## Next Steps

1. Set up monitoring alerts for failed executions
2. Consider adding CloudWatch dashboards
3. Review and optimize email queue processing logic
4. Add health check endpoint for EventBridge monitoring

## Related Files

- `/apps/next/app/api/cron/email-queue/route.ts` - Email queue processor
- `/apps/next/vercel.json` - Vercel configuration (legacy cron jobs)
- `/packages/app/provider/dynamodb/repositories/send-queue-repository.ts` - Queue repository
- `/packages/app/types/send-queue.ts` - Type definitions

## Migration Checklist

- [ ] Generate and set `EMAIL_SENDER_SECRET` in Vercel
- [ ] Create IAM role for EventBridge
- [ ] Create EventBridge schedule
- [ ] Test endpoint manually
- [ ] Monitor first 24 hours of execution
- [ ] Remove legacy Vercel cron (if migrating fully)
- [ ] Update documentation
- [ ] Notify team of migration
