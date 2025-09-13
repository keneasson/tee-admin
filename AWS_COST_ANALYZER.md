# AWS DynamoDB Cost Analyzer & Optimization Guide

## 📊 Current Usage Analysis

### Event Management System Profile
- **New Events**: ~100 events per year
- **Event Reads**: ~50,000 reads per year  
- **Average Event Size**: ~5KB
- **Draft Saves**: ~10 saves per event before publishing
- **Total Annual Writes**: ~1,000 writes (100 events × 10 saves)
- **Storage Growth**: ~0.5MB per year

## 💰 Cost Estimation for Your Usage

### Current Configuration (On-Demand Standard)
```
Annual Costs:
- Writes: 1,000 writes × $1.25/million = $0.00125
- Reads: 50,000 reads × $0.25/million = $0.0125
- Storage: 1GB × $0.25/month × 12 = $3.00
- Total Annual Cost: ~$3.01
- Monthly Cost: ~$0.25
```

### Optimized Configuration (On-Demand Standard-IA)
```
Annual Costs:
- Writes: 1,000 writes × $0.94/million = $0.00094
- Reads: 50,000 reads × $0.19/million = $0.0095
- Storage: 1GB × $0.10/month × 12 = $1.20
- Total Annual Cost: ~$1.21
- Monthly Cost: ~$0.10
- Savings: 60% reduction
```

## 🎯 Recommended Configuration

For your usage pattern (100 events/year, 50k reads/year), **stay with On-Demand billing** but switch to **Standard-IA table class**.

### Why On-Demand?
- Your usage is too low for provisioned capacity
- Minimum provisioned capacity (1 WCU + 1 RCU) costs $6.84/month
- On-Demand costs you only $0.10-0.25/month
- **On-Demand is 27x cheaper for your volume**

### Why Standard-IA?
- 60% cheaper storage costs
- 25% cheaper read/write costs
- Perfect for event drafts (write once, read rarely)
- No performance impact for your use case

## 🚀 How to Optimize Your Tables

### Step 1: Check Current Configuration
```bash
aws dynamodb describe-table \
  --table-name tee-schedules \
  --query 'Table.[TableName,BillingMode,TableClassSummary.TableClass]' \
  --output table
```

### Step 2: Switch to Standard-IA Table Class
```bash
# Update the table class (takes ~30 minutes)
aws dynamodb update-table \
  --table-name tee-schedules \
  --table-class-override STANDARD_INFREQUENT_ACCESS

# Monitor the update status
aws dynamodb describe-table \
  --table-name tee-schedules \
  --query 'Table.TableStatus'
```

### Step 3: Verify the Change
```bash
aws dynamodb describe-table \
  --table-name tee-schedules \
  --query 'Table.TableClassSummary' \
  --output json
```

## 📈 When to Consider Provisioned Capacity

### Transition Thresholds
Monitor your CloudWatch metrics and consider switching to provisioned capacity when:

| Metric | Current | Transition Point | Action |
|--------|---------|-----------------|---------|
| **Monthly Writes** | ~100 | > 10,000 | Consider provisioned |
| **Monthly Reads** | ~4,200 | > 50,000 | Consider provisioned |
| **Consistent Traffic** | Sporadic | Daily consistent | Switch to provisioned |
| **Monthly Cost** | $0.10 | > $10 | Evaluate provisioned |

### Break-Even Analysis
```
Provisioned Minimum Cost: $6.84/month (1 WCU + 1 RCU)
This equals approximately:
- 5.5 million On-Demand writes, OR
- 27 million On-Demand reads

You need 55,000x more writes to justify provisioned capacity!
```

## 🔧 Implementation Guide

### 1. Apply Standard-IA Optimization (Immediate)
```javascript
// Add to your deployment scripts
const { DynamoDBClient, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });

async function optimizeForLowVolume() {
  const tables = ['tee-schedules', 'tee-admin', 'tee-sync-status'];
  
  for (const tableName of tables) {
    await client.send(new UpdateTableCommand({
      TableName: tableName,
      TableClass: 'STANDARD_INFREQUENT_ACCESS'
    }));
    
    console.log(`✅ Optimized ${tableName} to Standard-IA`);
  }
}

optimizeForLowVolume();
```

