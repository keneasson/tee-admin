import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Adding Brian to Georgina's profile made him the spouse of the ADMIN who added
 * him, not of Georgina.
 *
 * The new-person flow posted to `/api/user/relationships`, which is the
 * signed-in user's OWN family and hardcodes `session.user.email` as the source
 * of the relationship. From a profile page that is always the wrong person.
 *
 * Creating-and-linking now happens on the PERSON-SCOPED contacts route, whose
 * source is `targetPerson.primaryEmail` — the person whose page you are on.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getByEmail: vi.fn(),
  create: vi.fn(),
  getAddresses: vi.fn(),
  getPhones: vi.fn(),
  addAddress: vi.fn(),
  addPhone: vi.fn(),
  createRelationship: vi.fn(),
  invalidatePeopleCache: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: h.invalidatePeopleCache }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.getByEmail,
    create: h.create,
    getAddresses: h.getAddresses,
    getPhones: h.getPhones,
    addAddress: h.addAddress,
    addPhone: h.addPhone,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/relationship-repository', () => ({
  relationshipRepository: { createRelationship: h.createRelationship },
}))

const GEORGINA = {
  personId: 'person-georgina',
  primaryEmail: 'bgrosewood@gmail.com',
  ecclesia: 'Toronto East Ecclesia',
  firstName: 'Georgina',
  lastName: 'Rose',
}

const ctx = () => ({ params: Promise.resolve({ email: 'bgrosewood@gmail.com' }) })
const post = (body: unknown) =>
  new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  // The ADMIN is signed in — a different person entirely from the profile.
  h.auth.mockResolvedValue({ user: { email: 'ken.easson@gmail.com', role: 'owner' } })
  h.getByEmail.mockResolvedValue(GEORGINA)
  h.create.mockResolvedValue({ personId: 'person-brian' })
  h.getAddresses.mockResolvedValue([
    { addressId: 'a1', isPrimary: true, type: 'home', street1: '1443 Elizabeth Street', city: 'Campbellcroft', province: 'ON', postalCode: 'L0A 1B0', country: 'Canada' },
  ])
  h.getPhones.mockResolvedValue([{ phoneId: 'p1', type: 'home', number: '9057973415', isHousehold: false }])
})

describe('a new family member links to the VIEWED person', () => {
  it('uses the profile owner as the source, never the signed-in admin', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')

    await POST(post({ type: 'relationship', firstName: 'Brian', lastName: 'Rose', relationshipType: 'spouse' }), ctx())

    expect(h.createRelationship).toHaveBeenCalledTimes(1)
    const [source, target, type] = h.createRelationship.mock.calls[0]
    expect(source).toBe('bgrosewood@gmail.com')      // Georgina
    expect(source).not.toBe('ken.easson@gmail.com')  // NOT the admin
    expect(target).toMatch(/@family\.local$/)        // Brian's generated key
    expect(type).toBe('spouse')
  })

  it('creates the person in the profile owner’s ecclesia, not the admin’s', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'Brian', relationshipType: 'spouse' }), ctx())
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Brian', ecclesia: 'Toronto East Ecclesia' })
    )
  })

  it('copies the household address and HOME phone when sameAddress is set', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'Brian', relationshipType: 'spouse', sameAddress: true }), ctx())

    expect(h.addAddress).toHaveBeenCalledWith(
      'person-brian',
      expect.objectContaining({ street1: '1443 Elizabeth Street', isHousehold: true })
    )
    expect(h.addPhone).toHaveBeenCalledWith(
      'person-brian',
      expect.objectContaining({ number: '9057973415', isHousehold: true })
    )
  })

  it('does not copy contacts when sameAddress is not set', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'Brian', relationshipType: 'spouse' }), ctx())
    expect(h.addAddress).not.toHaveBeenCalled()
  })

  it('invalidates the people cache so the new person is searchable at once', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'Brian', relationshipType: 'spouse' }), ctx())
    expect(h.invalidatePeopleCache).toHaveBeenCalled()
  })

  it('still links an EXISTING person by email, from the viewed person', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', targetEmail: 'other@x.z', relationshipType: 'sibling' }), ctx())
    const [source, target] = h.createRelationship.mock.calls[0]
    expect(source).toBe('bgrosewood@gmail.com')
    expect(target).toBe('other@x.z')
    expect(h.create).not.toHaveBeenCalled()
  })

  it('rejects a request with neither a target nor a name', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    const res = await POST(post({ type: 'relationship', relationshipType: 'spouse' }), ctx())
    expect(res.status).toBe(400)
    expect(h.createRelationship).not.toHaveBeenCalled()
  })
})
