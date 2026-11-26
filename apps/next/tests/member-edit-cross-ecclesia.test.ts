import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Owner/Admin manage members of EVERY ecclesia, even when they also hold the
 * Recording Brother designation (that used to send them down the same-ecclesia
 * branch → 403). A Recorder/Rep/RB alone stays limited to their own ecclesia.
 * Moving someone OFF a closed ecclesia is allowed; ONTO one is refused.
 * Placeholder data only.
 */

const PERSON_ID = '11111111-2222-3333-4444-666666666666'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getById: vi.fn(),
  updatePerson: vi.fn(),
  viewer: vi.fn(),
  ecclesias: {} as Record<string, any>,
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: h.getById, updatePerson: h.updatePerson, setSpeakerFacts: vi.fn() },
}))
vi.mock('@my/app/provider/dynamodb/repositories/privacy-repository', () => ({ privacyRepository: {} }))
vi.mock('@my/app/provider/dynamodb/repositories/connection-repository', () => ({ connectionRepository: {} }))
vi.mock('@my/app/provider/dynamodb/repositories/relationship-repository', () => ({ relationshipRepository: {} }))
vi.mock('../utils/dynamodb/locations', () => ({
  getEcclesiaByName: vi.fn(async (name: string) => h.ecclesias[name] ?? null),
}))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: vi.fn() }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.viewer }))

const CLOSED = 'Folded Example Ecclesia'
const OPEN = 'Open Example Ecclesia'
const VIEWER_HOME = 'Viewer Home Ecclesia'

const target = {
  personId: PERSON_ID,
  firstName: 'Placeholder',
  lastName: 'Member',
  displayName: 'Placeholder Member',
  ecclesia: CLOSED,
  primaryEmail: 'member@example.com',
}

const patch = (body: unknown): any =>
  new Request(`https://site.example/api/people/${PERSON_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const params = { params: Promise.resolve({ email: PERSON_ID }) }
const as = (role: string, isRecordingBrother = false) =>
  h.auth.mockResolvedValue({ user: { email: 'viewer@example.com', role, isRecordingBrother } })

beforeEach(() => {
  vi.clearAllMocks()
  h.ecclesias = {
    [CLOSED]: { name: CLOSED, status: 'closed', closedYear: 2024 },
    [OPEN]: { name: OPEN },
    [VIEWER_HOME]: { name: VIEWER_HOME },
  }
  h.getById.mockResolvedValue(target)
  h.viewer.mockResolvedValue({ personId: 'viewer', ecclesia: VIEWER_HOME, isRecordingBrother: true })
  h.updatePerson.mockImplementation(async (_id: string, updates: Record<string, string>) => ({ ...target, ...updates }))
})

describe('PATCH /api/people/[id] — member management across ecclesias', () => {
  it('owner who is also a Recording Brother edits a member of another ecclesia → 200', async () => {
    as('owner', true)
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ firstName: 'Edited' }), params)
    expect(res.status).toBe(200)
    expect(h.updatePerson).toHaveBeenCalledWith(PERSON_ID, { firstName: 'Edited' })
  })

  it('admin (also RB) does the same → 200', async () => {
    as('admin', true)
    const { PATCH } = await import('../app/api/people/[email]/route')
    expect((await PATCH(patch({ firstName: 'Edited' }), params)).status).toBe(200)
  })

  it('a Recording Brother with the member role, at another ecclesia → 403', async () => {
    as('member', true)
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ firstName: 'Edited' }), params)
    expect(res.status).toBe(403)
    expect(h.updatePerson).not.toHaveBeenCalled()
  })

  it('owner moves a person OFF a closed ecclesia onto an open one → 200', async () => {
    as('owner', true)
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ ecclesia: OPEN }), params)
    expect(res.status).toBe(200)
    expect(h.updatePerson).toHaveBeenCalledWith(PERSON_ID, { ecclesia: OPEN })
  })

  it('owner moving a person ONTO a closed ecclesia → 409', async () => {
    h.getById.mockResolvedValue({ ...target, ecclesia: OPEN })
    as('owner')
    const { PATCH } = await import('../app/api/people/[email]/route')
    const res = await PATCH(patch({ ecclesia: CLOSED }), params)
    expect(res.status).toBe(409)
    expect(h.updatePerson).not.toHaveBeenCalled()
  })
})
