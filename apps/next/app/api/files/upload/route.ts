import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { getFileStorageService } from '../../../../utils/file-storage'
import { generatePdfThumbnail } from '../../../../utils/pdf-thumbnail'
import { randomUUID } from 'crypto'

// PDF rasterization (pdfium WASM init + render + sharp encode) adds a few
// seconds on top of the S3 upload, so give this route headroom beyond the
// default function timeout.
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Require at least member role for file upload
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    // Get file from form data
    const formData = await request.formData() as any
    const file = formData.get('file') as File | null
    const description = (formData.get('description') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (check against service limits)
    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // Generate unique file key
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `${randomUUID()}.${fileExtension}`
    const fileKey = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${uniqueFileName}`

    // Read the file once: we may need the bytes for both the upload and a
    // PDF thumbnail.
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Upload to storage service
    const fileStorage = getFileStorageService()
    const fileUrl = await fileStorage.upload(fileBuffer, fileKey, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        uploadedBy: session.user.id || session.user.email || 'unknown',
        description: description || '',
      }
    })

    // For PDFs, generate a JPEG preview of page 1 so the web/email views can
    // show a real poster image instead of a generic file link. Best-effort —
    // a failure here must not fail the upload.
    let thumbnailUrl: string | undefined
    if (file.type === 'application/pdf') {
      try {
        const thumb = await generatePdfThumbnail(fileBuffer)
        if (thumb) {
          const thumbKey = `${fileKey.replace(/\.[^/.]+$/, '')}-thumb.jpg`
          thumbnailUrl = await fileStorage.upload(thumb, thumbKey, {
            contentType: 'image/jpeg',
            metadata: {
              originalName: `${file.name} (thumbnail)`,
              uploadedBy: session.user.id || session.user.email || 'unknown',
            },
          })
        }
      } catch (thumbError) {
        console.error('PDF thumbnail step failed (continuing without it):', thumbError)
      }
    }

    // Return document attachment object
    const documentAttachment = {
      id: randomUUID(),
      documentType: 'upload' as const,
      fileName: uniqueFileName,
      originalName: file.name,
      fileUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date(),
      uploadedBy: session.user.id || session.user.email || 'unknown',
      description: description || undefined,
      editable: false, // Uploaded files have fixed names
      thumbnailUrl,
    }

    return NextResponse.json({
      success: true,
      document: documentAttachment
    })

  } catch (error) {
    console.error('File upload error:', error)
    
    if (error instanceof Error && error.message.includes('FILE_TOO_LARGE')) {
      return NextResponse.json({ error: 'File size exceeds limit' }, { status: 413 })
    }
    
    if (error instanceof Error && error.message.includes('INVALID_CONTENT_TYPE')) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
    }

    return NextResponse.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}