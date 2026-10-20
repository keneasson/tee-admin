import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getById: vi.fn(),
  getByEmail: vi.fn(),
  getEcclesiaByName: vi.fn(),
  setRecordingBrother: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getById: h.getById,
    getByEmail: h.getByEmail,
    listInterEcclesiaReps: vi.fn(async () => []),
    listRecordingBrothers: vi.fn(async () => []),
  },
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  getAllEcclesia: vi.fn(async () => []),
  getEcclesiaByName: h.getEcclesiaByName,
}))
vi.mock('@/utils/rb-service', () => ({ setRecordingBrother: h.setRecordingBrother }))

import { GET, POST } from '../app/api/admin/recording-brothers/route'

const post = (body: unknown) =>
  POST(new Request('http://x/api/admin/recording-brothers', { method: 'POST', body: JSON.stringify(body) }) as any)
const as = (role: string) => h.auth.mockResolvedValue({ user: { email: 'me@example.org', role } })

const BROTHER = { personId: 'p1', ecclesia: 'Alpha', primaryEmail: 'brother@example.org', displayName: 'Brother' }

describe('/api/admin/recording-brothers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getById.mockResolvedValue(BROTHER)
    h.getEcclesiaByName.mockResolvedValue({ name: 'Alpha' })
    h.getByEmail.mockResolvedValue(null)
  })

  it('is owner and admin only', async () => {
    h.auth.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    for (const role of ['member', 'rep', 'guest']) {
      as(role)
      expect((await GET()).status).toBe(403)
      expect((await post({ ecclesiaName: 'Alpha', personId: 'p1' })).status).toBe(403)
    }
    as('admin')
    expect((await GET()).status).toBe(200)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it("refuses a person recorded at another ecclesia", async () => {
    as('owner')
    const res = await post({ ecclesiaName: 'Beta', personId: 'p1' })
    expect(res.status).toBe(400)
    expect(h.setRecordingBrother).not.toHaveBeenCalled()
  })

  it("sets the person's own address when the ecclesia has none on file", async () => {
    as('owner')
    expect((await post({ ecclesiaName: 'Alpha', personId: 'p1' })).status).toBe(200)
    expect(h.setRecordingBrother).toHaveBeenCalledWith(
      expect.objectContaining({ ecclesiaName: 'Alpha', newPersonId: 'p1', emailPreference: 'personal', rbEcclesiaEmail: undefined })
    )
  })

  it('keeps a role mailbox on file (nobody\'s primary)', async () => {
    as('owner')
    h.getEcclesiaByName.mockResolvedValue({ name: 'Alpha', recordingBrotherEmail: 'Office@Example.org' })
    h.getByEmail.mockResolvedValue({ personId: 'old', primaryEmail: 'old@example.org' })
    await post({ ecclesiaName: 'Alpha', personId: 'p1' })
    expect(h.setRecordingBrother).toHaveBeenCalledWith(
      expect.objectContaining({ emailPreference: 'ecclesia', rbEcclesiaEmail: 'office@example.org' })
    )
  })

  it("never hands the previous RB's own address to the new one", async () => {
    as('owner')
    h.getEcclesiaByName.mockResolvedValue({ name: 'Alpha', recordingBrotherEmail: 'old@example.org' })
    h.getByEmail.mockResolvedValue({ personId: 'old', primaryEmail: 'old@example.org' })
    await post({ ecclesiaName: 'Alpha', personId: 'p1' })
    expect(h.setRecordingBrother).toHaveBeenCalledWith(expect.objectContaining({ emailPreference: 'personal' }))
  })
})
