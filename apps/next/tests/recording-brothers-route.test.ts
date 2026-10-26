import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getById: vi.fn(),
  getByEmail: vi.fn(),
  listByEcclesia: vi.fn(),
  create: vi.fn(),
  updatePerson: vi.fn(),
  getEcclesiaByName: vi.fn(),
  setRecordingBrother: vi.fn(),
  listOfficeViews: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getById: h.getById,
    getByEmail: h.getByEmail,
    listByEcclesia: h.listByEcclesia,
    create: h.create,
    updatePerson: h.updatePerson,
    listInterEcclesiaReps: vi.fn(async () => []),
    listRecordingBrothers: vi.fn(async () => []),
  },
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  getAllEcclesia: vi.fn(async () => []),
  getEcclesiaByName: h.getEcclesiaByName,
}))
vi.mock('@/utils/rb-service', () => ({ setRecordingBrother: h.setRecordingBrother }))
vi.mock('@my/app/provider/dynamodb/repositories/office-repository', () => ({
  OFFICE_ROLES: { RECORDING_BROTHER: 'rb' },
  officeRepository: { listOfficeViews: h.listOfficeViews },
}))
vi.mock('@my/app/provider/dynamodb/people-index', () => ({ ecclesiaIdOf: (e: { name: string }) => e.name.toLowerCase() }))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: vi.fn() }))

import { GET, POST } from '../app/api/admin/recording-brothers/route'

const post = (body: unknown) =>
  POST(new Request('http://x/api/admin/recording-brothers', { method: 'POST', body: JSON.stringify(body) }) as any)
const as = (role: string) => h.auth.mockResolvedValue({ user: { email: 'me@example.org', role } })
const profile = (x: object) => ({ skey: 'PROFILE', role: 'member', ...x })

const BROTHER = profile({ personId: 'p1', ecclesia: 'Alpha', primaryEmail: 'brother@example.org', displayName: 'Brother' })
const MAILBOX = profile({ personId: 'mb', ecclesia: 'Alpha', primaryEmail: 'alphamailbox@example.org', displayName: '' })

describe('/api/admin/recording-brothers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getById.mockResolvedValue(BROTHER)
    h.getEcclesiaByName.mockResolvedValue({ name: 'Alpha' })
    h.getByEmail.mockResolvedValue(null)
    h.listByEcclesia.mockResolvedValue({ items: [BROTHER, MAILBOX] })
    h.create.mockResolvedValue({ personId: 'new1' })
    h.listOfficeViews.mockResolvedValue(new Map())
  })

  it('is owner and admin only', async () => {
    h.auth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    for (const role of ['member', 'rep', 'guest']) {
      as(role)
      expect((await GET()).status).toBe(403)
      expect((await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'own' })).status).toBe(403)
    }
    as('admin')
    expect((await GET()).status).toBe(200)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it('refuses a person recorded at another ecclesia', async () => {
    as('owner')
    h.getEcclesiaByName.mockResolvedValue({ name: 'Beta' })
    const res = await post({ ecclesiaName: 'Beta', personId: 'p1', mailTo: 'own' })
    expect(res.status).toBe(400)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it("sends ecclesia mail to the RB's own email when asked", async () => {
    as('owner')
    expect((await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'own' })).status).toBe(200)
    expect(h.setRecordingBrother).toHaveBeenCalledWith(
      expect.objectContaining({ ecclesiaName: 'Alpha', newPersonId: 'p1', emailPreference: 'personal', rbEcclesiaEmail: undefined })
    )
  })

  it("keeps ecclesia mail at the ecclesia's mailbox, without copying it onto the RB", async () => {
    as('owner')
    await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'AlphaMailbox@example.org' })
    expect(h.setRecordingBrother).toHaveBeenCalledWith(
      expect.objectContaining({
        emailPreference: 'ecclesia',
        rbEcclesiaEmail: 'alphamailbox@example.org',
      })
    )
  })

  it("keeps ecclesia mail at the RB office's own address when the RB changes", async () => {
    as('owner')
    h.listOfficeViews.mockResolvedValue(
      new Map([['alpha', [{ office: { kind: 'rb', email: 'office@alpha.org', holderPersonId: 'old' }, holder: { personId: 'old', displayName: 'Old', primaryEmail: 'old@x.org' } }]]])
    )
    expect((await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'office@alpha.org' })).status).toBe(200)
    expect(h.setRecordingBrother).toHaveBeenCalledWith(
      expect.objectContaining({ emailPreference: 'ecclesia', rbEcclesiaEmail: 'office@alpha.org' })
    )
    // The previous holder's own address is never an address on file.
    h.setRecordingBrother.mockClear()
    expect((await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'old@x.org' })).status).toBe(400)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it('refuses a nameless record: it is an address, not a person', async () => {
    as('owner')
    h.getById.mockResolvedValue({ ...MAILBOX, ecclesia: 'Alpha' })
    expect((await post({ ecclesiaName: 'Alpha', personId: 'mb', mailTo: 'own' })).status).toBe(400)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it("refuses an address that isn't on file for the ecclesia (e.g. a person's own)", async () => {
    as('owner')
    h.getEcclesiaByName.mockResolvedValue({ name: 'Alpha', recordingBrotherEmail: 'brother@example.org' })
    const res = await post({ ecclesiaName: 'Alpha', personId: 'p1', mailTo: 'brother@example.org' })
    expect(res.status).toBe(400)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it('adds a new person with no email and sets them', async () => {
    as('owner')
    const res = await post({
      ecclesiaName: 'Alpha',
      newPerson: { firstName: 'Peter', lastName: 'Biswas' },
      mailTo: 'own',
    })
    expect(res.status).toBe(200)
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Peter', lastName: 'Biswas', email: undefined, allowNoEmail: true, ecclesia: 'Alpha' })
    )
    expect(h.setRecordingBrother).toHaveBeenCalledWith(expect.objectContaining({ newPersonId: 'new1' }))
  })

  it("won't add a person whose email is already someone's", async () => {
    as('owner')
    h.getByEmail.mockResolvedValue({ personId: 'x', displayName: 'Someone' })
    const res = await post({
      ecclesiaName: 'Alpha',
      newPerson: { firstName: 'A', lastName: 'B', email: 'taken@example.org' },
      mailTo: 'own',
    })
    expect(res.status).toBe(409)
    expect(h.create).not.toHaveBeenCalled()
  })

  it('names the nameless record when its address is typed as the new person\'s email', async () => {
    as('owner')
    h.getByEmail.mockResolvedValue(MAILBOX)
    const res = await post({
      ecclesiaName: 'Alpha',
      newPerson: { firstName: 'Ann', lastName: 'Example', email: 'AlphaMailbox@example.org' },
      mailTo: 'own',
    })
    expect(res.status).toBe(200)
    expect(h.create).not.toHaveBeenCalled()
    expect(h.updatePerson).toHaveBeenCalledWith('mb', { firstName: 'Ann', lastName: 'Example' })
    expect(h.setRecordingBrother).toHaveBeenCalledWith(expect.objectContaining({ newPersonId: 'mb' }))
  })

  it("won't name a nameless record at another ecclesia", async () => {
    as('owner')
    h.getByEmail.mockResolvedValue({ ...MAILBOX, ecclesia: 'Beta' })
    const res = await post({
      ecclesiaName: 'Alpha',
      newPerson: { firstName: 'Ann', lastName: 'Example', email: 'alphamailbox@example.org' },
      mailTo: 'own',
    })
    expect(res.status).toBe(409)
    expect(h.updatePerson).not.toHaveBeenCalled()
    expect(h.create).not.toHaveBeenCalled()
  })
})
