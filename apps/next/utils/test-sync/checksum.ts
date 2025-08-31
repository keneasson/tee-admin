/**
 * CRC32 Checksum Utilities for Test Sync
 * Fast data change detection using row-level and sheet-level checksums
 */

import crc32 from 'buffer-crc32'

/**
 * Calculate checksum for a single test sync row
 * Includes row number to handle duplicate content in different positions
 */
export function calculateRowChecksum(
  rowNumber: number,
  date: string,
  name: string, 
  topic: string
): string {
  const rowData = `${rowNumber}|${date}|${name}|${topic}`
  const checksum = crc32(Buffer.from(rowData, 'utf8'))
  // buffer-crc32 returns a Buffer, convert to hex string
  const hex = checksum.toString('hex')
  return hex.padStart(8, '0') // Return as 8-character hex string
}

/**
 * Calculate checksum for an entire sheet of test sync data
 * Uses sorted row checksums to ensure consistent results regardless of processing order
 */
export function calculateSheetChecksum(rowChecksums: string[]): string {
  const sortedChecksums = rowChecksums.slice().sort()
  const combinedData = sortedChecksums.join(',')
  const checksum = crc32(Buffer.from(combinedData, 'utf8'))
  // buffer-crc32 returns a Buffer, convert to hex string
  const hex = checksum.toString('hex')
  return hex.padStart(8, '0')
}

/**
 * Generate a unique key for a row based on its content
 * This helps identify rows across syncs even if row numbers change
 */
export function generateRowKey(
  rowNumber: number,
  date: string,
  name: string,
  topic: string
): string {
  // Use the skey format: DATE#2025-01-15#ROW#2
  return `DATE#${date}#ROW#${rowNumber}`
}

/**
 * Compare two sets of row data and identify changes
 * Returns arrays of rows to insert, update, and delete
 */
export interface RowDiff {
  toInsert: Array<{rowNumber: number, date: string, name: string, topic: string, checksum: string}>
  toUpdate: Array<{rowNumber: number, date: string, name: string, topic: string, checksum: string}>
  toDelete: string[] // Array of skey values to delete
}

export function compareRowData(
  currentRows: Array<{rowNumber: number, date: string, name: string, topic: string}>,
  existingRows: Array<{skey: string, date: string, name: string, topic: string, rowChecksum?: string}>
): RowDiff {
  // Calculate checksums for current rows
  const currentWithChecksums = currentRows.map(row => ({
    ...row,
    checksum: calculateRowChecksum(row.rowNumber, row.date, row.name, row.topic),
    key: generateRowKey(row.rowNumber, row.date, row.name, row.topic)
  }))
  
  // Create lookup maps
  const existingByKey = new Map(
    existingRows.map(row => [row.skey, {
      ...row,
      checksum: row.rowChecksum || calculateRowChecksum(
        parseInt(row.skey.split('#ROW#')[1]) || 0,
        row.date,
        row.name, 
        row.topic
      )
    }])
  )
  
  const currentByKey = new Map(
    currentWithChecksums.map(row => [row.key, row])
  )
  
  const toInsert: RowDiff['toInsert'] = []
  const toUpdate: RowDiff['toUpdate'] = []
  const toDelete: string[] = []
  
  // Find inserts and updates
  for (const current of currentWithChecksums) {
    const existing = existingByKey.get(current.key)
    
    if (!existing) {
      // New row - insert
      toInsert.push(current)
    } else if (existing.checksum !== current.checksum) {
      // Row changed - update
      toUpdate.push(current)
    }
    // If checksums match, no action needed
  }
  
  // Find deletes
  for (const [skey] of existingByKey) {
    if (!currentByKey.has(skey)) {
      toDelete.push(skey)
    }
  }
  
  return { toInsert, toUpdate, toDelete }
}