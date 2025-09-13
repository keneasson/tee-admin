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

  constructor(tableKey: TableName) {
    this.tableName = tableNames[tableKey]
  }

  // Basic CRUD operations
  async get(pk: string, sk: string): Promise<T | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
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
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...item,
          lastUpdated: new Date().toISOString(),
          version: (item.version || 0) + 1,
        },
      })

      await docClient.send(command)
    } catch (error) {
      console.error(`Error putting item to ${this.tableName}:`, error)
      throw error
    }
  }

  async update(pk: string, sk: string, updates: Partial<T>): Promise<T> {
    try {
      const updateExpressions: string[] = []
      const expressionAttributeNames: Record<string, string> = {}
      const expressionAttributeValues: Record<string, any> = {}

      // Filter out primary key fields, automatic fields, and undefined/null values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => 
          key !== 'PK' &&          // Primary key - cannot update
          key !== 'SK' &&          // Sort key - cannot update
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

      // Add automatic lastUpdated and version increment
      updateExpressions.push('#lastUpdated = :lastUpdated')
      updateExpressions.push('#version = if_not_exists(#version, :zero) + :one')
      
      expressionAttributeNames['#lastUpdated'] = 'lastUpdated'
      expressionAttributeNames['#version'] = 'version'
      expressionAttributeValues[':lastUpdated'] = new Date().toISOString()
      expressionAttributeValues[':zero'] = 0
      expressionAttributeValues[':one'] = 1

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
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
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
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
    let requestItems = items.map(item => ({
      PutRequest: {
        Item: {
          ...item,
          lastUpdated: new Date().toISOString(),
          version: (item.version || 0) + 1,
        },
      },
    }))

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
          requestItems = result.UnprocessedItems[this.tableName]
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
    
    // Query all items for this sheet
    const result = await this.query(
      'PK = :pk',
      { ':pk': pk }
    )

    // Delete in batches
    const deletePromises = result.items.map(item => 
      this.delete(item.PK, item.SK)
    )

    await Promise.all(deletePromises)
  }

  // Abstract methods to be implemented by subclasses
  protected abstract buildSheetPK(sheetId: string): string
}