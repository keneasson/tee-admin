import { google } from 'googleapis'

interface SheetMetadata {
  modifiedTime: string
  sheets?: Array<{
    properties?: {
      gridProperties?: {
        rowCount: number
        columnCount: number
      }
    }
  }>
}

export class GoogleSheetsService {
  private sheets: any
  private drive: any

  constructor() {
    // Initialize Google APIs with service account
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    
    let auth: any
    if (keyFile && keyFile.startsWith('./')) {
      // Use key file path (for production)
      auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
        ],
      })
    } else {
      // Use service account email and key from environment (fallback)
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      
      if (serviceAccountEmail && privateKey) {
        const credentials = {
          client_email: serviceAccountEmail,
          private_key: privateKey,
        }
        
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
          ],
        })
      } else {
        throw new Error('Google Service Account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY')
      }
    }

    this.sheets = google.sheets({ version: 'v4', auth })
    this.drive = google.drive({ version: 'v3', auth })
  }

  /**
   * Get data from a Google Sheet
   */
  async getSheetData(sheetId: string, range: string = 'A:Z'): Promise<any[][]> {
    try {
      console.log(`📊 Fetching data from sheet ${sheetId}, range: ${range}`)
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      })

      const rows = response.data.values || []
      console.log(`📈 Retrieved ${rows.length} rows from sheet ${sheetId}`)
      
      return rows
    } catch (error) {
      console.error(`❌ Error fetching sheet data for ${sheetId}:`, error)
      throw new Error(`Failed to fetch sheet data: ${error}`)
    }
  }

  /**
   * Get sheet metadata for version checking
   */
  async getSheetMetadata(sheetId: string): Promise<SheetMetadata> {
    try {
      console.log(`📋 Fetching metadata for sheet ${sheetId}`)
      
      // Get file metadata from Drive API
      const driveResponse = await this.drive.files.get({
        fileId: sheetId,
        fields: 'modifiedTime',
      })

      // Get sheet properties from Sheets API
      const sheetsResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties.gridProperties',
      })

      const metadata: SheetMetadata = {
        modifiedTime: driveResponse.data.modifiedTime,
        sheets: sheetsResponse.data.sheets,
      }

      console.log(`📊 Sheet ${sheetId} metadata:`, {
        modifiedTime: metadata.modifiedTime,
        sheetCount: metadata.sheets?.length || 0,
      })

      return metadata
    } catch (error) {
      console.error(`❌ Error fetching sheet metadata for ${sheetId}:`, error)
      throw new Error(`Failed to fetch sheet metadata: ${error}`)
    }
  }

  /**
   * Get specific range data with column headers
   */
  async getSheetDataWithHeaders(
    sheetId: string, 
    range: string = 'A:Z'
  ): Promise<{ headers: string[]; rows: any[][] }> {
    try {
      const allData = await this.getSheetData(sheetId, range)
      
      if (allData.length === 0) {
        return { headers: [], rows: [] }
      }

      const headers = allData[0] || []
      const rows = allData.slice(1)

      console.log(`📋 Sheet ${sheetId} has ${headers.length} columns and ${rows.length} data rows`)
      
      return { headers, rows }
    } catch (error) {
      console.error(`❌ Error fetching sheet data with headers for ${sheetId}:`, error)
      throw error
    }
  }

  /**
   * Get data from multiple sheets in a spreadsheet
   */
  async getMultiSheetData(
    sheetId: string, 
    sheetNames: string[]
  ): Promise<Record<string, any[][]>> {
    try {
      console.log(`📊 Fetching data from ${sheetNames.length} sheets in ${sheetId}`)
      
      const results: Record<string, any[][]> = {}
      
      // Fetch all sheets in parallel
      const promises = sheetNames.map(async (sheetName) => {
        const range = `${sheetName}!A:Z`
        const data = await this.getSheetData(sheetId, range)
        return { sheetName, data }
      })

      const responses = await Promise.all(promises)
      
      responses.forEach(({ sheetName, data }) => {
        results[sheetName] = data
      })

      console.log(`✅ Successfully fetched data from ${Object.keys(results).length} sheets`)
      
      return results
    } catch (error) {
      console.error(`❌ Error fetching multi-sheet data for ${sheetId}:`, error)
      throw error
    }
  }

  /**
   * Test connection to Google Sheets API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test auth by making a simple request to spreadsheets API
      // We'll use one of the known sheet IDs from our configuration
      const testSheetId = process.env.MEMORIAL_SHEET_ID || '1rRluyfllvMv50GRQ2ATmG7kVA_n-Pmyo_dxRFPYn0yg'
      
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: testSheetId,
        fields: 'properties.title',
      })

      console.log('✅ Google Sheets API connection successful')
      console.log(`📊 Test sheet: ${response.data.properties?.title}`)
      return true
    } catch (error) {
      console.error('❌ Google Sheets API connection failed:', error)
      return false
    }
  }

  /**
   * Get all spreadsheets accessible to the service account
   */
  async listAccessibleSheets(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        pageSize: 100,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
      })

      const sheets = response.data.files || []
      console.log(`📊 Found ${sheets.length} accessible spreadsheets`)
      
      return sheets.map(sheet => ({
        id: sheet.id!,
        name: sheet.name!,
        modifiedTime: sheet.modifiedTime!,
      }))
    } catch (error) {
      console.error('❌ Error listing accessible sheets:', error)
      throw error
    }
  }
}