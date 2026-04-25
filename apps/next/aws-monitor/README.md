# TEE Admin Health Monitor

An independent AWS Lambda function that monitors the TEE Admin website every 6 hours.

## What it monitors

1. **Homepage** - Verifies the site is accessible
2. **Newsletter API** (`/api/upcoming-program`) - Checks for schedule data
3. **Schedule API - Memorial** - Verifies memorial events are loading
4. **Schedule API - Bible Class** - Verifies bible class events are loading
5. **Schedule API - Sunday School** - Verifies sunday school events are loading

## Alerts

When any check fails, an email alert is sent to the configured email address with:
- Which checks failed
- Error details
- Response times for all checks

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **AWS SAM CLI** installed ([Install SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
3. **SES verified email** - The "from" email must be verified in SES

## Deployment

### First-time deployment

```bash
cd apps/next/aws-monitor

# Install dependencies
npm install

# Build the SAM application
sam build

# Deploy with guided prompts
sam deploy --guided
```

During guided deployment, you'll be prompted for:
- **Stack Name**: `tee-admin-health-monitor`
- **AWS Region**: `ca-central-1` (or your preferred region)
- **AlertEmail**: Email to receive alerts (default: ken.easson@gmail.com)
- **FromEmail**: SES-verified email to send from

### Subsequent deployments

```bash
sam build && sam deploy
```

## Manual Testing

### Invoke the Lambda directly

```bash
# Via SAM CLI
sam remote invoke tee-admin-health-check

# Via AWS CLI
aws lambda invoke --function-name tee-admin-health-check output.json && cat output.json
```

### Via the API endpoint

After deployment, you'll get an API URL. You can trigger a health check by visiting:
```
https://{api-id}.execute-api.ca-central-1.amazonaws.com/prod/health
```

### Local testing

```bash
node health-check.js
```

## Viewing Logs

```bash
# Stream logs in real-time
sam logs -n tee-admin-health-check --tail

# View recent logs
sam logs -n tee-admin-health-check
```

Or view in CloudWatch Console:
- Go to CloudWatch → Log Groups → `/aws/lambda/tee-admin-health-check`

## Schedule

The health check runs automatically every 6 hours via EventBridge.

To modify the schedule, edit `template.yaml`:
```yaml
Schedule: rate(6 hours)  # Change to desired interval
```

Other schedule examples:
- `rate(1 hour)` - Every hour
- `rate(12 hours)` - Twice daily
- `cron(0 8 * * ? *)` - Daily at 8 AM UTC

## Costs

This solution is extremely cost-effective:
- **Lambda**: ~4 invocations/day × 30 days = 120 invocations/month (well within free tier)
- **EventBridge**: Free for scheduled rules
- **SES**: $0.10 per 1,000 emails (only sent on failures)
- **API Gateway**: Minimal usage for manual triggers

Estimated monthly cost: **< $0.50**

## Troubleshooting

### "Email address not verified" error

1. Go to AWS SES Console
2. Verify the "from" email address
3. If in sandbox mode, also verify the "to" email address

### Checks timing out

The Lambda has a 60-second timeout. If checks are slow:
1. Check if the target site is having issues
2. Increase the timeout in `template.yaml`

### False positives

If you're getting alerts for transient issues:
1. Consider adding retry logic to `health-check.js`
2. Adjust the CloudWatch alarm threshold
