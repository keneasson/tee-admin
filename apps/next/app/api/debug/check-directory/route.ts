import { NextResponse } from 'next/server'
import { getGoogleSheet } from '@my/app/provider/get-google-sheet'
import type { GoogleSheetDirectory } from '@my/app/types'

export async function GET() {
  try {
    console.log('🔍 Fetching Google Sheets directory...')

    const { content } = (await getGoogleSheet('directory')) as GoogleSheetDirectory

    console.log('📋 Directory loaded with', content.length, 'entries')

    // Find entries that contain ken.easson
    const kenEntries = content.filter(
      (row) => row.Email && row.Email.toLowerCase().includes('ken.easson')
    )

    console.log('🔍 Found entries for Ken:', kenEntries.length)

    // Sample of first 5 entries for debugging
    const sample = content.slice(0, 5).map((row) => ({
      FirstName: row.FirstName,
      LastName: row.LastName,
      Email: row.Email,
      ecclesia: row.ecclesia,
    }))

    return NextResponse.json({
      success: true,
      totalEntries: content.length,
      kenEntries: kenEntries.map((row) => ({
        FirstName: row.FirstName,
        LastName: row.LastName,
        Email: row.Email,
        ecclesia: row.ecclesia,
      })),
      sampleEntries: sample,
    })
  } catch (error) {
    console.error('❌ Error checking directory:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
