// Test setup file for Vitest
import { vi } from 'vitest'

// Create mock functions that can be reused
const mockPut = vi.fn()
const mockGet = vi.fn()
const mockQuery = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockScan = vi.fn()
const mockSend = vi.fn()

// Mock AWS SDK for testing
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
  DynamoDB: vi.fn(() => ({
    send: mockSend,
  })),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: vi.fn(() => ({
      put: mockPut,
      get: mockGet,
      query: mockQuery,
      update: mockUpdate,
      delete: mockDelete,
      scan: mockScan,
    })),
  },
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  ScanCommand: vi.fn((params) => ({ params })),
  UpdateCommand: vi.fn((params) => ({ params })),
  DeleteCommand: vi.fn((params) => ({ params })),
}))

// Mock SES client
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  SendEmailCommand: vi.fn(),
}))

// Mock password utilities
vi.mock('../utils/password', () => ({
  hashPassword: vi.fn(() => Promise.resolve('hashed-password')),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
  validatePassword: vi.fn(() => ({ isValid: true, errors: [] })),
}))

// Mock token utilities
vi.mock('../utils/tokens', () => ({
  generateSecureToken: vi.fn(() => 'secure-token'),
  generateInvitationCode: vi.fn(() => 'ABC12345'),
  isTokenExpired: vi.fn(() => false),
}))

// Mock credentials user functions
vi.mock('../utils/dynamodb/credentials-users', () => ({
  createCredentialsUser: vi.fn(),
  findCredentialsUserByEmail: vi.fn(),
  findAnyUserByEmail: vi.fn(),
  verifyCredentialsUser: vi.fn(),
  verifyEmailToken: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  validateInvitationCode: vi.fn(),
  createPasswordResetToken: vi.fn(),
  validatePasswordResetToken: vi.fn(),
  resetPassword: vi.fn(),
}))

// Mock NextAuth
vi.mock('next-auth', () => ({
  default: vi.fn(),
}))

// Mock Next.js
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
    })),
  },
}))

// Mock environment variables
process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
process.env.AWS_REGION = 'us-east-1'
process.env.NEXTAUTH_SECRET = 'test-secret'

// Export mocks for use in tests
declare global {
  var mockPut: typeof mockPut
  var mockGet: typeof mockGet
  var mockQuery: typeof mockQuery
  var mockUpdate: typeof mockUpdate
  var mockDelete: typeof mockDelete
  var mockScan: typeof mockScan
  var mockSend: typeof mockSend
}

globalThis.mockPut = mockPut
globalThis.mockGet = mockGet
globalThis.mockQuery = mockQuery
globalThis.mockUpdate = mockUpdate
globalThis.mockDelete = mockDelete
globalThis.mockScan = mockScan
globalThis.mockSend = mockSend
