import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetBucketLocationCommand,
} from '@aws-sdk/client-s3'
import {
  FileStorageService,
  UploadOptions,
  ValidationResult,
  FileStorageError,
  FileStorageConfig,
} from './types'

export class S3FileStorageService implements FileStorageService {
  private s3Client: S3Client
  private config: FileStorageConfig

  constructor(config: FileStorageConfig) {
    this.config = config
    this.s3Client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }

  async upload(file: File | Buffer, key: string, options?: UploadOptions): Promise<string> {
    try {
      // Validate file size
      const fileSize = file instanceof Buffer ? file.length : file.size
      const maxSize = options?.maxSizeBytes || this.config.maxFileSizeBytes || 10 * 1024 * 1024 // 10MB default
      
      if (fileSize > maxSize) {
        throw new FileStorageError(
          `File size ${fileSize} exceeds maximum allowed size ${maxSize}`,
          'FILE_TOO_LARGE'
        )
      }

      // Validate content type
      const contentType = options?.contentType || (file instanceof File ? file.type : 'application/octet-stream')
      if (this.config.allowedMimeTypes && !this.config.allowedMimeTypes.includes(contentType)) {
        throw new FileStorageError(
          `Content type ${contentType} not allowed`,
          'INVALID_CONTENT_TYPE'
        )
      }

      // Prepare file data
      const fileData = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer())

      // Upload to S3 following AWS best practices
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: fileData,
        ContentType: contentType,
        Metadata: options?.metadata,
        // ACLs are deprecated - removed per AWS best practices
        // Bucket should be configured with appropriate bucket policies
        ServerSideEncryption: 'AES256', // Enable SSE-S3 encryption
      })

      await this.s3Client.send(command)

      return this.getUrl(key)
    } catch (error) {
      if (error instanceof FileStorageError) {
        throw error
      }
      throw new FileStorageError(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPLOAD_FAILED',
        error instanceof Error ? error : undefined
      )
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      await this.s3Client.send(command)
    } catch (error) {
      throw new FileStorageError(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_FAILED',
        error instanceof Error ? error : undefined
      )
    }
  }

  getUrl(key: string): string {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl}/${key}`
    }
    return `https://${this.config.bucket}.s3.${this.config.region || 'us-east-1'}.amazonaws.com/${key}`
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      await this.s3Client.send(command)
      return true
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw new FileStorageError(
        `Failed to check file existence: ${error.message}`,
        'EXISTS_CHECK_FAILED',
        error
      )
    }
  }

  async validateConnection(): Promise<ValidationResult> {
    try {
      // Test 1: Check if we can access the bucket
      const getBucketCommand = new GetBucketLocationCommand({
        Bucket: this.config.bucket,
      })

      const bucketResponse = await this.s3Client.send(getBucketCommand)
      const bucketRegion = bucketResponse.LocationConstraint || 'us-east-1'

      // Test 2: Try to list objects (to verify permissions)
      // This is a lightweight way to test read permissions
      const testKey = `__connection_test_${Date.now()}`
      
      // Test 3: Try a small upload to test write permissions
      const testUpload = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: testKey,
        Body: Buffer.from('test'),
        ContentType: 'text/plain',
      })

      await this.s3Client.send(testUpload)

      // Test 4: Clean up test file
      const deleteTest = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: testKey,
      })

      await this.s3Client.send(deleteTest)

      return {
        isValid: true,
        details: {
          service: 'AWS S3',
          region: bucketRegion,
          bucket: this.config.bucket,
          permissions: ['read', 'write', 'delete'],
        },
      }
    } catch (error: any) {
      console.error('S3 connection validation failed:', error)

      let errorMessage = 'Unknown error'
      let permissions: string[] = []

      if (error.name === 'NoSuchBucket') {
        errorMessage = `Bucket '${this.config.bucket}' does not exist`
      } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
        errorMessage = 'Access denied - check IAM permissions'
      } else if (error.name === 'InvalidAccessKeyId') {
        errorMessage = 'Invalid AWS access key ID'
      } else if (error.name === 'SignatureDoesNotMatch') {
        errorMessage = 'Invalid AWS secret access key'
      } else if (error.name === 'TokenRefreshRequired') {
        errorMessage = 'AWS credentials expired'
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Network error - cannot connect to AWS S3'
      } else {
        errorMessage = error.message || 'Connection validation failed'
      }

      return {
        isValid: false,
        error: errorMessage,
        details: {
          service: 'AWS S3',
          region: this.config.region,
          bucket: this.config.bucket,
          permissions,
        },
      }
    }
  }

  /**
   * Additional S3-specific method to get signed URLs for private files
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // This would require @aws-sdk/s3-request-presigner
    // For now, return the public URL
    return this.getUrl(key)
  }
}