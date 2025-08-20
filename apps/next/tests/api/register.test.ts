import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/register/route'
import { NextRequest } from 'next/server'

// Mock the dependencies
vi.mock('../../utils/dynamodb/credentials-users', () => ({
  createCredentialsUser: vi.fn(),
  findCredentialsUserByEmail: vi.fn(),
  validateInvitationCode: vi.fn(),
  createEmailVerificationToken: vi.fn(),
}))

vi.mock('../../utils/email/send-verification-email', () => ({
  sendVerificationEmail: vi.fn(),
}))

vi.mock('../../utils/password', () => ({
  validatePassword: vi.fn(),
}))

describe('/api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockRequest = (body: any) => {
    return new NextRequest(new URL('http://localhost:3000/api/auth/register'), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  describe('successful registration', () => {
    it('should register user without invitation code', async () => {
      // Import mocked functions
      const { createCredentialsUser, findCredentialsUserByEmail, createEmailVerificationToken } =
        await import('../../utils/dynamodb/credentials-users')
      const { sendVerificationEmail } = await import('../../utils/email/send-verification-email')
      const { validatePassword } = await import('../../utils/password')

      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      // Mock successful validation and creation
      vi.mocked(validatePassword).mockReturnValue({ isValid: true, errors: [] })
      vi.mocked(findCredentialsUserByEmail).mockResolvedValue(null)
      vi.mocked(createCredentialsUser).mockResolvedValue({
        id: 'user123',
        email: requestBody.email,
        firstName: requestBody.firstName,
        lastName: requestBody.lastName,
        ecclesia: requestBody.ecclesia,
        role: 'guest',
        provider: 'credentials',
        createdAt: new Date(),
        hashedPassword: 'hashed',
        name: 'John Doe',
      })
      vi.mocked(createEmailVerificationToken).mockResolvedValue('token123')
      vi.mocked(sendVerificationEmail).mockResolvedValue(undefined)

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Please check your email')
      expect(data.userId).toBe('user123')

      expect(createCredentialsUser).toHaveBeenCalledWith({
        email: requestBody.email,
        password: requestBody.password,
        firstName: requestBody.firstName,
        lastName: requestBody.lastName,
        ecclesia: requestBody.ecclesia,
        role: 'guest',
        invitationCode: undefined,
      })
      expect(sendVerificationEmail).toHaveBeenCalledWith(requestBody.email, 'token123', 'John Doe')
    })

    it('should register user with valid invitation code', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
        invitationCode: 'ABCD1234',
      }

      const mockInvitation = {
        code: 'ABCD1234',
        firstName: 'Jane',
        lastName: 'Smith',
        ecclesia: 'Peterborough',
        role: 'admin',
        createdBy: 'admin123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        used: false,
      }

      vi.mocked(validatePassword).mockReturnValue({ isValid: true, errors: [] })
      vi.mocked(findCredentialsUserByEmail).mockResolvedValue(null)
      vi.mocked(validateInvitationCode).mockResolvedValue(mockInvitation)
      vi.mocked(createCredentialsUser).mockResolvedValue({
        id: 'user123',
        email: requestBody.email,
        firstName: 'Jane',
        lastName: 'Smith',
        ecclesia: 'Peterborough',
        role: 'admin',
        provider: 'credentials',
        createdAt: new Date(),
        hashedPassword: 'hashed',
        name: 'Jane Smith',
      })
      vi.mocked(createEmailVerificationToken).mockResolvedValue('token123')
      vi.mocked(sendVerificationEmail).mockResolvedValue(undefined)

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Should use invitation details, not form details
      expect(createCredentialsUser).toHaveBeenCalledWith({
        email: requestBody.email,
        password: requestBody.password,
        firstName: 'Jane', // From invitation
        lastName: 'Smith', // From invitation
        ecclesia: 'Peterborough', // From invitation
        role: 'admin', // From invitation
        invitationCode: 'ABCD1234',
      })
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        requestBody.email,
        'token123',
        'Jane Smith'
      )
    })
  })

  describe('validation errors', () => {
    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        email: 'test@example.com',
        // Missing password, firstName, lastName, ecclesia
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 400 for invalid email format', async () => {
      const request = createMockRequest({
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid email format')
    })

    it('should return 400 for weak password', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      vi.mocked(validatePassword).mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 12 characters'],
      })

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Password requirements not met')
      expect(data.details).toEqual(['Password must be at least 12 characters'])
    })

    it('should return 409 for existing user', async () => {
      const requestBody = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      vi.mocked(validatePassword).mockReturnValue({ isValid: true, errors: [] })
      vi.mocked(findCredentialsUserByEmail).mockResolvedValue({
        id: 'existing123',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        ecclesia: 'TEE',
        role: 'guest',
        provider: 'credentials',
        createdAt: new Date(),
        hashedPassword: 'hashed',
        name: 'Existing User',
      })

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('User with this email already exists')
    })

    it('should return 400 for invalid invitation code', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
        invitationCode: 'INVALID1',
      }

      vi.mocked(validatePassword).mockReturnValue({ isValid: true, errors: [] })
      vi.mocked(findCredentialsUserByEmail).mockResolvedValue(null)
      vi.mocked(validateInvitationCode).mockResolvedValue(null)

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired invitation code')
    })
  })

  describe('error handling', () => {
    it('should return 500 for database errors', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      vi.mocked(validatePassword).mockReturnValue({ isValid: true, errors: [] })
      vi.mocked(findCredentialsUserByEmail).mockRejectedValue(new Error('Database error'))

      const request = createMockRequest(requestBody)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})
