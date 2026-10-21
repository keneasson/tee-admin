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
import { PersonRepository, chooseSignInHolder, type CreatePersonInput, type GoogleOAuthProfile, type CredentialsRegistrationData } from '@my/app/provider/dynamodb/repositories/person-repository'

describe('PersonRepository', () => {
  let repository: PersonRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new PersonRepository()
    // These tests script the client call-by-call; projection sync (its own
    // reads/writes after each write) is covered by people-index-sync.test.ts.
    repository.setProjectionSync(null)
  })

  afterEach(() => {
    // clearAllMocks (not restoreAllMocks) so the mocked command constructors keep
    // their implementations across tests — restoreAllMocks wipes them, which would
    // make later tests see `undefined` commands instead of { type, params }.
    vi.clearAllMocks()
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

    /**
     * #267 — a shared household address held as PRIMARY by two people. This is
     * also the sign-in lookup, so it must never depend on the order DynamoDB
     * returns items with identical GSI keys (it guarantees none).
     */
    describe('shared household address', () => {
      const wife = { pkey: 'PERSON#b-wife', skey: 'PROFILE', personId: 'b-wife', primaryEmail: 'home@example.com' }
      const husband = { pkey: 'PERSON#a-husband', skey: 'PROFILE', personId: 'a-husband', primaryEmail: 'home@example.com' }
      const rows = [
        { pkey: 'PERSON#b-wife', skey: 'EMAIL#w', email: 'home@example.com' },
        // He joined the address: mail reaches him there, it does not sign him in.
        { pkey: 'PERSON#a-husband', skey: 'EMAIL#h', email: 'home@example.com', loginExcluded: true },
      ]

      it.each([
        ['wife first', [wife, husband]],
        ['husband first', [husband, wife]],
      ])('resolves to the sign-in holder whatever the order (%s)', async (_label, order) => {
        mockSend
          .mockResolvedValueOnce({ Items: order }) // primary fast-path: TWO profiles
          .mockResolvedValueOnce({ Items: rows }) // getEmailsByEmail
        const result = await repository.getByEmail('home@example.com')
        expect(result?.personId).toBe('b-wife')
      })

      it('getByEmailForAuth signs in the holder, never the excluded spouse', async () => {
        mockSend
          .mockResolvedValueOnce({ Items: [husband, wife] })
          .mockResolvedValueOnce({ Items: rows })
        const auth = await repository.getByEmailForAuth('home@example.com')
        expect(auth?.personId).toBe('b-wife')
      })
    })
  })

  describe('chooseSignInHolder', () => {
    const p = (id: string) => ({ personId: id, pkey: `PERSON#${id}` }) as any

    it('a single holder is returned as-is (no change for unshared addresses)', () => {
      expect(chooseSignInHolder('x@e.com', [p('z')], [])?.personId).toBe('z')
    })

    it('with nobody marked, breaks the tie on personId — stable across calls', () => {
      expect(chooseSignInHolder('x@e.com', [p('m'), p('c')], [])?.personId).toBe('c')
      expect(chooseSignInHolder('x@e.com', [p('c'), p('m')], [])?.personId).toBe('c')
    })

    it('prefers a named person over a nameless orphan, whatever the ids', () => {
      const named = { ...p('z'), firstName: 'Martin' }
      const orphan = { ...p('a'), firstName: '' }
      expect(chooseSignInHolder('x@e.com', [orphan, named], [])?.personId).toBe('z')
      expect(chooseSignInHolder('x@e.com', [named, orphan], [])?.personId).toBe('z')
    })

    it('ignores a loginExcluded flag that belongs to a DIFFERENT address', () => {
      const rows = [{ pkey: 'PERSON#c', email: 'other@e.com', loginExcluded: true }]
      expect(chooseSignInHolder('x@e.com', [p('m'), p('c')], rows)?.personId).toBe('c')
    })

    it('never returns nobody when everyone is excluded', () => {
      const rows = [
        { pkey: 'PERSON#c', email: 'x@e.com', loginExcluded: true },
        { pkey: 'PERSON#m', email: 'x@e.com', loginExcluded: true },
      ]
      expect(chooseSignInHolder('x@e.com', [p('m'), p('c')], rows)?.personId).toBe('c')
    })
  })

  describe('markEmailSesStatusByAddress', () => {
    it('marks every row holding the address, across people, and skips rows already marked', async () => {
      mockSend
        .mockResolvedValueOnce({
          Items: [
            { pkey: 'PERSON#a', skey: 'EMAIL#1', email: 'dead@e.com', sesStatus: 'active' },
            { pkey: 'PERSON#b', skey: 'EMAIL#2', email: 'dead@e.com', sesStatus: 'bounced' },
            { pkey: 'PERSON#a', skey: 'PROFILE', email: 'dead@e.com' },
          ],
        })
        .mockResolvedValue({ Attributes: {} })
      const n = await repository.markEmailSesStatusByAddress('dead@e.com', 'bounced')
      expect(n).toBe(1)
      const updates = mockSend.mock.calls.filter((c) => c[0]?.type === 'UpdateCommand')
      expect(updates).toHaveLength(1)
      expect(updates[0][0].params.Key).toEqual({ pkey: 'PERSON#a', skey: 'EMAIL#1' })
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

  describe('Email consolidation methods', () => {
    describe('getEmailById', () => {
      it('fetches a single EMAIL# row by id', async () => {
        const mockEmail = {
          pkey: 'PERSON#p1',
          skey: 'EMAIL#e1',
          emailId: 'e1',
          email: 'a@b.com',
          emailType: 'secondary',
        }
        mockSend.mockResolvedValueOnce({ Item: mockEmail })

        const result = await repository.getEmailById('p1', 'e1')

        expect(result).toEqual(mockEmail)
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
          type: 'GetCommand',
          params: expect.objectContaining({
            TableName: 'tee-admin',
            Key: { pkey: 'PERSON#p1', skey: 'EMAIL#e1' },
          }),
        }))
      })

      it('returns null when the row is absent', async () => {
        mockSend.mockResolvedValueOnce({ Item: null })
        const result = await repository.getEmailById('p1', 'missing')
        expect(result).toBeNull()
      })
    })

    describe('setEmailOrder', () => {
      it('writes order per EMAIL# row matching the given sequence, without touching identity keys', async () => {
        mockSend
          .mockResolvedValueOnce({ Attributes: {} }) // update e-a
          .mockResolvedValueOnce({ Attributes: {} }) // update e-b

        await repository.setEmailOrder('p1', ['e-a', 'e-b'])

        expect(mockSend).toHaveBeenCalledTimes(2)

        const first = mockSend.mock.calls[0][0]
        expect(first.type).toBe('UpdateCommand')
        expect(first.params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#e-a' })
        // order = index 0
        expect(first.params.ExpressionAttributeNames['#attr0']).toBe('order')
        expect(first.params.ExpressionAttributeValues[':val0']).toBe(0)
        // never mutates identity/lookup keys
        const firstNames = Object.values(first.params.ExpressionAttributeNames)
        expect(firstNames).not.toContain('primaryEmail')
        expect(firstNames).not.toContain('gsi1pk')

        const second = mockSend.mock.calls[1][0]
        expect(second.params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#e-b' })
        expect(second.params.ExpressionAttributeValues[':val0']).toBe(1)
      })

      it('is a no-op when the id list is empty', async () => {
        await repository.setEmailOrder('p1', [])
        expect(mockSend).not.toHaveBeenCalled()
      })

      it('reordering a MULTI-email person never touches PROFILE / primaryEmail / gsi1pk (login is preserved)', async () => {
        // A Recording Brother with several addresses re-preferences them. Reorder is
        // display-only: it must not become an identity transfer.
        mockSend
          .mockResolvedValueOnce({ Attributes: {} }) // e-work
          .mockResolvedValueOnce({ Attributes: {} }) // e-primary
          .mockResolvedValueOnce({ Attributes: {} }) // e-personal

        await repository.setEmailOrder('p1', ['e-work', 'e-primary', 'e-personal'])

        expect(mockSend).toHaveBeenCalledTimes(3)

        for (const call of mockSend.mock.calls) {
          const cmd = call[0]
          expect(cmd.type).toBe('UpdateCommand')
          // Never writes the PROFILE row — only EMAIL# rows are reordered.
          expect(cmd.params.Key.skey).not.toBe('PROFILE')
          expect(cmd.params.Key.skey.startsWith('EMAIL#')).toBe(true)
          // Never mutates the identity/login handle or its lookup index.
          const names = Object.values(cmd.params.ExpressionAttributeNames)
          expect(names).not.toContain('primaryEmail')
          expect(names).not.toContain('gsi1pk')
          expect(names).not.toContain('emailType')
          expect(names).not.toContain('email')
          // The only domain field written is `order` (plus base lastUpdated/version bookkeeping).
          expect(names).toContain('order')
        }
      })
    })

    describe('markEmailVerifiedByAddress', () => {
      it('sets verified=true on the matching EMAIL# row (secondary works)', async () => {
        const rows = [
          { pkey: 'PERSON#p1', skey: 'EMAIL#e1', emailId: 'e1', email: 'primary@x.com', emailType: 'primary', verified: true },
          { pkey: 'PERSON#p1', skey: 'EMAIL#e2', emailId: 'e2', email: 'second@x.com', emailType: 'secondary', verified: false },
        ]
        mockSend
          .mockResolvedValueOnce({ Items: rows }) // getEmails query
          .mockResolvedValueOnce({ Attributes: {} }) // update

        await repository.markEmailVerifiedByAddress('p1', 'Second@X.com')

        expect(mockSend).toHaveBeenCalledTimes(2)
        const update = mockSend.mock.calls[1][0]
        expect(update.type).toBe('UpdateCommand')
        expect(update.params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#e2' })
        const idx = Object.entries(update.params.ExpressionAttributeNames)
          .find(([, v]) => v === 'verified')?.[0]
          .replace('#attr', ':val')
        expect(update.params.ExpressionAttributeValues[idx as string]).toBe(true)
      })

      it('is idempotent (no update) when the address is not on the person', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] }) // getEmails query only
        await repository.markEmailVerifiedByAddress('p1', 'ghost@x.com')
        expect(mockSend).toHaveBeenCalledTimes(1)
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

  describe('changePrimaryEmail (identity transfer)', () => {
    // Reconstruct the { attr: value } pairs a SET UpdateCommand actually writes,
    // resolving the #attrN / :valN indirection the base repository builds.
    const setFields = (cmd: any): Record<string, any> => {
      const names = cmd.params.ExpressionAttributeNames || {}
      const values = cmd.params.ExpressionAttributeValues || {}
      const out: Record<string, any> = {}
      for (const nameKey of Object.keys(names)) {
        const m = nameKey.match(/^#attr(\d+)$/)
        if (m) out[names[nameKey]] = values[`:val${m[1]}`]
      }
      return out
    }

    const profile = {
      pkey: 'PERSON#p1',
      skey: 'PROFILE',
      personId: 'p1',
      primaryEmail: 'old@example.com',
    }

    it('promotes an existing SECONDARY to primary, keeps the old primary as an ordinary secondary (no retire stamp), and re-points PROFILE', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: profile }) // getById → PROFILE
        .mockResolvedValueOnce({
          Items: [
            { emailId: 'old-id', email: 'old@example.com', emailType: 'primary' },
            { emailId: 'new-id', email: 'new@example.com', emailType: 'secondary' },
          ],
        }) // getEmails
        .mockResolvedValueOnce({ Attributes: {} }) // update new email → primary + verified
        .mockResolvedValueOnce({ Attributes: {} }) // demote old primary → secondary
        .mockResolvedValueOnce({ Attributes: {} }) // COMMIT: update PROFILE

      const result = await repository.changePrimaryEmail('p1', 'New@Example.com')

      expect(result).toEqual({ newEmailId: 'new-id', oldEmail: 'old@example.com' })
      expect(mockSend).toHaveBeenCalledTimes(5)

      const calls = mockSend.mock.calls.map((c) => c[0])

      // 1) new email row promoted: verified + primary
      expect(calls[2].type).toBe('UpdateCommand')
      expect(calls[2].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#new-id' })
      expect(setFields(calls[2])).toMatchObject({ emailType: 'primary', verified: true })

      // 2) old primary becomes an ordinary secondary: a preference change, so
      //    the address keeps working (no retire / archive stamp).
      expect(calls[3].type).toBe('UpdateCommand')
      expect(calls[3].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#old-id' })
      const demote = setFields(calls[3])
      expect(demote.emailType).toBe('secondary')
      expect(demote).not.toHaveProperty('archiveAfter')

      // 3) COMMIT: PROFILE now carries the new login handle + lookup index (lowercased)
      expect(calls[4].type).toBe('UpdateCommand')
      expect(calls[4].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'PROFILE' })
      const commit = setFields(calls[4])
      expect(commit.primaryEmail).toBe('new@example.com')
      expect(commit.gsi1pk).toBe('EMAIL#new@example.com')
      expect(typeof commit.emailVerified).toBe('string')
    })

    // #190: correcting a typo — the wrong address is REMOVED, after the commit.
    it('CONTACT-EDIT-05 / CONTACT-EDIT-08: replace: true removes the old row only AFTER the PROFILE commit, and inherits sesSubscribed', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: profile }) // getById → PROFILE
        .mockResolvedValueOnce({
          Items: [{ emailId: 'old-id', email: 'old@example.com', emailType: 'primary', sesSubscribed: false }],
        }) // getEmails
        .mockResolvedValueOnce({}) // addEmail → put (new row)
        .mockResolvedValueOnce({ Attributes: {} }) // COMMIT: update PROFILE (no demote step)
        .mockResolvedValueOnce({}) // removeEmail(old) → delete

      const result = await repository.changePrimaryEmail('p1', 'new@example.com', { replace: true })
      expect(result.oldEmail).toBe('old@example.com')

      const calls = mockSend.mock.calls.map((c) => c[0])
      expect(calls).toHaveLength(5)
      expect(calls[2].type).toBe('PutCommand')
      // A move is not an opt-in: he was not subscribed, so the new row isn't either.
      expect(calls[2].params.Item).toMatchObject({ email: 'new@example.com', sesSubscribed: false })
      expect(calls[3].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'PROFILE' })
      expect(calls[4].type).toBe('DeleteCommand')
      expect(calls[4].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'EMAIL#old-id' })
    })

    it('creates a brand-new verified primary EMAIL# row when the new address is not already on the account', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: profile }) // getById → PROFILE
        .mockResolvedValueOnce({
          Items: [{ emailId: 'old-id', email: 'old@example.com', emailType: 'primary' }],
        }) // getEmails
        .mockResolvedValueOnce({}) // addEmail → put (new row)
        .mockResolvedValueOnce({ Attributes: {} }) // demote old primary → secondary
        .mockResolvedValueOnce({ Attributes: {} }) // COMMIT: update PROFILE

      const result = await repository.changePrimaryEmail('p1', 'new@example.com')

      // emailId comes from the mocked uuid
      expect(result).toEqual({ newEmailId: 'test-uuid-1234', oldEmail: 'old@example.com' })
      expect(mockSend).toHaveBeenCalledTimes(5)

      const calls = mockSend.mock.calls.map((c) => c[0])

      // The new row is a PutCommand: verified, primary-labelled, correct lookup index
      expect(calls[2].type).toBe('PutCommand')
      expect(calls[2].params.Item).toMatchObject({
        skey: 'EMAIL#test-uuid-1234',
        email: 'new@example.com',
        emailType: 'primary',
        verified: true,
        gsi1pk: 'EMAIL#new@example.com',
      })

      // old primary still demoted with grace, PROFILE still committed last
      expect(calls[3].type).toBe('UpdateCommand')
      expect(setFields(calls[3])).toMatchObject({ emailType: 'secondary' })
      expect(calls[4].type).toBe('UpdateCommand')
      expect(calls[4].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'PROFILE' })
      expect(setFields(calls[4]).primaryEmail).toBe('new@example.com')
    })

    // The owner's case: PROFILE.primaryEmail is an alias with NO EMAIL# row, and
    // no row is labelled primary. Making a verified secondary primary must keep
    // the alias as a secondary, not drop it.
    it('keeps a PROFILE-only old primary as a secondary row', async () => {
      mockSend
        .mockResolvedValueOnce({ Item: { ...profile, primaryEmail: 'alias@example.org', emailVerified: '2026-01-01' } })
        .mockResolvedValueOnce({
          Items: [{ emailId: 'real-id', email: 'real@example.org', emailType: 'secondary', verified: true }],
        }) // getEmails: no row for the alias, none labelled primary
        .mockResolvedValueOnce({ Attributes: {} }) // promote real → primary
        .mockResolvedValueOnce({}) // addEmail(alias) → put
        .mockResolvedValueOnce({ Attributes: {} }) // COMMIT: update PROFILE

      const result = await repository.changePrimaryEmail('p1', 'real@example.org')
      expect(result).toEqual({ newEmailId: 'real-id', oldEmail: 'alias@example.org' })

      const calls = mockSend.mock.calls.map((c) => c[0])
      expect(calls).toHaveLength(5)
      expect(setFields(calls[2])).toMatchObject({ emailType: 'primary', verified: true })
      expect(calls[3].type).toBe('PutCommand')
      expect(calls[3].params.Item).toMatchObject({
        email: 'alias@example.org',
        emailType: 'secondary',
        verified: true,
        gsi1pk: 'EMAIL#alias@example.org',
      })
      expect(calls[3].params.Item).not.toHaveProperty('archiveAfter')
      expect(calls[4].params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'PROFILE' })
      expect(setFields(calls[4])).toMatchObject({ primaryEmail: 'real@example.org', gsi1pk: 'EMAIL#real@example.org' })
    })
  })

})
