import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../../app/api/auth/verify-email/route'
import { NextRequest } from 'next/server'

// Mock the dependencies
vi.mock('../../utils/dynamodb/credentials-users', () => ({
  verifyEmailToken: vi.fn(),
}))

describe('/api/auth/verify-email', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockRequest = (token?: string) => {
    const url = new URL('http://localhost:3000/api/auth/verify-email')
    if (token) {
      url.searchParams.set('token', token)
    }
    
    return new NextRequest(url, {
      method: 'GET',
    })
  }

  describe('successful verification', () => {
    it('should verify email with valid token', async () => {
      const { verifyEmailToken } = await import('../../utils/dynamodb/credentials-users')
      const mockResult = { email: 'test@example.com' }
      vi.mocked(verifyEmailToken).mockResolvedValue(mockResult)

      const request = createMockRequest('valid-token-123')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Email verified successfully')
      expect(data.email).toBe('test@example.com')

      expect(verifyEmailToken).toHaveBeenCalledWith('valid-token-123')
    })
  })

  describe('validation errors', () => {
    it('should return 400 when token is missing', async () => {
      const request = createMockRequest() // No token
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Verification token is required')
      expect(verifyEmailToken).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid token', async () => {
      vi.mocked(verifyEmailToken).mockResolvedValue(null)

      const request = createMockRequest('invalid-token')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired verification token')
      expect(verifyEmailToken).toHaveBeenCalledWith('invalid-token')
    })

    it('should return 400 for expired token', async () => {
      vi.mocked(verifyEmailToken).mockResolvedValue(null)

      const request = createMockRequest('expired-token')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired verification token')
    })
  })

  describe('error handling', () => {
    it('should return 500 for database errors', async () => {
      vi.mocked(verifyEmailToken).mockRejectedValue(new Error('Database connection failed'))

      const request = createMockRequest('some-token')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})