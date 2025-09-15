import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { getFileStorageService } from '../../../../utils/file-storage'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const description = formData.get('description') as string

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

    // Upload to storage service
    const fileStorage = getFileStorageService()
    const fileUrl = await fileStorage.upload(file, fileKey, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        uploadedBy: session.user.id || session.user.email || 'unknown',
        description: description || '',
      }
    })

    // Return document attachment object
    const documentAttachment = {
      id: randomUUID(),
      fileName: uniqueFileName,
      originalName: file.name,
      fileUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date(),
      uploadedBy: session.user.id || session.user.email || 'unknown',
      description: description || undefined,
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