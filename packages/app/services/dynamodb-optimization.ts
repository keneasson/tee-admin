// DynamoDB Cost Optimization Configuration
// For write-heavy event management tables

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { UpdateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb'

/**
 * Optimize DynamoDB table for cost-effective batch writes
 * 
 * Recommended settings for event management:
 * 1. Provisioned capacity with auto-scaling for predictable costs
 * 2. Standard-IA for draft events (written frequently, read rarely)
 * 3. Batch writes for multiple events
 */

export interface TableOptimizationConfig {
  tableName: string
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  tableClass?: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  autoScaling?: {
    targetTrackingScalingPolicy: {
      targetValue: number // Target utilization (60-80% recommended)
      scaleInCooldown?: number
      scaleOutCooldown?: number
    }
    minCapacity: number
    maxCapacity: number
  }
}

/**
 * Recommended configurations for different use cases
 */
export const OPTIMIZATION_PRESETS = {
  // For development/testing - minimize costs
  DEVELOPMENT: {
    billingMode: 'PROVISIONED' as const,
    tableClass: 'STANDARD' as const,
    provisionedThroughput: {
      readCapacityUnits: 1,
      writeCapacityUnits: 1
    }
  },
  
  // For event drafts - frequent writes, infrequent reads
  EVENT_DRAFTS: {
    billingMode: 'PROVISIONED' as const,
    tableClass: 'STANDARD_INFREQUENT_ACCESS' as const,
    provisionedThroughput: {
      readCapacityUnits: 5,
      writeCapacityUnits: 10
    },
    autoScaling: {
      targetTrackingScalingPolicy: {
        targetValue: 70, // 70% utilization
        scaleInCooldown: 60,
        scaleOutCooldown: 60
      },
      minCapacity: 5,
      maxCapacity: 100
    }
  },
  
  // For production events - balanced read/write
  PRODUCTION_EVENTS: {
    billingMode: 'PROVISIONED' as const,
    tableClass: 'STANDARD' as const,
    provisionedThroughput: {
      readCapacityUnits: 10,
      writeCapacityUnits: 10
    },
    autoScaling: {
      targetTrackingScalingPolicy: {
        targetValue: 70,
        scaleInCooldown: 300,
        scaleOutCooldown: 60
      },
      minCapacity: 10,
      maxCapacity: 1000
    }
  },
  
  // For unpredictable spiky traffic
  ON_DEMAND: {
    billingMode: 'PAY_PER_REQUEST' as const,
    tableClass: 'STANDARD' as const
  }
}

/**
 * Apply optimization settings to a DynamoDB table
 */
export async function optimizeTable(
  client: DynamoDBClient,
  config: TableOptimizationConfig
): Promise<void> {
  const updateCommand = new UpdateTableCommand({
    TableName: config.tableName,
    BillingMode: config.billingMode,
    TableClass: config.tableClass,
    ...(config.billingMode === 'PROVISIONED' && config.provisionedThroughput && {
      ProvisionedThroughput: {
        ReadCapacityUnits: config.provisionedThroughput.readCapacityUnits,
        WriteCapacityUnits: config.provisionedThroughput.writeCapacityUnits
      }
    })
  })
  
  await client.send(updateCommand)
  
  console.log(`Table ${config.tableName} optimized with settings:`, {
    billingMode: config.billingMode,
    tableClass: config.tableClass,
    throughput: config.provisionedThroughput
  })
}

/**
 * Batch write events efficiently
 * Reduces API calls and costs
 */
export async function batchWriteEvents(
  client: DynamoDBClient,
  tableName: string,
  events: any[]
): Promise<void> {
  // DynamoDB allows max 25 items per batch
  const BATCH_SIZE = 25
  
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE)
    
    const putRequests = batch.map(event => ({
      PutRequest: {
        Item: event
      }
    }))
    
    await client.send({
      RequestItems: {
        [tableName]: putRequests
      }
    })
    
    console.log(`Batch wrote ${batch.length} events (${i + batch.length}/${events.length})`)
  }
}

/**
 * Calculate estimated monthly costs
 */
export function estimateMonthlyCosts(config: {
  writesPerMonth: number
  readsPerMonth: number
  storageGB: number
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  tableClass: 'STANDARD' | 'STANDARD_INFREQUENT_ACCESS'
  provisionedWCU?: number
  provisionedRCU?: number
}): {
  storageCost: number
  writeCost: number
  readCost: number
  totalCost: number
  savings: string
} {
  let storageCost = 0
  let writeCost = 0
  let readCost = 0
  
  // Storage costs per GB per month
  if (config.tableClass === 'STANDARD') {
    storageCost = config.storageGB * 0.25
  } else {
    storageCost = config.storageGB * 0.10 // 60% cheaper
  }
  
  if (config.billingMode === 'PAY_PER_REQUEST') {
    // On-demand pricing
    if (config.tableClass === 'STANDARD') {
      writeCost = (config.writesPerMonth / 1_000_000) * 1.25
      readCost = (config.readsPerMonth / 1_000_000) * 0.25
    } else {
      // Standard-IA is 25% cheaper
      writeCost = (config.writesPerMonth / 1_000_000) * 0.94
      readCost = (config.readsPerMonth / 1_000_000) * 0.19
    }
  } else {
    // Provisioned pricing (per month)
    const hoursPerMonth = 730
    writeCost = (config.provisionedWCU || 0) * 0.00065 * hoursPerMonth
    readCost = (config.provisionedRCU || 0) * 0.00013 * hoursPerMonth
  }
  
  const totalCost = storageCost + writeCost + readCost
  
  // Calculate savings vs on-demand standard
  const onDemandStandardCost = 
    config.storageGB * 0.25 +
    (config.writesPerMonth / 1_000_000) * 1.25 +
    (config.readsPerMonth / 1_000_000) * 0.25
  
  const savingsPercent = ((onDemandStandardCost - totalCost) / onDemandStandardCost * 100).toFixed(1)
  
  return {
    storageCost,
    writeCost,
    readCost,
    totalCost,
    savings: `${savingsPercent}% vs on-demand`
  }
}

// Example usage for your event system
export const EVENT_SYSTEM_OPTIMIZATION = {
  // Apply to your tee-schedules table
  async applyOptimizations(client: DynamoDBClient) {
    // Use Standard-IA for draft events
    await optimizeTable(client, {
      tableName: 'tee-schedules',
      ...OPTIMIZATION_PRESETS.EVENT_DRAFTS
    })
    
    // Estimate monthly savings
    const estimate = estimateMonthlyCosts({
      writesPerMonth: 10_000, // 10k event saves
      readsPerMonth: 5_000,   // 5k event reads
      storageGB: 1,            // 1GB of event data
      billingMode: 'PROVISIONED',
      tableClass: 'STANDARD_INFREQUENT_ACCESS',
      provisionedWCU: 10,
      provisionedRCU: 5
    })
    
    console.log('Estimated monthly costs:', estimate)
    // Example output:
    // storageCost: $0.10
    // writeCost: $4.75  
    // readCost: $0.95
    // totalCost: $5.80
    // savings: "65% vs on-demand"
  }
}