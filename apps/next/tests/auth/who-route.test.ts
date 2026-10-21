import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ auth: vi.fn(), holders: vi.fn() }))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getAllPersonsByEmail: h.holders, getByEmail: vi.fn() },
}))

import { GET, POST } from '../../app/api/auth/who/route'

const HOME = 'home@example.org'
const post = (body: unknown) =>
  POST(new Request('http://x/api/auth/who', { method: 'POST', body: JSON.stringify(body) }) as any)

describe('/api/auth/who', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.auth.mockResolvedValue({ user: { email: HOME, signInEmail: HOME, personId: 'alice', chooseIdentity: true } })
    h.holders.mockImplementation(async (a: string) =>
      a === HOME
        ? [
            { personId: 'bob', displayName: 'Bob Home', ecclesia: 'Alpha' },
            { personId: 'alice', displayName: 'Alice Home', ecclesia: 'Alpha' },
          ]
        : []
    )
  })

  it('needs a session', async () => {
    h.auth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await post({ personId: 'bob' })).status).toBe(401)
  })

  it('lists who can use the address the session proved', async () => {
    const body = await (await GET()).json()
    expect(body).toEqual({
      choices: [
        { personId: 'alice', name: 'Alice Home', ecclesia: 'Alpha' },
        { personId: 'bob', name: 'Bob Home', ecclesia: 'Alpha' },
      ],
      current: 'alice',
      mustChoose: true,
    })
    expect(h.holders).toHaveBeenCalledWith(HOME)
  })

  it('accepts a holder of the proven address', async () => {
    expect((await post({ personId: 'bob' })).status).toBe(200)
  })

  it("refuses a person who doesn't use the proven address", async () => {
    expect((await post({ personId: 'outsider' })).status).toBe(403)
    expect((await post({})).status).toBe(400)
  })
})
