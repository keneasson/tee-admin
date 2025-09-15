// Export all file storage types and interfaces
export type {
  FileStorageService,
  FileStorageProvider,
  FileStorageConfig,
  UploadOptions,
  ValidationResult,
} from './types'

export { FileStorageError } from './types'

// Export configuration utilities
export {
  getFileStorageConfig,
  validateFileStorageEnvironment,
  getFileStorageEnvDocs,
} from './config'

// Export factory functions
export {
  createFileStorageService,
  getFileStorageService,
  resetFileStorageService,
  validateFileStorage,
} from './factory'

// Export service implementations
export { S3FileStorageService } from './s3-service'

// Convenience exports for common usage patterns
export { getFileStorageService as fileStorage } from './factory'