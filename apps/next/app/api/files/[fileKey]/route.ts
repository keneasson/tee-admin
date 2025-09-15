import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { getFileStorageService } from '../../../../../utils/file-storage'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { fileKey: string } }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileKey } = params

    if (!fileKey) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 })
    }

    // Decode the file key (in case it's URL encoded)
    const decodedFileKey = decodeURIComponent(fileKey)

    // Delete from storage service
    const fileStorage = getFileStorageService()
    await fileStorage.delete(decodedFileKey)

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('File deletion error:', error)

    return NextResponse.json({
      error: 'Deletion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fileKey: string } }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileKey } = params

    if (!fileKey) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 })
    }

    // Decode the file key (in case it's URL encoded)
    const decodedFileKey = decodeURIComponent(fileKey)

    // Check if file exists
    const fileStorage = getFileStorageService()
    const exists = await fileStorage.exists(decodedFileKey)

    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get file URL
    const fileUrl = fileStorage.getUrl(decodedFileKey)

    return NextResponse.json({
      exists: true,
      fileUrl
    })

  } catch (error) {
    console.error('File check error:', error)

    return NextResponse.json({
      error: 'File check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}