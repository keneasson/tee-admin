import { describe, it, expect } from 'vitest'
import { getRoleFromLegacyUser } from '@my/app/provider/auth/get-user-from-legacy'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { DirectoryType } from '@my/app/types'

describe('Role Assignment - Simple Tests', () => {
  describe('getRoleFromLegacyUser', () => {
    it('should assign OWNER role to ken.easson@gmail.com', async () => {
      const mockUser: DirectoryType = {
        FirstName: 'Ken',
        LastName: 'Easson',
        Email: 'ken.easson@gmail.com',
        ecclesia: 'TEE',
        Phone: '647-393-3153',
        Address: '28 Plumridge Crt',
        Children: 'Krystal, Zaiden'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should assign OWNER role to keneasson@gmail.com (legacy format)', async () => {
      const mockUser: DirectoryType = {
        FirstName: 'Ken',
        LastName: 'Easson',
        Email: 'keneasson@gmail.com',
        ecclesia: 'TEE',
        Phone: '647-393-3153',
        Address: '28 Plumridge Crt',
        Children: 'Krystal, Zaiden'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should assign MEMBER role to TEE ecclesia users', async () => {
      const mockUser: DirectoryType = {
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

    it('should handle multiple emails and match owner', async () => {
      const mockUser: DirectoryType = {
        FirstName: 'Ken',
        LastName: 'Easson',
        Email: 'work@company.com\nken.easson@gmail.com\npersonal@other.com',
        ecclesia: 'TEE',
        Phone: '647-393-3153',
        Address: '28 Plumridge Crt',
        Children: 'Krystal, Zaiden'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should handle case insensitive email matching', async () => {
      const mockUser: DirectoryType = {
        FirstName: 'Ken',
        LastName: 'Easson',
        Email: 'KEN.EASSON@GMAIL.COM',
        ecclesia: 'TEE',
        Phone: '647-393-3153',
        Address: '28 Plumridge Crt',
        Children: 'Krystal, Zaiden'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })

    it('should prioritize owner role over ecclesia-based role', async () => {
      const mockUser: DirectoryType = {
        FirstName: 'Ken',
        LastName: 'Easson',
        Email: 'ken.easson@gmail.com',
        ecclesia: 'Other Ecclesia', // Different ecclesia, should still be owner
        Phone: '647-393-3153',
        Address: '28 Plumridge Crt',
        Children: 'Krystal, Zaiden'
      }

      const role = await getRoleFromLegacyUser({ user: mockUser })
      expect(role).toBe(ROLES.OWNER)
    })
  })

  describe('Role Hierarchy', () => {
    it('should have correct role hierarchy', () => {
      // Verify role constants exist and have expected values
      expect(ROLES.OWNER).toBeDefined()
      expect(ROLES.ADMIN).toBeDefined() 
      expect(ROLES.MEMBER).toBeDefined()
      expect(ROLES.GUEST).toBeDefined()
      
      // Owner should be highest privilege
      expect(ROLES.OWNER).toBe('owner')
      expect(ROLES.ADMIN).toBe('admin')
      expect(ROLES.MEMBER).toBe('member')
      expect(ROLES.GUEST).toBe('guest')
    })
  })
})