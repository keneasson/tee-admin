import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A system admin changed Georgina Rose's address and NOTHING indicated it had
 * happened — because addresses and phones had no verification concept at all
 * (only emails did), so an edit silently overwrote the record.
 *
 * A change is now PROPOSED alongside the value it replaces. Both stay visible,
 * and the known-good one keeps being primary, until somebody entitled to
 * confirm it does — so nobody drives to an address that may be wrong.
 *
 * The only approval path before this was an emailed token aimed at the profile
 * owner. For a 92-year-old member that is the wrong mechanism entirely: the
 * people who can confirm her address are her Recording Brother and her Rep.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getByEmail: vi.fn(),
  getAddresses: vi.fn(),
  getPhones: vi.fn(),
  proposeAddress: vi.fn(),
  proposePhone: vi.fn(),
  verifyAddress: vi.fn(),
  verifyPhone: vi.fn(),
  clearContactVotes: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.getByEmail,
    getAddresses: h.getAddresses,
    getPhones: h.getPhones,
    proposeAddress: h.proposeAddress,
    proposePhone: h.proposePhone,
    verifyAddress: h.verifyAddress,
    verifyPhone: h.verifyPhone,
    clearContactVotes: h.clearContactVotes,
  },
}))

const target = {
  personId: 'person-georgina',
  primaryEmail: 'bgrosewood@gmail.com',
  ecclesia: 'Toronto East Ecclesia',
  firstName: 'Georgina',
  lastName: 'Rose',
}

const ctx = () => ({ params: Promise.resolve({ email: 'bgrosewood@gmail.com' }) })

beforeEach(() => {
  vi.clearAllMocks()
  h.getByEmail.mockResolvedValue(target)
  h.getAddresses.mockResolvedValue([
    { addressId: 'addr-old', isPrimary: true, verified: true, street1: '1443 Elizabeth Street' },
  ])
  h.getPhones.mockResolvedValue([
    { phoneId: 'ph-old', isPrimary: true, verified: true, number: '9057973415' },
  ])
  h.proposeAddress.mockResolvedValue({
    addressId: 'addr-new', type: 'home', street1: '12 New Rd', city: 'Peterborough',
    verified: false, supersedesId: 'addr-old',
  })
  h.proposePhone.mockResolvedValue({
    phoneId: 'ph-new', type: 'home', number: '7051234567',
    verified: false, supersedesId: 'ph-old',
  })
})

describe('a contact edit is PROPOSED, not silently applied', () => {
  it('an address edit creates an unverified proposal against the current one', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue({ user: { email: 'admin@x.z', role: 'owner' } })

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        type: 'address', addressType: 'home', street1: '12 New Rd',
        city: 'Peterborough', province: 'ON', postalCode: 'K9H 1A1',
      }),
    }) as never

    const res = await POST(req, ctx())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pending).toBe(true)
    expect(data.record.verified).toBe(false)
    // It points at the value it would replace, so both can be shown together.
    expect(data.record.supersedesId).toBe('addr-old')
    // The proposer is recorded, so "update pending" can say by whom.
    expect(h.proposeAddress).toHaveBeenCalledWith(
      'person-georgina', expect.anything(), 'admin@x.z', 'addr-old'
    )
  })

  it('a phone edit behaves the same way', async () => {
    const { POST } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue({ user: { email: 'admin@x.z', role: 'owner' } })

    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ type: 'phone', phoneType: 'home', number: '7051234567' }),
    }) as never

    const data = await (await POST(req, ctx())).json()
    expect(data.pending).toBe(true)
    expect(data.record.verified).toBe(false)
    expect(data.record.supersedesId).toBe('ph-old')
  })
})

describe('confirming a proposal — in-app, by the people who would know', () => {
  const patch = (body: unknown) =>
    new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never

  it('a Recording Brother can confirm an address', async () => {
    const { PATCH } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue({ user: { email: 'rb@x.z', role: 'recorder' } })
    h.verifyAddress.mockResolvedValue({ addressId: 'addr-new', verified: true })

    const res = await PATCH(patch({ type: 'address', id: 'addr-new' }), ctx())
    expect(res.status).toBe(200)
    expect(h.verifyAddress).toHaveBeenCalledWith('person-georgina', 'addr-new', 'rb@x.z')
    // The value is settled, so the community confirmations about it are spent.
    // Leaving them would show a stale "needs 1 more" on a confirmed address.
    expect(h.clearContactVotes).toHaveBeenCalledWith('person-georgina', 'address', 'addr-new')
  })

  it('an ordinary member cannot confirm', async () => {
    const { PATCH } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue({ user: { email: 'member@x.z', role: 'member' } })

    const res = await PATCH(patch({ type: 'address', id: 'addr-new' }), ctx())
    expect(res.status).toBe(403)
    expect(h.verifyAddress).not.toHaveBeenCalled()
  })

  it('a signed-out visitor cannot confirm', async () => {
    const { PATCH } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue(null)

    expect((await PATCH(patch({ type: 'address', id: 'x' }), ctx())).status).toBe(401)
    expect(h.verifyAddress).not.toHaveBeenCalled()
  })

  it('rejects an unknown contact type rather than guessing', async () => {
    const { PATCH } = await import('../app/api/people/[email]/contacts/route')
    h.auth.mockResolvedValue({ user: { email: 'admin@x.z', role: 'owner' } })

    expect((await PATCH(patch({ type: 'nickname', id: 'x' }), ctx())).status).toBe(400)
  })
})
