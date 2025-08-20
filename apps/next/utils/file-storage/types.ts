export interface FileStorageService {
  /**
   * Upload a file to storage
   * @param file - The file to upload
   * @param key - Storage key/path for the file
   * @param options - Optional upload configuration
   * @returns Promise with the public URL of the uploaded file
   */
  upload(file: File | Buffer, key: string, options?: UploadOptions): Promise<string>

  /**
   * Delete a file from storage
   * @param key - Storage key/path of the file to delete
   */
  delete(key: string): Promise<void>

  /**
   * Get the public URL for a file
   * @param key - Storage key/path of the file
   * @returns Public URL to access the file
   */
  getUrl(key: string): string

  /**
   * Check if a file exists in storage
   * @param key - Storage key/path of the file
   * @returns Promise with boolean indicating if file exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Validate that the storage service is properly configured and accessible
   * @returns Promise with validation result
   */
  validateConnection(): Promise<ValidationResult>
}

export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
  public?: boolean
  maxSizeBytes?: number
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  details?: {
    service: string
    region?: string
    bucket?: string
    permissions?: string[]
  }
}

export type FileStorageProvider = 's3' | 'cloudflare' | 'google' | 'local'

export interface FileStorageConfig {
  provider: FileStorageProvider
  bucket: string
  region?: string
  publicBaseUrl?: string
  maxFileSizeBytes?: number
  allowedMimeTypes?: string[]
}

export class FileStorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'FileStorageError'
  }
}