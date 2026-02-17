import { 
  QueryCommand, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  DeleteCommand,
  BatchWriteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'
import { docClient, tableNames, type TableName } from '../config'
import type { BatchWriteResult } from '../types'

export abstract class BaseRepository<T extends Record<string, any>> {
  protected tableName: string
  protected usesUppercaseKeys: boolean

  constructor(tableKey: TableName, usesUppercaseKeys: boolean = false) {
    this.tableName = tableNames[tableKey]
    this.usesUppercaseKeys = usesUppercaseKeys
  }

  // Helper to get the correct key attribute names based on table schema
  private getKeyAttributes() {
    return this.usesUppercaseKeys
      ? { pk: 'PK', sk: 'SK' }
      : { pk: 'pkey', sk: 'skey' }
  }

  // Basic CRUD operations
  async get(pk: string, sk: string): Promise<T | null> {
    try {
      const keys = this.getKeyAttributes()
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { [keys.pk]: pk, [keys.sk]: sk },
      })

      const result = await docClient.send(command)
      return result.Item as T || null
    } catch (error) {
      console.error(`Error getting item from ${this.tableName}:`, error)
      throw error
    }
  }

  async put(item: T): Promise<void> {
    try {
      // Version handling differs by table
      let version: string | number
      if (this.usesUppercaseKeys) {
        // tee-schedules: string version
        const currentVersion = parseInt(String(item.version || '0'), 10)
        version = String(currentVersion + 1)
      } else {
        // tee-admin: numeric version
        version = (item.version as number || 0) + 1
      }

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...item,
          lastUpdated: new Date().toISOString(),
          version,
        },
      })

      await docClient.send(command)
    } catch (error) {
      console.error(`Error putting item to ${this.tableName}:`, error)
      throw error
    }
  }

  async update(
    pk: string,
    sk: string,
    updates: Partial<T>,
    options?: {
      conditionExpression?: string
      additionalExpressionAttributeNames?: Record<string, string>
      additionalExpressionAttributeValues?: Record<string, any>
    }
  ): Promise<T> {
    try {
      const updateExpressions: string[] = []
      const expressionAttributeNames: Record<string, string> = {}
      const expressionAttributeValues: Record<string, any> = {}

      // Filter out primary key fields, automatic fields, and undefined/null values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) =>
          key !== 'pkey' &&         // Primary key - cannot update
          key !== 'skey' &&         // Sort key - cannot update
          key !== 'PK' &&           // Alias - cannot update
          key !== 'SK' &&           // Alias - cannot update
          key !== 'lastUpdated' &&  // Automatically managed
          key !== 'version' &&      // Automatically managed
          value !== undefined &&
          value !== null
        )
      )

      // Build update expression
      let index = 0
      Object.entries(filteredUpdates).forEach(([key, value]) => {
        const nameKey = `#attr${index}`
        const valueKey = `:val${index}`
        
        updateExpressions.push(`${nameKey} = ${valueKey}`)
        expressionAttributeNames[nameKey] = key
        expressionAttributeValues[valueKey] = value
        index++
      })

      // Add automatic lastUpdated
      updateExpressions.push('#lastUpdated = :lastUpdated')
      expressionAttributeNames['#lastUpdated'] = 'lastUpdated'
      expressionAttributeValues[':lastUpdated'] = new Date().toISOString()

      // Version handling differs by table:
      // - tee-schedules (uppercase keys): version is STRING
      // - tee-admin (lowercase keys): version is NUMBER
      if (this.usesUppercaseKeys) {
        // Don't auto-increment string version - let DynamoDB handle it or skip it
        // String version is managed by put() operations, not update()
      } else {
        // Old tables use numeric version
        updateExpressions.push('#version = if_not_exists(#version, :zero) + :one')
        expressionAttributeNames['#version'] = 'version'
        expressionAttributeValues[':zero'] = 0
        expressionAttributeValues[':one'] = 1
      }

      // Merge any additional expression attributes from options
      if (options?.additionalExpressionAttributeNames) {
        Object.assign(expressionAttributeNames, options.additionalExpressionAttributeNames)
      }
      if (options?.additionalExpressionAttributeValues) {
        Object.assign(expressionAttributeValues, options.additionalExpressionAttributeValues)
      }

      const keys = this.getKeyAttributes()
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { [keys.pk]: pk, [keys.sk]: sk },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
        // Add conditional expression if provided (for atomic operations)
        ...(options?.conditionExpression && { ConditionExpression: options.conditionExpression }),
      })

      const result = await docClient.send(command)
      return result.Attributes as T
    } catch (error) {
      console.error(`Error updating item in ${this.tableName}:`, error)
      throw error
    }
  }

  async delete(pk: string, sk: string): Promise<void> {
    try {
      const keys = this.getKeyAttributes()
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { [keys.pk]: pk, [keys.sk]: sk },
      })

      await docClient.send(command)
    } catch (error) {
      console.error(`Error deleting item from ${this.tableName}:`, error)
      throw error
    }
  }

  // Query operations
  async query(
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, any>,
    options: {
      indexName?: string
      limit?: number
      scanIndexForward?: boolean
      lastEvaluatedKey?: Record<string, any>
      filterExpression?: string
      expressionAttributeNames?: Record<string, string>
    } = {}
  ): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        IndexName: options.indexName,
        Limit: options.limit,
        ScanIndexForward: options.scanIndexForward,
        ExclusiveStartKey: options.lastEvaluatedKey,
        FilterExpression: options.filterExpression,
        ExpressionAttributeNames: options.expressionAttributeNames,
      })

      const result = await docClient.send(command)
      return {
        items: (result.Items || []) as T[],
        lastEvaluatedKey: result.LastEvaluatedKey,
      }
    } catch (error) {
      console.error(`Error querying ${this.tableName}:`, error)
      throw error
    }
  }

  // Batch operations
  async batchWrite(items: T[], maxRetries = 3): Promise<BatchWriteResult> {
    const BATCH_SIZE = 25 // DynamoDB limit
    let successful = 0
    let failed = 0
    const errors: string[] = []
    let unprocessedItems: Record<string, any>[] = []

    // Process in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      
      try {
        const result = await this.writeBatch(batch, maxRetries)
        successful += result.successful
        failed += result.failed
        errors.push(...result.errors)
        
        if (result.unprocessedItems) {
          unprocessedItems.push(...result.unprocessedItems)
        }
      } catch (error) {
        failed += batch.length
        errors.push(`Batch write failed: ${error}`)
      }
    }

    return { successful, failed, errors, unprocessedItems }
  }

  private async writeBatch(items: T[], maxRetries: number): Promise<BatchWriteResult> {
    let requestItems = items.map(item => {
      // Version handling differs by table
      let version: string | number
      if (this.usesUppercaseKeys) {
        // tee-schedules: string version
        const currentVersion = parseInt(String(item.version || '0'), 10)
        version = String(currentVersion + 1)
      } else {
        // tee-admin: numeric version
        version = (item.version as number || 0) + 1
      }

      return {
        PutRequest: {
          Item: {
            ...item,
            lastUpdated: new Date().toISOString(),
            version,
          },
        },
      }
    })

    let retries = 0
    let successful = 0
    let failed = 0
    const errors: string[] = []

    while (requestItems.length > 0 && retries < maxRetries) {
      try {
        const command = new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: requestItems,
          },
        })

        const result = await docClient.send(command)
        successful += requestItems.length - (result.UnprocessedItems?.[this.tableName]?.length || 0)

        // Handle unprocessed items
        if (result.UnprocessedItems?.[this.tableName]) {
          requestItems = result.UnprocessedItems[this.tableName] as typeof requestItems
          retries++
          
          if (retries < maxRetries) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100))
          }
        } else {
          requestItems = []
        }
      } catch (error) {
        failed += requestItems.length
        errors.push(`Batch write attempt ${retries + 1} failed: ${error}`)
        break
      }
    }

    // Any remaining items are considered failed
    if (requestItems.length > 0) {
      failed += requestItems.length
      errors.push(`${requestItems.length} items remained unprocessed after ${maxRetries} retries`)
    }

    return { 
      successful, 
      failed, 
      errors,
      unprocessedItems: requestItems.map(item => item.PutRequest?.Item).filter(Boolean)
    }
  }

  // Scan operation (use sparingly)
  async scan(options: {
    limit?: number
    lastEvaluatedKey?: Record<string, any>
    filterExpression?: string
    expressionAttributeValues?: Record<string, any>
    expressionAttributeNames?: Record<string, string>
  } = {}): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: options.limit,
        ExclusiveStartKey: options.lastEvaluatedKey,
        FilterExpression: options.filterExpression,
        ExpressionAttributeValues: options.expressionAttributeValues,
        ExpressionAttributeNames: options.expressionAttributeNames,
      })

      const result = await docClient.send(command)
      return {
        items: (result.Items || []) as T[],
        lastEvaluatedKey: result.LastEvaluatedKey,
      }
    } catch (error) {
      console.error(`Error scanning ${this.tableName}:`, error)
      throw error
    }
  }

  // Helper method to clear all records for a sheet (for re-sync)
  async clearSheetRecords(sheetId: string): Promise<void> {
    const pk = this.buildSheetPK(sheetId)
    const keys = this.getKeyAttributes()

    // Query all items for this sheet
    const result = await this.query(
      `${keys.pk} = :pk`,
      { ':pk': pk }
    )

    // Delete in batches
    const deletePromises = result.items.map(item =>
      this.delete(item[keys.pk] || item.PK || item.pkey, item[keys.sk] || item.SK || item.skey)
    )

    await Promise.all(deletePromises)
  }

  // Abstract methods to be implemented by subclasses
  protected abstract buildSheetPK(sheetId: string): string
}