### 2. Monitor Usage with CloudWatch
```javascript
// Add to your monitoring
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

async function getMonthlyUsage(tableName) {
  const cw = new CloudWatchClient({ region: 'us-east-1' });
  
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 30);
  
  const params = {
    Namespace: 'AWS/DynamoDB',
    MetricName: 'UserErrors',
    Dimensions: [{ Name: 'TableName', Value: tableName }],
    StartTime: startTime,
    EndTime: endTime,
    Period: 2592000, // 30 days
    Statistics: ['Sum']
  };
  
  const data = await cw.send(new GetMetricStatisticsCommand(params));
  return data;
}
```

### 3. Batch Write Implementation
```javascript
// Optimize your event saves
import { batchWriteEvents } from './dynamodb-optimization';

// Instead of individual saves
async function saveEventsDrafts(events) {
  // ❌ Expensive: Multiple API calls
  for (const event of events) {
    await dynamodb.putItem(event);
  }
}

// Use batch writes
async function saveEventsDraftsOptimized(events) {
  // ✅ Cheaper: Single API call for up to 25 items
  await batchWriteEvents(dynamoClient, 'tee-schedules', events);
}
```

## 📉 Cost Reduction Strategies

### Immediate Actions (60% cost reduction)
1. ✅ **Switch to Standard-IA** - Save $1.80/year
2. ✅ **Disable auto-save** - Already implemented
3. ✅ **Use batch writes** - Reduce API calls

### Future Optimizations
1. **Implement caching** - Reduce reads by 50%
2. **Archive old events** - Move to S3 after 1 year
3. **Use GSI efficiently** - Optimize query patterns

## 🎯 Monitoring Dashboard

### Key Metrics to Track
```bash
# Create a simple monitoring script
#!/bin/bash

echo "=== DynamoDB Cost Monitor ==="
echo ""

# Get consumed capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=tee-schedules \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table

echo ""
echo "Monthly Estimate:"
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter file://dynamodb-filter.json \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text
```

## 🚨 Cost Alerts

### Set up billing alerts
```bash
# Create a billing alarm for DynamoDB
aws cloudwatch put-metric-alarm \
  --alarm-name dynamodb-cost-alarm \
  --alarm-description "Alert when DynamoDB costs exceed $5/month" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD Name=ServiceName,Value=DynamoDB
```

## 📊 Annual Cost Projection

### Year 1-5 Projection (Current Growth Rate)
```
Year 1: $1.21 (100 events, 50k reads)
Year 2: $1.35 (200 events, 75k reads)
Year 3: $1.49 (300 events, 100k reads)
Year 4: $1.63 (400 events, 125k reads)
Year 5: $1.77 (500 events, 150k reads)

5-Year Total: $7.45
```

### When to Re-evaluate

| Trigger | Current | Threshold | Action |
|---------|---------|-----------|---------|
| **Monthly Bill** | $0.10 | > $10 | Consider provisioned |
| **Events/Month** | ~8 | > 100 | Review architecture |
| **Reads/Month** | ~4,200 | > 100,000 | Add caching layer |
| **Storage** | < 1GB | > 10GB | Archive old events |

## ✅ Action Checklist

### Immediate (This Week)
- [ ] Switch all tables to Standard-IA class
- [ ] Verify manual save system is working
- [ ] Set up cost monitoring alerts

### Short-term (This Month)
- [ ] Implement batch writes for multiple events
- [ ] Add CloudWatch dashboard for usage tracking
- [ ] Document actual usage patterns

### Long-term (This Quarter)
- [ ] Review Single Table Design for query optimization
- [ ] Implement event archival strategy
- [ ] Consider caching layer if reads increase

## 💡 Key Takeaways

1. **Your current usage is extremely low** - 100 events/year is minimal
2. **Stay with On-Demand** - Provisioned capacity would cost 27x more
3. **Switch to Standard-IA** - Immediate 60% cost savings
4. **Total annual cost: ~$1.21** - Less than a cup of coffee
5. **Re-evaluate at 10,000 events/year** - That's your break-even point

## 🔗 Resources

- [DynamoDB Pricing Calculator](https://calculator.aws/#/createCalculator/DynamoDB)
- [Standard-IA Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.TableClasses.html)
- [CloudWatch Metrics for DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html)
- [Auto-scaling Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/AutoScaling.html)

---

*Last Updated: January 2025*  
*Review Schedule: Quarterly or when monthly costs exceed $10*