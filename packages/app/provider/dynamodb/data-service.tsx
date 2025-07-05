'use client'

import { GoogleSheetData, GoogleSheetTypes, ProgramTypeKeys } from '@my/app/types'

/**
 * Unified data service that abstracts DynamoDB vs Google Sheets data sources
 * Provides a drop-in replacement for existing Google Sheets API calls
 */
export class DataService {
  private baseUrl: string

  constructor() {
    // Auto-detect base URL for client-side usage
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'
  }

  /**
   * Drop-in replacement for get_google_sheet()
   * Now uses DynamoDB-backed API with Google Sheets fallback
   */
  async getGoogleSheet<K extends GoogleSheetTypes>(sheetKey: K): Promise<GoogleSheetData> {
    try {
      console.log(`📊 Fetching ${sheetKey} data via unified data service`)

      // Map sheet keys to new API endpoints
      let endpoint: string
      if (sheetKey === 'directory') {
        endpoint = `/api/directory`
      } else {
        endpoint = `/api/schedule/${sheetKey}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache handling
        cache: 'default',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Log data source for monitoring
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      console.log(`✅ ${sheetKey} data served from ${dataSource}`)

      return data

    } catch (error) {
      console.error(`❌ Error fetching ${sheetKey} data:`, error)
      throw new Error(`Failed to fetch ${sheetKey} data`)
    }
  }

  /**
   * Drop-in replacement for get_upcoming_program()
   * Now uses DynamoDB-backed API with Google Sheets fallback
   */
  async getUpcomingProgram(orderOfKeys: ProgramTypeKeys[] = ['memorial', 'bibleClass', 'sundaySchool']): Promise<Array<{
    type: ProgramTypeKeys
    title: string
    date: string // ISO string from API
    details: Record<string, any>
  }>> {
    try {
      console.log('📅 Fetching upcoming program via unified data service')

      const orderParam = orderOfKeys.join(',')
      const response = await fetch(`${this.baseUrl}/api/upcoming-program?order=${orderParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'default',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Log data source for monitoring
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      const eventCount = response.headers.get('X-Event-Count') || '0'
      console.log(`✅ Upcoming program (${eventCount} events) served from ${dataSource}`)

      return data

    } catch (error) {
      console.error('❌ Error fetching upcoming program:', error)
      throw new Error('Failed to fetch upcoming program data')
    }
  }

  /**
   * User lookup for authentication
   * Replaces userFromLegacy() function
   */
  async lookupUser(email: string): Promise<any> {
    try {
      console.log(`👤 Looking up user: ${email} via unified data service`)

      const response = await fetch(`${this.baseUrl}/api/directory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.status === 404) {
        console.log(`👤 User not found: ${email}`)
        return null
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Log data source for monitoring
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'
      console.log(`✅ User lookup for ${email} served from ${dataSource}`)

      return data.user

    } catch (error) {
      console.error(`❌ Error looking up user ${email}:`, error)
      throw new Error(`Failed to lookup user: ${email}`)
    }
  }

  /**
   * Health check to verify service availability
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: {
      dynamodb: boolean
      googleSheets: boolean
    }
    responseTime: number
  }> {
    const startTime = Date.now()
    
    try {
      // Test a lightweight endpoint
      const response = await fetch(`${this.baseUrl}/api/upcoming-program`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const responseTime = Date.now() - startTime
      const dataSource = response.headers.get('X-Data-Source') || 'unknown'

      return {
        status: response.ok ? 'healthy' : 'degraded',
        services: {
          dynamodb: dataSource.includes('dynamodb'),
          googleSheets: dataSource.includes('google-sheets'),
        },
        responseTime,
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error('❌ Data service health check failed:', error)
      
      return {
        status: 'unhealthy',
        services: {
          dynamodb: false,
          googleSheets: false,
        },
        responseTime,
      }
    }
  }
}

// Create singleton instance for client-side usage
export const dataService = new DataService()

/**
 * React hook for using the data service
 */
export function useDataService() {
  return dataService
}

/**
 * Compatibility functions that match the original API
 * These can be gradually replaced with dataService calls
 */

export async function getGoogleSheet<K extends GoogleSheetTypes>(sheetKey: K): Promise<GoogleSheetData> {
  return dataService.getGoogleSheet(sheetKey)
}

export async function getUpcomingProgram(orderOfKeys: ProgramTypeKeys[] = ['memorial', 'bibleClass', 'sundaySchool']) {
  return dataService.getUpcomingProgram(orderOfKeys)
}

export async function userFromLegacy({ email }: { email: string }) {
  return dataService.lookupUser(email)
}