'use client'

import { GoogleSheet, GoogleSheetTypes } from '@my/app/types'
import { dataService } from './dynamodb/data-service'

/**
 * Migrated version of getGoogleSheet provider function
 * 
 * This replaces the original /packages/app/provider/get-google-sheet.tsx
 * with DynamoDB-backed data fetching and Google Sheets fallback
 */

/**
 * Main function to get Google Sheet data - now backed by DynamoDB
 * Drop-in replacement for the original getGoogleSheet function
 */
export async function getGoogleSheet(scheduleKey: GoogleSheetTypes): Promise<GoogleSheet> {
  try {
    console.log(`📊 [MIGRATED] Fetching ${scheduleKey} via DynamoDB service`)
    
    // Use the unified data service which handles DynamoDB + fallback
    const result = await dataService.getGoogleSheet(scheduleKey)
    
    console.log(`✅ [MIGRATED] ${scheduleKey} data fetched successfully`)
    return result
    
  } catch (error) {
    console.error(`❌ [MIGRATED] Error fetching ${scheduleKey}:`, error)
    
    // Final fallback: use original Google Sheets function if available
    try {
      console.warn(`⚠️ [MIGRATED] Attempting final fallback to original Google Sheets API for ${scheduleKey}`)
      
      // Dynamic import to avoid circular dependencies
      const originalModule = await import('./get-google-sheet')
      if (originalModule.getGoogleSheet) {
        const fallbackResult = await originalModule.getGoogleSheet(scheduleKey)
        console.log(`✅ [MIGRATED] ${scheduleKey} served via original Google Sheets API fallback`)
        return fallbackResult
      }
    } catch (fallbackError) {
      console.error(`❌ [MIGRATED] Final fallback failed for ${scheduleKey}:`, fallbackError)
    }
    
    throw new Error(`Failed to fetch ${scheduleKey} data from all sources`)
  }
}

/**
 * React hook for fetching Google Sheet data with caching
 * Enhanced version with DynamoDB support
 */
export function useGoogleSheet(scheduleKey: GoogleSheetTypes) {
  const [data, setData] = React.useState<GoogleSheet | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dataSource, setDataSource] = React.useState<string>('unknown')

  React.useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        console.log(`🔄 [HOOK] Loading ${scheduleKey} data`)
        
        const result = await getGoogleSheet(scheduleKey)
        
        if (isMounted) {
          setData(result)
          setDataSource('dynamodb') // Default assumption, could be enhanced with API response headers
          console.log(`✅ [HOOK] ${scheduleKey} data loaded successfully`)
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          setError(errorMessage)
          console.error(`❌ [HOOK] Error loading ${scheduleKey}:`, errorMessage)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [scheduleKey])

  return {
    data,
    loading,
    error,
    dataSource,
    refetch: () => {
      setData(null)
      setLoading(true)
      setError(null)
    }
  }
}

/**
 * Server-side function for API routes and SSR
 * Enhanced with DynamoDB support and proper error handling
 */
export async function getGoogleSheetServerSide(scheduleKey: GoogleSheetTypes): Promise<GoogleSheet> {
  try {
    console.log(`🖥️ [SERVER] Fetching ${scheduleKey} on server-side`)
    
    // For server-side, use the ScheduleService directly for better performance
    if (typeof window === 'undefined') {
      const { ScheduleService } = await import('./dynamodb/schedule-service')
      const scheduleService = new ScheduleService()
      
      if (scheduleKey === 'directory') {
        const result = await scheduleService.getDirectoryData()
        if (result) {
          console.log(`✅ [SERVER] ${scheduleKey} served from DynamoDB`)
          return result
        }
      } else {
        const result = await scheduleService.getScheduleData(scheduleKey as any)
        if (result) {
          console.log(`✅ [SERVER] ${scheduleKey} served from DynamoDB`)
          return result
        }
      }
      
      // If DynamoDB data not available, fall back to Google Sheets
      console.warn(`⚠️ [SERVER] DynamoDB data not available for ${scheduleKey}, using Google Sheets`)
    }
    
    // Fallback to client-side method
    return await getGoogleSheet(scheduleKey)
    
  } catch (error) {
    console.error(`❌ [SERVER] Error in server-side fetch for ${scheduleKey}:`, error)
    throw error
  }
}

/**
 * Migration status checker
 * Helps identify which components are using the new vs old data service
 */
export function getMigrationStatus(): {
  isDynamoDBEnabled: boolean
  isGoogleSheetsEnabled: boolean
  migrationMode: 'full-dynamodb' | 'hybrid' | 'google-sheets-only'
} {
  // Check if we're in a migration phase
  const isDynamoDBEnabled = process.env.NEXT_PUBLIC_ENABLE_DYNAMODB !== 'false'
  const isGoogleSheetsEnabled = process.env.NEXT_PUBLIC_DISABLE_GOOGLE_SHEETS !== 'true'
  
  let migrationMode: 'full-dynamodb' | 'hybrid' | 'google-sheets-only'
  
  if (isDynamoDBEnabled && !isGoogleSheetsEnabled) {
    migrationMode = 'full-dynamodb'
  } else if (isDynamoDBEnabled && isGoogleSheetsEnabled) {
    migrationMode = 'hybrid'
  } else {
    migrationMode = 'google-sheets-only'
  }
  
  return {
    isDynamoDBEnabled,
    isGoogleSheetsEnabled,
    migrationMode
  }
}

// Import React for the hook
import React from 'react'