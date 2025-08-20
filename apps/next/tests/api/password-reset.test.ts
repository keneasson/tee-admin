import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock at the database client level
const mockQuery = vi.fn()
const mockGet = vi.fn()
const mockPut = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: vi.fn(() => ({
      query: mockQuery,
      get: mockGet,
      put: mockPut,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: vi.fn(),
}))

vi.mock('../../utils/email/sesClient', () => ({
  getAwsDbConfig: vi.fn(() => ({})),
}))

vi.mock('../../utils/email/send-verification-email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/password', () => ({
  validatePassword: vi.fn(() => ({ isValid: true, errors: [] })),
}))

// Import the API route handlers
import { POST as forgotPasswordPOST } from '../../app/api/auth/forgot-password/route'
import { POST as resetPasswordPOST } from '../../app/api/auth/reset-password/route'
import { sendPasswordResetEmail } from '../../utils/email/send-verification-email'
import { validatePassword } from '../../utils/password'

describe('Password Reset API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/auth/forgot-password', () => {
    it('should handle valid email for existing user', async () => {
      const email = 'test@example.com'

      // Mock user exists (findCredentialsUserByEmail will find a credentials user)
      mockQuery.mockResolvedValue({
        Items: [
          {
            id: 'user-123',
            email,
            name: 'Test User',
            provider: 'credentials',
            emailVerified: new Date(),
          },
        ],
      })

      // Mock token creation (put operation)
      mockPut.mockResolvedValue({})

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('If an account with that email exists')

      // Verify database calls were made
      expect(mockQuery).toHaveBeenCalled() // User lookup
      expect(mockPut).toHaveBeenCalled() // Token creation
      expect(sendPasswordResetEmail).toHaveBeenCalled() // Email sending
    })

    it('should handle non-existent user gracefully', async () => {
      const email = 'nonexistent@example.com'

      // Mock user doesn't exist
      mockFindCredentialsUserByEmail.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('If an account with that email exists')

      // Should still look up user but not create token or send email
      expect(mockFindCredentialsUserByEmail).toHaveBeenCalledWith(email)
      expect(mockCreatePasswordResetToken).not.toHaveBeenCalled()
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const invalidEmail = 'invalid-email'

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: invalidEmail }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid email format')
    })

    it('should require email field', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email is required')
    })

    it('should handle email sending failures gracefully', async () => {
      const email = 'test@example.com'
      const token = 'generated-token-123'

      // Mock user exists
      mockFindCredentialsUserByEmail.mockResolvedValue({
        id: 'user-123',
        email,
        name: 'Test User',
        provider: 'credentials',
      })

      // Mock token creation
      mockCreatePasswordResetToken.mockResolvedValue(token)

      // Mock email sending failure
      mockSendPasswordResetEmail.mockRejectedValue(new Error('Email service error'))

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      // Should still return success (security measure)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('If an account with that email exists')
    })

    it('should handle database errors', async () => {
      const email = 'test@example.com'

      // Mock database error
      mockFindCredentialsUserByEmail.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await forgotPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST /api/auth/reset-password', () => {
    const validToken = 'valid-token-123'
    const validPassword = 'NewSecurePassword123!'

    it('should reset password successfully', async () => {
      // Mock valid token
      mockValidatePasswordResetToken.mockResolvedValue({
        email: 'test@example.com',
      })

      // Mock successful password reset
      mockResetPassword.mockResolvedValue(true)

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: validToken, password: validPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await resetPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Password reset successfully')

      expect(mockValidatePasswordResetToken).toHaveBeenCalledWith(validToken)
      expect(mockResetPassword).toHaveBeenCalledWith(validToken, validPassword)
    })

    it('should reject invalid token', async () => {
      // Mock invalid token
      mockValidatePasswordResetToken.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token', password: validPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await resetPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired reset token')
    })

    it('should validate password requirements', async () => {
      // Mock password validation failure
      mockValidatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 12 characters'],
      })

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: validToken, password: '123' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await resetPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Password requirements not met')
      expect(data.details).toEqual(['Password must be at least 12 characters'])
    })

    it('should require both token and password', async () => {
      // Test missing token
      let request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: validPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      let response = await resetPasswordPOST(request)
      let data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Token and password are required')

      // Test missing password
      request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: validToken }),
        headers: { 'Content-Type': 'application/json' },
      })

      response = await resetPasswordPOST(request)
      data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Token and password are required')
    })

    it('should handle password reset failure', async () => {
      // Mock valid token but reset failure
      mockValidatePasswordResetToken.mockResolvedValue({
        email: 'test@example.com',
      })
      mockResetPassword.mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: validToken, password: validPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await resetPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to reset password')
    })

    it('should handle database errors', async () => {
      // Mock database error during token validation
      mockValidatePasswordResetToken.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: validToken, password: validPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await resetPasswordPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete password reset flow', async () => {
      const email = 'integration@example.com'
      const token = 'integration-token-123'
      const newPassword = 'NewIntegrationPassword123!'

      // Step 1: Forgot password request
      mockFindCredentialsUserByEmail.mockResolvedValue({
        id: 'user-123',
        email,
        name: 'Integration User',
        provider: 'credentials',
      })
      mockCreatePasswordResetToken.mockResolvedValue(token)
      mockSendPasswordResetEmail.mockResolvedValue(undefined)

      const forgotRequest = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const forgotResponse = await forgotPasswordPOST(forgotRequest)
      expect(forgotResponse.status).toBe(200)

      // Step 2: Reset password with token
      mockValidatePasswordResetToken.mockResolvedValue({ email })
      mockResetPassword.mockResolvedValue(true)

      const resetRequest = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: newPassword }),
        headers: { 'Content-Type': 'application/json' },
      })

      const resetResponse = await resetPasswordPOST(resetRequest)
      const resetData = await resetResponse.json()

      expect(resetResponse.status).toBe(200)
      expect(resetData.success).toBe(true)

      // Verify the flow
      expect(mockCreatePasswordResetToken).toHaveBeenCalledWith(email)
      expect(mockValidatePasswordResetToken).toHaveBeenCalledWith(token)
      expect(mockResetPassword).toHaveBeenCalledWith(token, newPassword)
    })
  })
})
