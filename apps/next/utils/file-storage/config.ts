import { FileStorageConfig, FileStorageProvider } from './types'

/**
 * File storage configuration settings
 */
export function getFileStorageConfig(): FileStorageConfig {
  const provider = (process.env.FILE_STORAGE_PROVIDER || 's3') as FileStorageProvider
  
  const config: FileStorageConfig = {
    provider,
    bucket: process.env.FILE_STORAGE_BUCKET || 'tee-admin-files',
    region: process.env.AWS_REGION || 'ca-central-1',
    publicBaseUrl: process.env.FILE_STORAGE_PUBLIC_URL,
    maxFileSizeBytes: parseInt(process.env.FILE_STORAGE_MAX_SIZE || '10485760'), // 10MB default
    allowedMimeTypes: process.env.FILE_STORAGE_ALLOWED_TYPES 
      ? process.env.FILE_STORAGE_ALLOWED_TYPES.split(',').map(type => type.trim())
      : [
          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Text files
          'text/plain',
          'text/csv',
          'text/rtf',
          // Images
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          // Audio
          'audio/mpeg',
          'audio/wav',
          'audio/mp4',
          // Video
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
        ]
  }

  // Note: bucket has a default value, so this validation is optional
  // You can set FILE_STORAGE_BUCKET to override the default 'tee-admin-files'

  if (provider === 's3') {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for S3 storage')
    }
  }

  return config
}

/**
 * Validates file storage environment configuration
 */
export function validateFileStorageEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    getFileStorageConfig()
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message)
    }
  }

  // Additional validation
  const provider = process.env.FILE_STORAGE_PROVIDER || 's3'
  
  if (!['s3', 'cloudflare', 'google', 'local'].includes(provider)) {
    errors.push(`Invalid FILE_STORAGE_PROVIDER: ${provider}. Must be one of: s3, cloudflare, google, local`)
  }

  const maxSize = process.env.FILE_STORAGE_MAX_SIZE
  if (maxSize && (isNaN(parseInt(maxSize)) || parseInt(maxSize) <= 0)) {
    errors.push('FILE_STORAGE_MAX_SIZE must be a positive number in bytes')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get file storage environment variables documentation
 */
export function getFileStorageEnvDocs() {
  return {
    required: {
      FILE_STORAGE_BUCKET: 'Storage bucket name (required)',
      AWS_ACCESS_KEY_ID: 'AWS access key ID (required for S3)',
      AWS_SECRET_ACCESS_KEY: 'AWS secret access key (required for S3)',
    },
    optional: {
      FILE_STORAGE_PROVIDER: 'Storage provider (s3, cloudflare, google, local). Default: s3',
      AWS_REGION: 'AWS region for S3. Default: us-east-1',
      FILE_STORAGE_PUBLIC_URL: 'Public base URL for files (CDN). Default: S3 bucket URL',
      FILE_STORAGE_MAX_SIZE: 'Maximum file size in bytes. Default: 10485760 (10MB)',
      FILE_STORAGE_ALLOWED_TYPES: 'Comma-separated list of allowed MIME types. Default: common document/image types',
    },
    examples: {
      FILE_STORAGE_PROVIDER: 's3',
      FILE_STORAGE_BUCKET: 'tee-admin-files',
      AWS_REGION: 'us-east-1',
      FILE_STORAGE_PUBLIC_URL: 'https://files.tee-admin.com',
      FILE_STORAGE_MAX_SIZE: '10485760',
      FILE_STORAGE_ALLOWED_TYPES: 'application/pdf,image/jpeg,image/png,text/plain',
    }
  }
}