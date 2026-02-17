import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock DynamoDB - use vi.hoisted to ensure mockSend is available when vi.mock runs
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
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

// Import after mocking
import { UserRepository } from '@my/app/provider/dynamodb/repositories/user-repository'

describe('UserRepository', () => {
  let repository: UserRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new UserRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===== ADDRESS TESTS =====
  describe('Address Operations', () => {
    const testEmail = 'test@example.com'
    const testAddress = {
      addressId: 'addr-123',
      type: 'home' as const,
      label: 'Home',
      street1: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 1A1',
      country: 'Canada',
      isPrimary: true,
      isHousehold: false,
    }

    describe('getAddresses', () => {
      it('should query addresses by email', async () => {
        const mockAddresses = [
          { ...testAddress, pkey: `USER#${testEmail}`, skey: `ADDRESS#${testAddress.addressId}` },
        ]
        mockSend.mockResolvedValueOnce({ Items: mockAddresses })

        const result = await repository.getAddresses(testEmail)

        expect(result.items).toEqual(mockAddresses)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('should return empty array when no addresses found', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] })

        const result = await repository.getAddresses(testEmail)

        expect(result.items).toEqual([])
      })
    })

    describe('getAddress', () => {
      it('should get a specific address by id', async () => {
        const mockAddress = { ...testAddress, pkey: `USER#${testEmail}`, skey: `ADDRESS#${testAddress.addressId}` }
        mockSend.mockResolvedValueOnce({ Item: mockAddress })

        const result = await repository.getAddress(testEmail, testAddress.addressId)

        expect(result).toEqual(mockAddress)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('should return null when address not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: null })

        const result = await repository.getAddress(testEmail, 'nonexistent')

        expect(result).toBeNull()
      })
    })

    describe('addAddress', () => {
      it('should create address record', async () => {
        mockSend.mockResolvedValueOnce({})

        await repository.addAddress(testEmail, testAddress as any)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('updateAddress', () => {
      it('should update address fields', async () => {
        const updates = { street1: '456 New St', city: 'Ottawa' }
        mockSend.mockResolvedValueOnce({ Attributes: { ...testAddress, ...updates } })

        const result = await repository.updateAddress(testEmail, testAddress.addressId, updates)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('deleteAddress', () => {
      it('should delete address by id', async () => {
        mockSend.mockResolvedValueOnce({})

        await repository.deleteAddress(testEmail, testAddress.addressId)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('getPrimaryAddress', () => {
      it('should return primary address', async () => {
        const primaryAddr = { ...testAddress, isPrimary: true }
        const secondaryAddr = { ...testAddress, addressId: 'addr-456', isPrimary: false }
        mockSend.mockResolvedValueOnce({ Items: [secondaryAddr, primaryAddr] })

        const result = await repository.getPrimaryAddress(testEmail)

        expect(result?.isPrimary).toBe(true)
      })

      it('should return null when no primary address', async () => {
        mockSend.mockResolvedValueOnce({ Items: [{ ...testAddress, isPrimary: false }] })

        const result = await repository.getPrimaryAddress(testEmail)

        expect(result).toBeNull()
      })
    })
  })

  // ===== PHONE TESTS =====
  describe('Phone Operations', () => {
    const testEmail = 'test@example.com'
    const testPhone = {
      phoneId: 'phone-123',
      type: 'mobile' as const,
      number: '416-555-1234',
      isPrimary: true,
      isHousehold: false,
      order: 0,
    }

    describe('getPhones', () => {
      it('should query phones by email', async () => {
        const mockPhones = [
          { ...testPhone, pkey: `USER#${testEmail}`, skey: `PHONE#${testPhone.phoneId}` },
        ]
        mockSend.mockResolvedValueOnce({ Items: mockPhones })

        const result = await repository.getPhones(testEmail)

        expect(result.items).toEqual(mockPhones)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('addPhone', () => {
      it('should create phone record', async () => {
        mockSend.mockResolvedValueOnce({})

        await repository.addPhone(testEmail, testPhone as any)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('deletePhone', () => {
      it('should delete phone by id', async () => {
        mockSend.mockResolvedValueOnce({})

        await repository.deletePhone(testEmail, testPhone.phoneId)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('replaceAllPhones', () => {
      it('should delete existing phones and add new ones', async () => {
        const existingPhones = [
          { ...testPhone, pkey: `USER#${testEmail}`, skey: `PHONE#old-1`, phoneId: 'old-1' },
        ]
        const newPhones = [
          { phoneId: 'new-1', type: 'mobile' as const, number: '647-555-0001', order: 0 },
          { phoneId: 'new-2', type: 'home' as const, number: '416-555-0002', order: 1 },
        ]

        // Mock getPhones
        mockSend.mockResolvedValueOnce({ Items: existingPhones })
        // Mock deletePhone
        mockSend.mockResolvedValueOnce({})
        // Mock addPhone x2
        mockSend.mockResolvedValueOnce({})
        mockSend.mockResolvedValueOnce({})

        await repository.replaceAllPhones(testEmail, newPhones)

        // Should have called: 1 query + 1 delete + 2 puts = 4 calls
        expect(mockSend).toHaveBeenCalledTimes(4)
      })
    })
  })

  // ===== EMAIL TESTS =====
  describe('Email Operations', () => {
    const testPrimaryEmail = 'primary@example.com'
    const testEmailRecord = {
      emailId: 'email-123',
      email: 'secondary@example.com',
      verified: true,
      order: 1,
      isPrimary: false,
    }

    describe('getEmails', () => {
      it('should query emails by primary email', async () => {
        const mockEmails = [
          { ...testEmailRecord, pkey: `USER#${testPrimaryEmail}`, skey: `EMAIL#${testEmailRecord.emailId}` },
        ]
        mockSend.mockResolvedValueOnce({ Items: mockEmails })

        const result = await repository.getEmails(testPrimaryEmail)

        expect(result.items).toEqual(mockEmails)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('addEmail', () => {
      it('should create email record', async () => {
        mockSend.mockResolvedValueOnce({})

        await repository.addEmail(testPrimaryEmail, testEmailRecord as any)

        expect(mockSend).toHaveBeenCalledTimes(1)
      })
    })

    describe('getEmailByToken', () => {
      it('should scan for email with verification token', async () => {
        const token = 'verify-token-123'
        const mockEmail = { ...testEmailRecord, verificationToken: token }
        mockSend.mockResolvedValueOnce({ Items: [mockEmail] })

        const result = await repository.getEmailByToken(token)

        expect(result).toEqual(mockEmail)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('should return null when token not found', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] })

        const result = await repository.getEmailByToken('nonexistent')

        expect(result).toBeNull()
      })
    })
  })

  // ===== USER PREFERENCES TESTS =====
  describe('User Preferences Operations', () => {
    const testEmail = 'test@example.com'

    describe('getUserPreferences', () => {
      it('should get preferences by email', async () => {
        const mockPrefs = {
          pkey: `USER#${testEmail}`,
          skey: 'PREFERENCES',
          timezone: 'America/Toronto',
          dateFormat: 'YYYY-MM-DD',
        }
        mockSend.mockResolvedValueOnce({ Item: mockPrefs })

        const result = await repository.getUserPreferences(testEmail)

        expect(result).toEqual(mockPrefs)
        expect(mockSend).toHaveBeenCalledTimes(1)
      })

      it('should return null when no preferences exist', async () => {
        mockSend.mockResolvedValueOnce({ Item: null })

        const result = await repository.getUserPreferences(testEmail)

        expect(result).toBeNull()
      })
    })

    describe('updateUserPreferences', () => {
      it('should update existing preferences', async () => {
        const existingPrefs = { pkey: `USER#${testEmail}`, skey: 'PREFERENCES', timezone: 'UTC' }
        const updates = { timezone: 'America/New_York' }

        mockSend.mockResolvedValueOnce({ Item: existingPrefs }) // getUserPreferences
        mockSend.mockResolvedValueOnce({ Attributes: { ...existingPrefs, ...updates } }) // update

        const result = await repository.updateUserPreferences(testEmail, updates)

        expect(mockSend).toHaveBeenCalledTimes(2)
      })

      it('should create new preferences if none exist', async () => {
        const updates = { timezone: 'America/Toronto' }

        mockSend.mockResolvedValueOnce({ Item: null }) // getUserPreferences returns null
        mockSend.mockResolvedValueOnce({}) // put

        const result = await repository.updateUserPreferences(testEmail, updates)

        expect(mockSend).toHaveBeenCalledTimes(2)
      })
    })

    describe('getUserTimezone', () => {
      it('should return user timezone', async () => {
        mockSend.mockResolvedValueOnce({
          Item: { timezone: 'America/Vancouver' },
        })

        const result = await repository.getUserTimezone(testEmail)

        expect(result).toBe('America/Vancouver')
      })

      it('should return default Toronto timezone when no preference', async () => {
        mockSend.mockResolvedValueOnce({ Item: null })

        const result = await repository.getUserTimezone(testEmail)

        expect(result).toBe('America/Toronto')
      })
    })
  })
})
