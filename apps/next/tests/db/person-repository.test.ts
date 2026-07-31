import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the DynamoDB document client
// Use vi.hoisted to ensure mockSend is available when vi.mock runs
const { mockSend } = vi.hoisted(() => {
  return { mockSend: vi.fn() }
})

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}))

// Now import after mocking
import { PersonRepository, type CreatePersonInput, type GoogleOAuthProfile, type CredentialsRegistrationData } from '@my/app/provider/dynamodb/repositories/person-repository'

describe('PersonRepository', () => {
  let repository: PersonRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new PersonRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getById', () => {
    it('should return person when found', async () => {
      const mockPerson = {
        pkey: 'PERSON#test-person-id',
        skey: 'PROFILE',
        personId: 'test-person-id',
        primaryEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        ecclesia: 'Toronto East',
        memberStatus: 'member',
      }

      mockSend.mockResolvedValueOnce({ Item: mockPerson })

      const result = await repository.getById('test-person-id')

      expect(result).toEqual(mockPerson)
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        type: 'GetCommand',
        params: expect.objectContaining({
          TableName: 'tee-admin',
          Key: { pkey: 'PERSON#test-person-id', skey: 'PROFILE' },
        }),
      }))
    })

    it('should return null when person not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.getById('nonexistent-id')

      expect(result).toBeNull()
    })
  })

  describe('getByEmail', () => {
    it('should return person when found via GSI1', async () => {
      const mockPerson = {
        pkey: 'PERSON#test-person-id',
        skey: 'PROFILE',
        personId: 'test-person-id',
        primaryEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      }

      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      const result = await repository.getByEmail('test@example.com')

      expect(result).toEqual(mockPerson)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should normalize email to lowercase', async () => {
      const mockPerson = {
        pkey: 'PERSON#test-id',
        primaryEmail: 'test@example.com',
      }
      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      const result = await repository.getByEmail('Test@Example.COM')

      expect(result).toEqual(mockPerson)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return null when person not found', async () => {
      // primary query empty, then the secondary fallback query is also empty
      mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] })

      const result = await repository.getByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('resolves a person by a SECONDARY email when it is not anyone’s primary', async () => {
      // 1) primary fast-path: no PROFILE has this as its primary
      mockSend.mockResolvedValueOnce({ Items: [] })
      // 2) fallback getAllPersonsByEmail: an EMAIL# item points at PERSON#p1
      mockSend.mockResolvedValueOnce({
        Items: [{ pkey: 'PERSON#p1', skey: 'EMAIL#e1', gsi1sk: 'PERSON#p1', email: 'secondary@example.com' }],
      })
      // 3) getAllPersonsByEmail loads the owning PROFILE via getById
      const profile = { pkey: 'PERSON#p1', skey: 'PROFILE', personId: 'p1', primaryEmail: 'primary@example.com' }
      mockSend.mockResolvedValueOnce({ Item: profile })

      const result = await repository.getByEmail('secondary@example.com')

      expect(result).toEqual(profile)
    })
  })

  describe('create', () => {
    it('should create person with correct data structure', async () => {
      mockSend
        .mockResolvedValueOnce({}) // put PersonRecord
        .mockResolvedValueOnce({}) // put PersonEmailRecord

      const input: CreatePersonInput = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'Toronto East',
        memberStatus: 'member',
        role: 'member',
      }

      const result = await repository.create(input)

      expect(result).toMatchObject({
        pkey: 'PERSON#test-uuid-1234',
        skey: 'PROFILE',
        gsi1pk: 'EMAIL#test@example.com',
        gsi1sk: 'PERSON',
        gsi2pk: 'ECCLESIA#Toronto East',
        gsi3pk: 'NAME#doe',
        personId: 'test-uuid-1234',
        primaryEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        ecclesia: 'Toronto East',
        memberStatus: 'member',
        role: 'member',
      })

      // Should call put twice: PersonRecord and PersonEmailRecord
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should normalize email to lowercase', async () => {
      mockSend
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})

      const input: CreatePersonInput = {
        email: 'Test@Example.COM',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'Toronto East',
      }

      const result = await repository.create(input)

      expect(result.primaryEmail).toBe('test@example.com')
      expect(result.gsi1pk).toBe('EMAIL#test@example.com')
    })
  })

  describe('listByEcclesia', () => {
    it('should query by ecclesia using GSI2', async () => {
      const mockPersons = [
        { personId: '1', firstName: 'John', lastName: 'Doe', ecclesia: 'Toronto East' },
        { personId: '2', firstName: 'Jane', lastName: 'Smith', ecclesia: 'Toronto East' },
      ]

      mockSend.mockResolvedValueOnce({ Items: mockPersons })

      const result = await repository.listByEcclesia('Toronto East')

      expect(result.items).toEqual(mockPersons)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('searchByName', () => {
    it('should search by last name using GSI3', async () => {
      const mockPersons = [
        { personId: '1', firstName: 'John', lastName: 'Doe' },
      ]

      mockSend.mockResolvedValueOnce({ Items: mockPersons })

      const result = await repository.searchByName('Doe')

      expect(result.items).toEqual(mockPersons)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should search by last and first name', async () => {
      const mockPersons = [
        { personId: '1', firstName: 'John', lastName: 'Doe' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockPersons })

      const result = await repository.searchByName('Doe', 'John')

      expect(result.items).toEqual(mockPersons)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Auth Integration Methods', () => {
    describe('getByEmailForAuth', () => {
      it('should return auth data when person found', async () => {
        const mockPerson = {
          personId: 'test-id',
          primaryEmail: 'test@example.com',
          hashedPassword: 'hashed-password',
          emailVerified: '2024-01-01T00:00:00Z',
          role: 'member',
          provider: 'credentials',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          ecclesia: 'Toronto East',
        }

        mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

        const result = await repository.getByEmailForAuth('test@example.com')

        expect(result).toEqual({
          personId: 'test-id',
          email: 'test@example.com',
          hashedPassword: 'hashed-password',
          emailVerified: '2024-01-01T00:00:00Z',
          role: 'member',
          provider: 'credentials',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          ecclesia: 'Toronto East',
        })
      })

      it('should return null when person not found', async () => {
        // primary query + secondary fallback query both empty
        mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] })

        const result = await repository.getByEmailForAuth('nonexistent@example.com')

        expect(result).toBeNull()
      })
    })

    describe('createFromOAuth', () => {
      it('should create person from Google OAuth profile', async () => {
        mockSend
          .mockResolvedValueOnce({}) // put PersonRecord
          .mockResolvedValueOnce({}) // put PersonEmailRecord

        const profile: GoogleOAuthProfile = {
          id: 'google-user-id',
          email: 'test@gmail.com',
          name: 'John Doe',
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://example.com/photo.jpg',
        }

        const result = await repository.createFromOAuth(profile, {
          ecclesia: 'Toronto East',
          role: 'member',
        })

        expect(result).toMatchObject({
          provider: 'google',
          googleId: 'google-user-id',
          image: 'https://example.com/photo.jpg',
          emailVerified: expect.any(String), // OAuth emails are pre-verified
          role: 'member',
          ecclesia: 'Toronto East',
        })
      })
    })

    describe('createFromCredentials', () => {
      it('should create person from credentials registration', async () => {
        mockSend
          .mockResolvedValueOnce({}) // put PersonRecord
          .mockResolvedValueOnce({}) // put PersonEmailRecord

        const data: CredentialsRegistrationData = {
          email: 'test@example.com',
          hashedPassword: 'hashed-password-123',
          firstName: 'John',
          lastName: 'Doe',
          ecclesia: 'Toronto East',
          role: 'member',
        }

        const result = await repository.createFromCredentials(data)

        expect(result.provider).toBe('credentials')
        expect(result.hashedPassword).toBe('hashed-password-123')
        expect(result.role).toBe('member')
        // emailVerified is not set (undefined or not present) until token is used
        expect(result.emailVerified).toBeFalsy()
      })
    })

    describe('markEmailVerified', () => {
      it('should mark email as verified', async () => {
        const mockPerson = {
          pkey: 'PERSON#test-id',
          skey: 'PROFILE',
          personId: 'test-id',
          primaryEmail: 'test@example.com',
        }

        const mockEmail = {
          pkey: 'PERSON#test-id',
          skey: 'EMAIL#email-id',
          emailType: 'primary',
        }

        mockSend
          .mockResolvedValueOnce({ Attributes: { ...mockPerson, emailVerified: '2024-01-01T00:00:00Z' } }) // update PersonRecord
          .mockResolvedValueOnce({ Items: [mockEmail] }) // get emails
          .mockResolvedValueOnce({ Attributes: mockEmail }) // update email record

        const result = await repository.markEmailVerified('test-id')

        expect(result.emailVerified).toBeDefined()
      })
    })

    describe('emailExists', () => {
      it('should return true when email exists', async () => {
        mockSend.mockResolvedValueOnce({ Items: [{ personId: '1' }] })

        const result = await repository.emailExists('test@example.com')

        expect(result).toBe(true)
      })

      it('should return false when email does not exist', async () => {
        // primary query + secondary fallback query both empty
        mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] })

        const result = await repository.emailExists('nonexistent@example.com')

        expect(result).toBe(false)
      })
    })
  })

  describe('Inter-Ecclesia Rep Methods', () => {
    describe('listInterEcclesiaReps', () => {
      it('should list all inter-ecclesia representatives', async () => {
        const mockReps = [
          { personId: '1', isInterEcclesiaRep: true, ecclesia: 'Ecclesia A' },
          { personId: '2', isInterEcclesiaRep: true, ecclesia: 'Ecclesia B' },
        ]

        mockSend.mockResolvedValueOnce({ Items: mockReps })

        const result = await repository.listInterEcclesiaReps()

        expect(result).toEqual(mockReps)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('setInterEcclesiaRep', () => {
      it('should set inter-ecclesia rep status', async () => {
        const mockUpdatedPerson = {
          personId: 'test-id',
          isInterEcclesiaRep: true,
        }

        mockSend.mockResolvedValueOnce({ Attributes: mockUpdatedPerson })

        const result = await repository.setInterEcclesiaRep('test-id', true)

        expect(result.isInterEcclesiaRep).toBe(true)
      })
    })
  })
})
