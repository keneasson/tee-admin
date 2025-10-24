import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'

/**
 * POST /api/admin/google-docs/import
 *
 * Import a Google Doc by URL:
 * - Extracts document ID from URL
 * - Fetches document title from public HTML (no API needed!)
 * - Returns document metadata for adding to event documents
 *
 * Request body:
 * {
 *   "url": "https://docs.google.com/document/d/..."
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "document": {
 *     "id": "document-id",
 *     "documentType": "google-doc",
 *     "fileName": "document-id",
 *     "originalName": "Document Title",
 *     "fileUrl": "https://docs.google.com/document/d/...",
 *     "fileSize": 0,
 *     "mimeType": "application/vnd.google-apps.document",
 *     "uploadedAt": "2025-10-23T...",
 *     "uploadedBy": "user@example.com",
 *     "editable": true
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Owner role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Extract document ID and type from URL
    const docInfo = extractDocumentInfo(url)
    if (!docInfo) {
      return NextResponse.json(
        { error: 'Invalid Google Docs URL. Please provide a valid Google Docs, Sheets, or Slides link.' },
        { status: 400 }
      )
    }

    // Try to fetch document title from public HTML
    console.log(`📄 Fetching title for ${docInfo.type}: ${docInfo.id}`)
    const title = await fetchDocumentTitle(docInfo.viewUrl)

    console.log(`✅ Retrieved document title: "${title}"`)

    // Create document attachment object
    const document = {
      id: `google-doc-${docInfo.id}-${Date.now()}`,
      documentType: 'google-doc' as const,
      fileName: docInfo.id,
      originalName: title,
      fileUrl: docInfo.viewUrl,
      fileSize: 0,
      mimeType: docInfo.mimeType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user.email,
      editable: true,
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error) {
    console.error('❌ Google Doc import error:', error)

    return NextResponse.json(
      {
        error: 'Failed to import Google Doc',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Extract document ID and info from various Google Docs URL formats:
 * - https://docs.google.com/document/d/DOCUMENT_ID/edit
 * - https://docs.google.com/spreadsheets/d/DOCUMENT_ID
 * - https://docs.google.com/presentation/d/DOCUMENT_ID
 */
function extractDocumentInfo(url: string): {
  id: string
  type: 'document' | 'spreadsheet' | 'presentation'
  viewUrl: string
  mimeType: string
} | null {
  // Try to match Google Docs URL pattern
  const docsMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
  if (docsMatch) {
    const id = docsMatch[1]
    return {
      id,
      type: 'document',
      viewUrl: `https://docs.google.com/document/d/${id}/edit`,
      mimeType: 'application/vnd.google-apps.document',
    }
  }

  // Try to match Google Sheets URL pattern
  const sheetsMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (sheetsMatch) {
    const id = sheetsMatch[1]
    return {
      id,
      type: 'spreadsheet',
      viewUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }
  }

  // Try to match Google Slides URL pattern
  const slidesMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/)
  if (slidesMatch) {
    const id = slidesMatch[1]
    return {
      id,
      type: 'presentation',
      viewUrl: `https://docs.google.com/presentation/d/${id}/edit`,
      mimeType: 'application/vnd.google-apps.presentation',
    }
  }

  return null
}

/**
 * Fetch document title from public HTML
 * No API keys needed - just fetches the public page and parses the title
 */
async function fetchDocumentTitle(viewUrl: string): Promise<string> {
  try {
    // Fetch the public HTML of the document
    const response = await fetch(viewUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    })

    if (!response.ok) {
      console.warn(`⚠️ Could not fetch document HTML (${response.status}), using default title`)
      return 'Google Document'
    }

    const html = await response.text()

    // Try multiple methods to extract the title
    // Method 1: <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      // Google Docs titles often have " - Google Docs" appended
      let title = titleMatch[1]
        .replace(/ - Google (Docs|Sheets|Slides)$/i, '')
        .trim()

      if (title && title !== 'Google Docs' && title !== 'Google Sheets' && title !== 'Google Slides') {
        return title
      }
    }

    // Method 2: Open Graph meta tag
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i)
    if (ogTitleMatch && ogTitleMatch[1]) {
      return ogTitleMatch[1].trim()
    }

    // Method 3: Look for document title in JavaScript
    const docTitleMatch = html.match(/"title":"([^"]+)"/i)
    if (docTitleMatch && docTitleMatch[1]) {
      return docTitleMatch[1].trim()
    }

    // Default if we can't find the title
    console.warn(`⚠️ Could not extract title from HTML, using default`)
    return 'Google Document'
  } catch (error) {
    console.error(`❌ Error fetching document title:`, error)
    return 'Google Document'
  }
}
