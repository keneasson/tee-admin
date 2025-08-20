import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { validateFileStorage } from '../../../../../utils/file-storage'
import { validateFileStorageEnvironment, getFileStorageEnvDocs } from '../../../../../utils/file-storage/config'

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== ROLES.OWNER && userRole !== ROLES.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Step 1: Validate environment configuration
    const envValidation = validateFileStorageEnvironment()
    if (!envValidation.isValid) {
      return NextResponse.json({
        isValid: false,
        step: 'environment',
        error: 'Environment configuration invalid',
        details: envValidation.errors,
        help: getFileStorageEnvDocs()
      }, { status: 400 })
    }

    // Step 2: Test actual AWS connection and permissions
    const connectionResult = await validateFileStorage()
    
    return NextResponse.json({
      isValid: connectionResult.isValid,
      step: connectionResult.isValid ? 'complete' : 'connection',
      error: connectionResult.error,
      details: connectionResult.details,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('File storage validation error:', error)
    
    return NextResponse.json({
      isValid: false,
      step: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}