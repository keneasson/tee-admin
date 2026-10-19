import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Adding a new family member on someone's profile made them the spouse of the
 * ADMIN who added them, not of the person whose profile it was.
 *
 * The new-person flow posted to `/api/user/relationships`, which is the
 * signed-in user's OWN family and hardcodes `session.user.email` as the source
 * of the relationship. From a profile page that is always the wrong person.
 *
 * Creating-and-linking now happens on the PERSON-SCOPED contacts route, whose
 * source is the person whose page you are on. Relationships are keyed by
 * personId (R7), so both ends are person ids, never addresses.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getByEmail: vi.fn(),
  getById: vi.fn(),
  getAllPersonsByEmail: vi.fn(),
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
    getById: h.getById,
    getAllPersonsByEmail: h.getAllPersonsByEmail,
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

const VIEWED = {
  personId: 'person-viewed',
  primaryEmail: 'viewed@example.org',
  ecclesia: 'Toronto East Ecclesia',
  firstName: 'Viewed',
  lastName: 'Person',
}
const OTHER = { personId: 'person-other', primaryEmail: 'other@example.org', firstName: 'Other' }

const ctx = () => ({ params: Promise.resolve({ email: 'viewed@example.org' }) })
const post = (body: unknown) =>
  new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  // The ADMIN is signed in — a different person entirely from the profile.
  h.auth.mockResolvedValue({ user: { email: 'admin@example.org', role: 'owner' } })
  h.getByEmail.mockImplementation(async (email: string) => (email === 'other@example.org' ? OTHER : VIEWED))
  h.getById.mockImplementation(async (id: string) => (id === OTHER.personId ? OTHER : id === VIEWED.personId ? VIEWED : null))
  h.create.mockResolvedValue({ personId: 'person-new' })
  h.getAddresses.mockResolvedValue([
    { addressId: 'a1', isPrimary: true, type: 'home', street1: '1 Example Street', city: 'Exampleton', province: 'ON', postalCode: 'A1A 1A1', country: 'Canada' },
  ])
  h.getPhones.mockResolvedValue([{ phoneId: 'p1', type: 'home', number: '5550100000', isHousehold: false }])
})

describe('a new family member links to the VIEWED person', () => {
  it('uses the profile owner as the source, never the signed-in admin', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')

    await POST(post({ type: 'relationship', firstName: 'New', lastName: 'Person', relationshipType: 'spouse' }), ctx())

    expect(h.createRelationship).toHaveBeenCalledTimes(1)
    const [source, target, type] = h.createRelationship.mock.calls[0]
    expect(source).toBe('person-viewed') // the viewed person, by id
    expect(target).toBe('person-new')    // the created person, by id
    expect(type).toBe('spouse')
    // The new person's PROFILE still gets a placeholder primary, never a mailbox.
    expect(h.create.mock.calls[0][0].email).toMatch(/@family\.local$/)
  })

  it('creates the person in the profile owner’s ecclesia, not the admin’s', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'New', relationshipType: 'spouse' }), ctx())
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'New', ecclesia: 'Toronto East Ecclesia' })
    )
  })

  it('copies the household address and HOME phone when sameAddress is set', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'New', relationshipType: 'spouse', sameAddress: true }), ctx())

    expect(h.addAddress).toHaveBeenCalledWith(
      'person-new',
      expect.objectContaining({ street1: '1 Example Street', isHousehold: true })
    )
    expect(h.addPhone).toHaveBeenCalledWith(
      'person-new',
      expect.objectContaining({ number: '5550100000', isHousehold: true })
    )
  })

  it('does not copy contacts when sameAddress is not set', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'New', relationshipType: 'spouse' }), ctx())
    expect(h.addAddress).not.toHaveBeenCalled()
  })

  it('invalidates the people cache so the new person is searchable at once', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', firstName: 'New', relationshipType: 'spouse' }), ctx())
    expect(h.invalidatePeopleCache).toHaveBeenCalled()
  })

  it('links an EXISTING person picked by id, from the viewed person', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', targetPersonId: 'person-other', relationshipType: 'sibling' }), ctx())
    expect(h.createRelationship).toHaveBeenCalledWith('person-viewed', 'person-other', 'sibling')
    expect(h.create).not.toHaveBeenCalled()
  })

  it('resolves an address to the person who holds it', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    await POST(post({ type: 'relationship', targetEmail: 'other@example.org', relationshipType: 'sibling' }), ctx())
    expect(h.createRelationship).toHaveBeenCalledWith('person-viewed', 'person-other', 'sibling')
  })

  it('404s when the picked person does not exist (nothing written)', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    const res = await POST(post({ type: 'relationship', targetPersonId: 'person-missing', relationshipType: 'sibling' }), ctx())
    expect(res.status).toBe(404)
    expect(h.createRelationship).not.toHaveBeenCalled()
  })

  it('rejects a request with neither a target nor a name', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    const res = await POST(post({ type: 'relationship', relationshipType: 'spouse' }), ctx())
    expect(res.status).toBe(400)
    expect(h.createRelationship).not.toHaveBeenCalled()
  })
})
