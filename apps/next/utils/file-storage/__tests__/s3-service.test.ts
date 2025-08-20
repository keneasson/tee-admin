import { S3FileStorageService } from '../s3-service'
import { FileStorageConfig, FileStorageError } from '../types'

// Mock AWS SDK
const mockSend = jest.fn()
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetBucketLocationCommand: jest.fn()
}))

describe('S3FileStorageService', () => {
  let service: S3FileStorageService
  let config: FileStorageConfig

  beforeEach(() => {
    config = {
      provider: 's3',
      bucket: 'test-bucket',
      region: 'us-east-1',
      maxFileSizeBytes: 1024 * 1024, // 1MB
      allowedMimeTypes: ['text/plain', 'application/pdf']
    }

    service = new S3FileStorageService(config)
    mockSend.mockClear()
  })

  describe('upload', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      mockSend.mockResolvedValueOnce({}) // S3 upload success

      const result = await service.upload(mockFile, 'test/file.txt')

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test/file.txt')
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should throw error for file too large', async () => {
      const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB
      const mockFile = new File([largeContent], 'large.txt', { type: 'text/plain' })

      await expect(service.upload(mockFile, 'test/large.txt')).rejects.toThrow(FileStorageError)
      await expect(service.upload(mockFile, 'test/large.txt')).rejects.toThrow('exceeds maximum allowed size')
    })

    it('should throw error for invalid content type', async () => {
      const mockFile = new File(['test'], 'test.exe', { type: 'application/x-executable' })

      await expect(service.upload(mockFile, 'test/file.exe')).rejects.toThrow(FileStorageError)
      await expect(service.upload(mockFile, 'test/file.exe')).rejects.toThrow('Content type application/x-executable not allowed')
    })

    it('should handle S3 upload errors', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      mockSend.mockRejectedValueOnce(new Error('S3 error'))

      await expect(service.upload(mockFile, 'test/file.txt')).rejects.toThrow(FileStorageError)
      await expect(service.upload(mockFile, 'test/file.txt')).rejects.toThrow('Failed to upload file')
    })
  })

  describe('delete', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValueOnce({})

      await service.delete('test/file.txt')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should handle delete errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Delete failed'))

      await expect(service.delete('test/file.txt')).rejects.toThrow(FileStorageError)
      await expect(service.delete('test/file.txt')).rejects.toThrow('Failed to delete file')
    })
  })

  describe('exists', () => {
    it('should return true for existing file', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await service.exists('test/file.txt')

      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return false for non-existing file', async () => {
      const notFoundError = new Error('Not found')
      notFoundError.name = 'NotFound'
      mockSend.mockRejectedValueOnce(notFoundError)

      const result = await service.exists('test/missing.txt')

      expect(result).toBe(false)
    })

    it('should return false for 404 status code', async () => {
      const notFoundError = new Error('Not found')
      ;(notFoundError as any).$metadata = { httpStatusCode: 404 }
      mockSend.mockRejectedValueOnce(notFoundError)

      const result = await service.exists('test/missing.txt')

      expect(result).toBe(false)
    })

    it('should throw error for other errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access denied'))

      await expect(service.exists('test/file.txt')).rejects.toThrow(FileStorageError)
    })
  })

  describe('getUrl', () => {
    it('should return S3 URL by default', () => {
      const url = service.getUrl('test/file.txt')
      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test/file.txt')
    })

    it('should use custom public base URL when configured', () => {
      const customConfig = { ...config, publicBaseUrl: 'https://cdn.example.com' }
      const customService = new S3FileStorageService(customConfig)

      const url = customService.getUrl('test/file.txt')
      expect(url).toBe('https://cdn.example.com/test/file.txt')
    })
  })

  describe('validateConnection', () => {
    it('should return valid result on successful validation', async () => {
      // Mock successful bucket location check
      mockSend.mockResolvedValueOnce({ LocationConstraint: 'us-east-1' })
      // Mock successful test upload
      mockSend.mockResolvedValueOnce({})
      // Mock successful test delete
      mockSend.mockResolvedValueOnce({})

      const result = await service.validateConnection()

      expect(result.isValid).toBe(true)
      expect(result.details?.service).toBe('AWS S3')
      expect(result.details?.region).toBe('us-east-1')
      expect(result.details?.permissions).toContain('read')
      expect(result.details?.permissions).toContain('write')
      expect(result.details?.permissions).toContain('delete')
      expect(mockSend).toHaveBeenCalledTimes(3)
    })

    it('should handle access denied errors', async () => {
      const accessError = new Error('Access denied')
      accessError.name = 'AccessDenied'
      mockSend.mockRejectedValueOnce(accessError)

      const result = await service.validateConnection()

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Access denied - check IAM permissions')
    })

    it('should handle invalid credentials', async () => {
      const credError = new Error('Invalid key')
      credError.name = 'InvalidAccessKeyId'
      mockSend.mockRejectedValueOnce(credError)

      const result = await service.validateConnection()

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid AWS access key ID')
    })

    it('should handle bucket not found', async () => {
      const bucketError = new Error('Bucket not found')
      bucketError.name = 'NoSuchBucket'
      mockSend.mockRejectedValueOnce(bucketError)

      const result = await service.validateConnection()

      expect(result.isValid).toBe(false)
      expect(result.error).toBe("Bucket 'test-bucket' does not exist")
    })
  })
})