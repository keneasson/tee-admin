import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRoleFromLegacyUser } from '@my/app/provider/auth/get-user-from-legacy'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { DirectoryType } from '@my/app/types'

describe('Role Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Owner list comes from OWNER_EMAILS; the tests set a placeholder list.
    vi.stubEnv('OWNER_EMAILS', 'owner.legacy@example.org,owner@example.org')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getRoleFromLegacyUser', () => {
    it('should assign OWNER role to owner@example.org', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Ken',
        LastName: 'Example',
        Email: 'owner@example.org',
        ecclesia: 'TEE',
        Phone: '416-555-0101',
        Address: '1 Example St',
        Children: 'Kara, Zane'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should assign OWNER role to owner.legacy@example.org (legacy format)', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Ken',
        LastName: 'Example',
        Email: 'owner.legacy@example.org',
        ecclesia: 'TEE',
        Phone: '416-555-0101',
        Address: '1 Example St',
        Children: 'Kara, Zane'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should assign MEMBER role to TEE ecclesia users', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john.doe@example.com',
        ecclesia: 'TEE',
        Phone: '416-555-1234',
        Address: '123 Main St',
        Children: ''
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.MEMBER)
    })

    it('should assign MEMBER role to Peterborough ecclesia users', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Jane',
        LastName: 'Smith',
        Email: 'jane.smith@example.com',
        ecclesia: 'Peterborough',
        Phone: '705-555-1234',
        Address: '456 Oak Ave',
        Children: ''
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.MEMBER)
    })

    it('should assign GUEST role to other ecclesia users', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Bob',
        LastName: 'Wilson',
        Email: 'bob.wilson@example.com',
        ecclesia: 'Other Ecclesia',
        Phone: '519-555-1234',
        Address: '789 Pine St',
        Children: ''
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.GUEST)
    })

    it('should handle multiple emails in Email field and match owner', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Ken',
        LastName: 'Example',
        Email: 'work@company.com\nowner@example.org\npersonal@other.com',
        ecclesia: 'TEE',
        Phone: '416-555-0101',
        Address: '1 Example St',
        Children: 'Kara, Zane'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should handle case insensitive email matching', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Ken',
        LastName: 'Example',
        Email: 'OWNER@EXAMPLE.ORG',
        ecclesia: 'TEE',
        Phone: '416-555-0101',
        Address: '1 Example St',
        Children: 'Kara, Zane'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should prioritize owner role over ecclesia-based role', async () => {
      const mockUser: DirectoryType = {
        Key: 'directory',
        FirstName: 'Ken',
        LastName: 'Example',
        Email: 'owner@example.org',
        ecclesia: 'Other Ecclesia', // Even with different ecclesia, should be owner
        Phone: '416-555-0101',
        Address: '1 Example St',
        Children: 'Kara, Zane'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })
  })
})