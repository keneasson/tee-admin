/**
 * Centralized Google Sheets configuration service
 * This is the SINGLE source of truth for sheet IDs and types
 * NO environment variables should be used for sheet configuration
 */

// Use dynamic imports for Node.js modules to work in both server and edge runtime

export interface SheetInfo {
  id: string
  type: string
  name: string
  startTime?: string
}

interface ServiceConfig {
  sheet_ids: {
    [key: string]: {
      name: string
      startTime?: string
      key: string
    }
  }
  [key: string]: any
}

export class GoogleSheetsConfig {
  private static instance: GoogleSheetsConfig
  private sheetIdToType: Map<string, string> = new Map()
  private typeToSheetId: Map<string, string> = new Map()
  private sheetInfoMap: Map<string, SheetInfo> = new Map()
  private initialized = false

  static getInstance(): GoogleSheetsConfig {
    if (!GoogleSheetsConfig.instance) {
      GoogleSheetsConfig.instance = new GoogleSheetsConfig()
    }
    return GoogleSheetsConfig.instance
  }

  private constructor() {
    // Defer loadSheetConfiguration() until first method call so that
    // simply importing this module doesn't throw if the env var is
    // unavailable (e.g. during Next.js's build-time page-data collection).
  }

  private ensureLoaded(): void {
    if (!this.initialized) {
      this.loadSheetConfiguration()
    }
  }

  private loadSheetConfiguration(): void {
    const envValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!envValue) {
      throw new Error(
        'CRITICAL: GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set. ' +
        'This must contain the full Google service account JSON (credentials + sheet_ids) as a single-line string. ' +
        'For local dev, add it to apps/next/.env.local.'
      )
    }

    let config: ServiceConfig
    try {
      config = JSON.parse(envValue) as ServiceConfig
    } catch (e) {
      throw new Error(
        `CRITICAL: GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ${(e as Error).message}`
      )
    }

    if (!config.sheet_ids) {
      throw new Error(
        `CRITICAL: No 'sheet_ids' section found in GOOGLE_SERVICE_ACCOUNT_KEY. ` +
        `The configuration must contain a 'sheet_ids' object with your Google Sheet mappings.`
      )
    }

    let loadedCount = 0
    Object.entries(config.sheet_ids).forEach(([type, sheetConfig]) => {
      const sheetId = sheetConfig.key
      if (sheetId && !sheetId.startsWith('data/')) {
        this.sheetIdToType.set(sheetId, type)
        this.typeToSheetId.set(type, sheetId)
        this.sheetInfoMap.set(type, {
          id: sheetId,
          type,
          name: sheetConfig.name,
          startTime: sheetConfig.startTime,
        })
        loadedCount++
      }
    })

    if (loadedCount === 0) {
      throw new Error(
        `CRITICAL: No valid sheet configurations found in GOOGLE_SERVICE_ACCOUNT_KEY. ` +
        `At least one sheet must be configured with a valid 'key' (Google Sheet ID).`
      )
    }

    this.initialized = true
    console.log(`✅ Loaded ${loadedCount} sheet configurations from GOOGLE_SERVICE_ACCOUNT_KEY`)
  }

  // REMOVED: No hardcoded fallback - configuration file is REQUIRED
  // This prevents accidentally exposing private Sheet IDs in public code
  // Each deployment must provide their own configuration file

  /**
   * Get sheet type from Google Sheet ID
   */
  getSheetType(sheetId: string): string | null {
    this.ensureLoaded()
    if (!this.initialized) {
      console.error('❌ GoogleSheetsConfig not initialized')
      return null
    }
    return this.sheetIdToType.get(sheetId) || null
  }

  /**
   * Get Google Sheet ID from sheet type
   */
  getSheetId(type: string): string | null {
    this.ensureLoaded()
    if (!this.initialized) {
      console.error('❌ GoogleSheetsConfig not initialized')
      return null
    }
    return this.typeToSheetId.get(type) || null
  }

  /**
   * Get all configured sheets
   */
  getAllSheets(): SheetInfo[] {
    this.ensureLoaded()
    if (!this.initialized) {
      console.error('❌ GoogleSheetsConfig not initialized')
      return []
    }
    return Array.from(this.sheetInfoMap.values())
  }

  /**
   * Check if a sheet type is configured
   */
  isSheetConfigured(type: string): boolean {
    this.ensureLoaded()
    if (!this.initialized) {
      console.error('❌ GoogleSheetsConfig not initialized')
      return false
    }
    return this.typeToSheetId.has(type)
  }

  /**
   * Get sheet info by type
   */
  getSheetInfo(type: string): SheetInfo | null {
    this.ensureLoaded()
    if (!this.initialized) {
      console.error('❌ GoogleSheetsConfig not initialized')
      return null
    }
    return this.sheetInfoMap.get(type) || null
  }

  /**
   * Map sheet type to DynamoDB format (for schedule types)
   * memorial -> MEMORIAL
   * sundaySchool -> SUNDAYSCHOOL
   * bibleClass -> BIBLECLASS
   */
  mapToDynamoDBType(type: string): string {
    const mappings: Record<string, string> = {
      'memorial': 'MEMORIAL',
      'sundaySchool': 'SUNDAYSCHOOL',
      'bibleClass': 'BIBLECLASS',
      'directory': 'DIRECTORY',
      'testSync': 'SUNDAYSCHOOL' // Test sync uses Sunday School format
    }
    return mappings[type] || type.toUpperCase()
  }
}

// Export singleton instance
export const googleSheetsConfig = GoogleSheetsConfig.getInstance()