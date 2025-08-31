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
    this.loadSheetConfiguration()
  }

  private loadSheetConfiguration(): void {
    // FAIL FAST: Config file is REQUIRED
    const configFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    
    if (!configFile) {
      throw new Error(
        'CRITICAL: GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable is not set. ' +
        'This must point to your Google service account JSON file with sheet_ids configuration.'
      )
    }

    try {
      // Only works in Node.js environments
      if (typeof process === 'undefined' || !process.cwd) {
        throw new Error(
          'CRITICAL: GoogleSheetsConfig requires Node.js environment. ' +
          'Cannot load configuration in edge runtime.'
        )
      }

      const fs = require('fs')
      const path = require('path')
      
      // Resolve the config file path
      const configPath = path.isAbsolute(configFile) 
        ? configFile 
        : path.resolve(process.cwd(), configFile)
      
      // FAIL FAST: File must exist
      if (!fs.existsSync(configPath)) {
        throw new Error(
          `CRITICAL: Google service account file not found at: ${configPath}\n` +
          `Expected file specified by GOOGLE_SERVICE_ACCOUNT_KEY_FILE="${configFile}"\n` +
          `To fix:\n` +
          `1. Copy apps/next/tee-services-db47a9e534d3.tmpt.json to ${configFile}\n` +
          `2. Add your Google service account credentials and sheet IDs\n` +
          `3. Ensure the file is NOT committed to git`
        )
      }

      const configContent = fs.readFileSync(configPath, 'utf-8')
      const config: ServiceConfig = JSON.parse(configContent)

      // FAIL FAST: sheet_ids section is required
      if (!config.sheet_ids) {
        throw new Error(
          `CRITICAL: No 'sheet_ids' section found in ${configPath}\n` +
          `The configuration file must contain a 'sheet_ids' object with your Google Sheet mappings.\n` +
          `See apps/next/tee-services-db47a9e534d3.tmpt.json for the expected format.`
        )
      }

      // Build the mappings from the config
      let loadedCount = 0
      Object.entries(config.sheet_ids).forEach(([type, sheetConfig]) => {
        const sheetId = sheetConfig.key
        if (sheetId && !sheetId.startsWith('data/')) { // Skip non-Google Sheet entries
          this.sheetIdToType.set(sheetId, type)
          this.typeToSheetId.set(type, sheetId)
          this.sheetInfoMap.set(type, {
            id: sheetId,
            type,
            name: sheetConfig.name,
            startTime: sheetConfig.startTime
          })
          loadedCount++
        }
      })

      // FAIL FAST: At least one sheet must be configured
      if (loadedCount === 0) {
        throw new Error(
          `CRITICAL: No valid sheet configurations found in ${configPath}\n` +
          `At least one sheet must be configured with a valid 'key' (Google Sheet ID).`
        )
      }

      this.initialized = true
      console.log(`✅ Loaded ${loadedCount} sheet configurations from ${configPath}`)

    } catch (error) {
      // Re-throw with context
      if (error.message.includes('CRITICAL:')) {
        throw error // Already has good context
      }
      throw new Error(
        `CRITICAL: Failed to load Google service account configuration from ${configFile}\n` +
        `Error: ${error.message}`
      )
    }
  }

  // REMOVED: No hardcoded fallback - configuration file is REQUIRED
  // This prevents accidentally exposing private Sheet IDs in public code
  // Each deployment must provide their own configuration file

  /**
   * Get sheet type from Google Sheet ID
   */
  getSheetType(sheetId: string): string | null {
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