import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * #332: the person page saves a preferred first + last name. The route accepts
 * both halves, trims them, lets '' clear them, and echoes them back so the page
 * can show "Goes by …" without a reload.
 */

const PERSON_ID = '11111111-2222-3333-4444-555555555555'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getById: vi.fn(),
  updatePerson: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: h.getById, updatePerson: h.updatePerson, setSpeakerFacts: vi.fn() },
}))
vi.mock('@my/app/provider/dynamodb/repositories/privacy-repository', () => ({ privacyRepository: {} }))
vi.mock('@my/app/provider/dynamodb/repositories/connection-repository', () => ({ connectionRepository: {} }))
vi.mock('@my/app/provider/dynamodb/repositories/relationship-repository', () => ({ relationshipRepository: {} }))
vi.mock('../utils/dynamodb/locations', () => ({ getEcclesiaByName: vi.fn() }))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: vi.fn() }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: vi.fn() }))

const target = {
  personId: PERSON_ID,
  firstName: 'Benjamin',
  lastName: 'Sample',
  displayName: 'Benjamin Sample',
  ecclesia: 'Toronto East Ecclesia',
  primaryEmail: 'benjamin@example.com',
}

function patch(body: unknown): any {
  return new Request(`https://site.example/api/people/${PERSON_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ email: PERSON_ID }) }

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'owner@example.com', role: 'owner' } })
  h.getById.mockResolvedValue(target)
  h.updatePerson.mockImplementation(async (_id: string, updates: Record<string, string>) => ({ ...target, ...updates }))
})

describe('PATCH /api/people/[id] — preferred name', () => {
  it('saves trimmed preferred first and last names and returns them', async () => {
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ preferredFirstName: ' Ben ', preferredLastName: '' }), params)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(h.updatePerson).toHaveBeenCalledWith(PERSON_ID, { preferredFirstName: 'Ben', preferredLastName: '' })
    expect(body.profile.preferredFirstName).toBe('Ben')
    expect(body.profile.preferredLastName).toBe('')
    // The legal name and displayName are untouched.
    expect(body.profile.name).toBe('Benjamin Sample')
  })

  it('a preferred name alone is enough to save', async () => {
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ preferredLastName: 'Married' }), params)
    expect(res.status).toBe(200)
    expect(h.updatePerson).toHaveBeenCalledWith(PERSON_ID, { preferredLastName: 'Married' })
  })

  it('members cannot set it', async () => {
    h.auth.mockResolvedValue({ user: { email: 'member@example.com', role: 'member' } })
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ preferredFirstName: 'Ben' }), params)
    expect(res.status).toBe(403)
    expect(h.updatePerson).not.toHaveBeenCalled()
  })
})
