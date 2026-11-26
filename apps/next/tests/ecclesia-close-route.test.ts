/**
 * We never delete an ecclesia: the page's Danger Zone closes / reopens it
 * through PATCH /api/ecclesia/[name], and no route deletes one. Placeholder data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  canEdit: vi.fn(async () => true),
  updateEcclesiaFields: vi.fn(async (name: string, updates: any) => ({ name, ...updates })),
}))
vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@/utils/ecclesia-permissions', () => ({
  checkEcclesiaEditPermission: h.canEdit,
  checkRecordingBrotherPermission: vi.fn(async () => false),
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  getEcclesiaByName: vi.fn(async (name: string) => ({ name })),
  updateEcclesiaFields: h.updateEcclesiaFields,
}))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({ checkFeatureFlagFromDB: vi.fn(async () => false) }))
vi.mock('@/utils/rb-service', () => ({ setRecordingBrother: vi.fn(), clearRecordingBrother: vi.fn() }))
vi.mock('@/utils/email/send-rb-confirmation', () => ({ sendRBConfirmationEmail: vi.fn() }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({ personRepository: {} }))
vi.mock('@/utils/geocode-ecclesia', () => ({ geocodeAndUpdateEcclesia: vi.fn(async () => {}) }))
vi.mock('@/utils/ecclesia-offices', () => ({ officesOf: vi.fn(), recordingBrotherOf: vi.fn() }))

import { PATCH } from '../app/api/ecclesia/[name]/route'
import * as ecclesiaRoute from '../app/api/ecclesia/route'

const NAME = 'Folding Example Ecclesia'
const call = (body: any) =>
  PATCH(new Request(`http://x/api/ecclesia/${encodeURIComponent(NAME)}`, { method: 'PATCH', body: JSON.stringify(body) }) as any, {
    params: Promise.resolve({ name: encodeURIComponent(NAME) }),
  })

beforeEach(() => {
  h.updateEcclesiaFields.mockClear()
  h.canEdit.mockResolvedValue(true)
  h.auth.mockResolvedValue({ user: { email: 'admin@example.org', role: 'admin' } })
})

describe('close / reopen through the ecclesia editor API', () => {
  it('admin closes with a year and note', async () => {
    const res = await call({ status: 'closed', closedYear: 2024, closedNote: 'Members have joined other ecclesias' })
    expect(res.status).toBe(200)
    expect(h.updateEcclesiaFields).toHaveBeenCalledWith(NAME, {
      status: 'closed',
      closedYear: 2024,
      closedNote: 'Members have joined other ecclesias',
    })
  })

  it('reopen clears the year and note', async () => {
    expect((await call({ status: 'active' })).status).toBe(200)
    expect(h.updateEcclesiaFields).toHaveBeenCalledWith(NAME, { status: 'active', closedYear: null, closedNote: null })
  })

  it('only an owner/admin may close, even with edit rights', async () => {
    h.auth.mockResolvedValue({ user: { email: 'rb@example.org', role: 'member' } })
    expect((await call({ status: 'closed', closedYear: 2024 })).status).toBe(403)
    expect(h.updateEcclesiaFields).not.toHaveBeenCalled()
  })

  it('a bad year is refused', async () => {
    expect((await call({ status: 'closed', closedYear: 3000 })).status).toBe(400)
    expect(h.updateEcclesiaFields).not.toHaveBeenCalled()
  })
})

describe('no route deletes an ecclesia', () => {
  it('/api/ecclesia has no DELETE handler', () => {
    expect('DELETE' in ecclesiaRoute).toBe(false)
  })
  it('/api/ecclesia/[name] has no DELETE handler', async () => {
    expect('DELETE' in (await import('../app/api/ecclesia/[name]/route'))).toBe(false)
  })
})
