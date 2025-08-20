import { FileStorageService, FileStorageProvider } from './types'
import { S3FileStorageService } from './s3-service'
import { getFileStorageConfig } from './config'

/**
 * Factory function to create file storage service instances
 */
export function createFileStorageService(provider?: FileStorageProvider): FileStorageService {
  const config = getFileStorageConfig()
  const serviceProvider = provider || config.provider

  switch (serviceProvider) {
    case 's3':
      return new S3FileStorageService(config)
    
    case 'cloudflare':
      // TODO: Implement CloudflareFileStorageService
      throw new Error('Cloudflare storage provider not yet implemented')
    
    case 'google':
      // TODO: Implement GoogleCloudStorageService
      throw new Error('Google Cloud storage provider not yet implemented')
    
    case 'local':
      // TODO: Implement LocalFileStorageService
      throw new Error('Local storage provider not yet implemented')
    
    default:
      throw new Error(`Unknown file storage provider: ${serviceProvider}`)
  }
}

/**
 * Singleton file storage service instance
 */
let fileStorageInstance: FileStorageService | null = null

/**
 * Get the default file storage service instance
 */
export function getFileStorageService(): FileStorageService {
  if (!fileStorageInstance) {
    fileStorageInstance = createFileStorageService()
  }
  return fileStorageInstance
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetFileStorageService(): void {
  fileStorageInstance = null
}

/**
 * Validate that the file storage service is properly configured
 */
export async function validateFileStorage(): Promise<{ isValid: boolean; error?: string; details?: any }> {
  try {
    const service = getFileStorageService()
    const result = await service.validateConnection()
    
    return {
      isValid: result.isValid,
      error: result.error,
      details: result.details
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: null
    }
  }
}