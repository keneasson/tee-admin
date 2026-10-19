import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * /api/user/relationships reads and writes by personId (R7). The bug: rows
 * were keyed USER#<email>, so a person whose primary email changed (or who
 * signed in with another of their addresses) lost their family from view.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getByEmail: vi.fn(),
  getAllPersonsByEmail: vi.fn(),
  getById: vi.fn(),
  getFamilyMembers: vi.fn(),
  hasRelationship: vi.fn(),
  createRelationship: vi.fn(),
  removeRelationship: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: vi.fn() }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.getByEmail,
    getAllPersonsByEmail: h.getAllPersonsByEmail,
    getById: h.getById,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/relationship-repository', () => ({
  relationshipRepository: {
    getFamilyMembers: h.getFamilyMembers,
    hasRelationship: h.hasRelationship,
    createRelationship: h.createRelationship,
    removeRelationship: h.removeRelationship,
  },
}))

import { GET, POST, DELETE } from '../app/api/user/relationships/route'

const ME = { personId: 'p-me', primaryEmail: 'me@example.org', firstName: 'Me' }
const SPOUSE = { personId: 'p-spouse', primaryEmail: 'spouse@example.org', displayName: 'Spouse Person' }

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'second-address@example.org' } })
  // Signing in with a secondary address still resolves the same person.
  h.getByEmail.mockImplementation(async (email: string) =>
    email === 'spouse@example.org' ? SPOUSE : email === 'second-address@example.org' ? ME : null
  )
  h.getAllPersonsByEmail.mockResolvedValue([])
  h.getById.mockImplementation(async (id: string) => (id === 'p-spouse' ? SPOUSE : id === 'p-me' ? ME : null))
  h.hasRelationship.mockResolvedValue(false)
})

describe('GET', () => {
  it('reads the family by personId, whichever address signed in', async () => {
    h.getFamilyMembers.mockResolvedValue([
      { targetPersonId: 'p-spouse', relationshipType: 'spouse', status: 'active', createdAt: 'T' },
    ])
    const body = await (await GET()).json()
    expect(h.getFamilyMembers).toHaveBeenCalledWith('p-me')
    expect(body.relationships).toEqual([
      { personId: 'p-spouse', name: 'Spouse Person', relationshipType: 'spouse', status: 'active', createdAt: 'T' },
    ])
    expect(JSON.stringify(body)).not.toMatch(/@/) // never exposes an address
  })
})

describe('POST', () => {
  const post = (body: unknown) => ({ json: async () => body }) as any

  it('links a picked person by id', async () => {
    const res = await POST(post({ targetPersonId: 'p-spouse', relationshipType: 'spouse' }))
    expect(res.status).toBe(200)
    expect(h.createRelationship).toHaveBeenCalledWith('p-me', 'p-spouse', 'spouse')
  })

  it('resolves a legacy targetEmail to its person', async () => {
    await POST(post({ targetEmail: 'spouse@example.org', relationshipType: 'spouse' }))
    expect(h.createRelationship).toHaveBeenCalledWith('p-me', 'p-spouse', 'spouse')
  })

  it('refuses a relationship with yourself', async () => {
    const res = await POST(post({ targetPersonId: 'p-me', relationshipType: 'sibling' }))
    expect(res.status).toBe(400)
    expect(h.createRelationship).not.toHaveBeenCalled()
  })

  it('409 when it already exists', async () => {
    h.hasRelationship.mockResolvedValue(true)
    const res = await POST(post({ targetPersonId: 'p-spouse', relationshipType: 'spouse' }))
    expect(res.status).toBe(409)
  })
})

describe('DELETE', () => {
  it('removes by personId', async () => {
    h.hasRelationship.mockResolvedValue(true)
    const res = await DELETE({ url: 'http://x/api/user/relationships?targetPersonId=p-spouse&relationshipType=spouse' } as any)
    expect(res.status).toBe(200)
    expect(h.removeRelationship).toHaveBeenCalledWith('p-me', 'p-spouse', 'spouse')
  })
})
