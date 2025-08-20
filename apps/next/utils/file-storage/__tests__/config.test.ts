import { getFileStorageConfig, validateFileStorageEnvironment } from '../config'

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  // Reset environment
  process.env = { ...originalEnv }
})

afterAll(() => {
  // Restore original environment
  process.env = originalEnv
})

describe('File Storage Config', () => {
  describe('getFileStorageConfig', () => {
    it('should return default S3 config with minimal environment', () => {
      process.env.FILE_STORAGE_BUCKET = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

      const config = getFileStorageConfig()

      expect(config).toEqual({
        provider: 's3',
        bucket: 'test-bucket',
        region: 'us-east-1',
        publicBaseUrl: undefined,
        maxFileSizeBytes: 10485760, // 10MB
        allowedMimeTypes: expect.arrayContaining(['application/pdf', 'image/jpeg', 'image/png'])
      })
    })

    it('should use custom environment variables', () => {
      process.env.FILE_STORAGE_PROVIDER = 'cloudflare'
      process.env.FILE_STORAGE_BUCKET = 'custom-bucket'
      process.env.AWS_REGION = 'eu-west-1'
      process.env.FILE_STORAGE_PUBLIC_URL = 'https://cdn.example.com'
      process.env.FILE_STORAGE_MAX_SIZE = '5242880' // 5MB
      process.env.FILE_STORAGE_ALLOWED_TYPES = 'application/pdf,image/jpeg'

      const config = getFileStorageConfig()

      expect(config).toEqual({
        provider: 'cloudflare',
        bucket: 'custom-bucket',
        region: 'eu-west-1',
        publicBaseUrl: 'https://cdn.example.com',
        maxFileSizeBytes: 5242880,
        allowedMimeTypes: ['application/pdf', 'image/jpeg']
      })
    })

    it('should throw error when bucket is missing', () => {
      delete process.env.FILE_STORAGE_BUCKET

      expect(() => getFileStorageConfig()).toThrow('FILE_STORAGE_BUCKET environment variable is required')
    })

    it('should throw error when AWS credentials are missing for S3', () => {
      process.env.FILE_STORAGE_BUCKET = 'test-bucket'
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY

      expect(() => getFileStorageConfig()).toThrow('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required for S3 storage')
    })
  })

  describe('validateFileStorageEnvironment', () => {
    it('should return valid for correct S3 configuration', () => {
      process.env.FILE_STORAGE_BUCKET = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

      const result = validateFileStorageEnvironment()

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should return errors for missing configuration', () => {
      delete process.env.FILE_STORAGE_BUCKET
      delete process.env.AWS_ACCESS_KEY_ID

      const result = validateFileStorageEnvironment()

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('FILE_STORAGE_BUCKET environment variable is required')
    })

    it('should validate invalid provider', () => {
      process.env.FILE_STORAGE_PROVIDER = 'invalid-provider'
      process.env.FILE_STORAGE_BUCKET = 'test-bucket'

      const result = validateFileStorageEnvironment()

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid FILE_STORAGE_PROVIDER: invalid-provider. Must be one of: s3, cloudflare, google, local')
    })

    it('should validate invalid max size', () => {
      process.env.FILE_STORAGE_BUCKET = 'test-bucket'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.FILE_STORAGE_MAX_SIZE = 'invalid'

      const result = validateFileStorageEnvironment()

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('FILE_STORAGE_MAX_SIZE must be a positive number in bytes')
    })
  })
})