// Test setup file for Vitest
import { vi } from 'vitest'

// Mock AWS SDK for testing
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: vi.fn(() => ({
    send: vi.fn(),
  })),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: vi.fn(() => ({
      put: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}))

// Mock SES client
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  SendEmailCommand: vi.fn(),
}))

// Mock environment variables
process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
process.env.AWS_REGION = 'us-east-1'
process.env.NEXTAUTH_SECRET = 'test-secret'