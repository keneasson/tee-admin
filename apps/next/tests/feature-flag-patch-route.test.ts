/**
 * Saving a flag that exists only as a code default (no DB row) creates its row.
 * It used to 404 "Flag not found", so the admin page silently kept showing "off".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const repo = vi.hoisted(() => ({
  getByName: vi.fn(),
  updateFlag: vi.fn(),
  createFlag: vi.fn(),
}))
vi.mock('@/utils/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'owner@x.org', role: 'owner' } })),
}))
vi.mock('@my/app/provider/dynamodb/repositories/feature-flag-repository', () => ({
  featureFlagRepository: repo,
}))

import { PATCH } from '../app/api/admin/feature-flags/[flag]/route'
import { DEFAULT_FEATURE_FLAG_CONFIGS } from '@my/app/features/feature-flags/feature-flags'

const patch = (flag: string, body: object) =>
  PATCH(new Request('http://x/api', { method: 'PATCH', body: JSON.stringify(body) }) as any, {
    params: Promise.resolve({ flag }),
  })

describe('PATCH /api/admin/feature-flags/[flag]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo.createFlag.mockImplementation(async (flagName, config) => ({ flagName, ...config }))
    repo.updateFlag.mockImplementation(async (flagName, updates) => ({ flagName, ...updates }))
  })

  it('creates the row from the code default when the flag has none', async () => {
    const flag = Object.keys(DEFAULT_FEATURE_FLAG_CONFIGS)[0]
    repo.getByName.mockResolvedValue(null)
    const res = await patch(flag, { visibleTo: 'everyone' })
    expect(res.status).toBe(200)
    expect(repo.updateFlag).not.toHaveBeenCalled()
    expect(repo.createFlag).toHaveBeenCalledWith(flag, {
      ...DEFAULT_FEATURE_FLAG_CONFIGS[flag],
      visibleTo: 'everyone',
    })
  })

  it('updates an existing row', async () => {
    repo.getByName.mockResolvedValue({ flagName: 'f', visibleTo: 'off' })
    const res = await patch('f', { visibleTo: 'everyone' })
    expect(res.status).toBe(200)
    expect(repo.updateFlag).toHaveBeenCalledWith('f', { visibleTo: 'everyone' })
    expect(repo.createFlag).not.toHaveBeenCalled()
  })

  it('404s a flag that is neither in the DB nor in code', async () => {
    repo.getByName.mockResolvedValue(null)
    const res = await patch('no_such_flag', { visibleTo: 'everyone' })
    expect(res.status).toBe(404)
  })
})
