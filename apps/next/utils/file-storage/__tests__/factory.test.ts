import { createFileStorageService, getFileStorageService, resetFileStorageService } from '../factory'
import { S3FileStorageService } from '../s3-service'

// Mock the config module
jest.mock('../config', () => ({
  getFileStorageConfig: jest.fn(() => ({
    provider: 's3',
    bucket: 'test-bucket',
    region: 'us-east-1',
    maxFileSizeBytes: 10485760,
    allowedMimeTypes: ['application/pdf']
  }))
}))

// Mock the S3 service
jest.mock('../s3-service')

describe('File Storage Factory', () => {
  beforeEach(() => {
    resetFileStorageService()
    jest.clearAllMocks()
  })

  describe('createFileStorageService', () => {
    it('should create S3 service by default', () => {
      const service = createFileStorageService()
      expect(service).toBeInstanceOf(S3FileStorageService)
    })

    it('should create S3 service when explicitly requested', () => {
      const service = createFileStorageService('s3')
      expect(service).toBeInstanceOf(S3FileStorageService)
    })

    it('should throw error for unimplemented providers', () => {
      expect(() => createFileStorageService('cloudflare')).toThrow('Cloudflare storage provider not yet implemented')
      expect(() => createFileStorageService('google')).toThrow('Google Cloud storage provider not yet implemented')
      expect(() => createFileStorageService('local')).toThrow('Local storage provider not yet implemented')
    })

    it('should throw error for unknown provider', () => {
      expect(() => createFileStorageService('unknown' as any)).toThrow('Unknown file storage provider: unknown')
    })
  })

  describe('getFileStorageService', () => {
    it('should return singleton instance', () => {
      const service1 = getFileStorageService()
      const service2 = getFileStorageService()
      
      expect(service1).toBe(service2)
      expect(service1).toBeInstanceOf(S3FileStorageService)
    })

    it('should create new instance after reset', () => {
      const service1 = getFileStorageService()
      resetFileStorageService()
      const service2 = getFileStorageService()
      
      expect(service1).not.toBe(service2)
      expect(service2).toBeInstanceOf(S3FileStorageService)
    })
  })
})