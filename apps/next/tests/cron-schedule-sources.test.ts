/**
 * Nightly schedule sync cron (docs/ECCLESIA_SCHEDULES.md §API; behaviour
 * docs/behavior/ecclesia-schedules.md). Repository and sync are mocked.
 */
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

const h = vi.hoisted(() => ({ listAllEntries: vi.fn(), syncEntry: vi.fn() }))

vi.mock('@my/app/provider/dynamodb/repositories/schedule-registry-repository', () => ({
  scheduleRegistryRepository: { listAllEntries: h.listAllEntries },
}))
vi.mock('@my/app/provider/schedule-sources/sync', () => ({ syncEntry: h.syncEntry }))

import { GET } from '@/app/api/cron/schedule-sources/route'

const saved = process.env.EMAIL_SENDER_SECRET
process.env.EMAIL_SENDER_SECRET = 'test-secret'
afterAll(() => {
  if (saved === undefined) delete process.env.EMAIL_SENDER_SECRET
  else process.env.EMAIL_SENDER_SECRET = saved
})

// next/server is mocked in tests/setup.ts; a plain Request carries the headers.
const call = (auth?: string) =>
  GET(new Request('http://x/api/cron/schedule-sources', { headers: auth ? { authorization: auth } : {} }) as any)

const e = (id: string, kind: 'google-sheets' | 'env' | 'native', active = true) => ({
  ecclesiaId: id,
  scheduleId: 'memorial',
  kind: 'memorial',
  active,
  source: { kind },
})

beforeEach(() => {
  vi.clearAllMocks()
  h.listAllEntries.mockResolvedValue([e('a', 'google-sheets'), e('b', 'env'), e('c', 'native'), e('d', 'google-sheets', false), e('f', 'google-sheets')])
  h.syncEntry.mockImplementation(async (entry: any) =>
    entry.ecclesiaId === 'f' ? Promise.reject(new Error('boom')) : { status: 'ok', rows: 3, written: 3, failed: 0, errors: [] }
  )
})

describe('GET /api/cron/schedule-sources', () => {
  it('ECSCHED-18: without the bearer secret → 401 and nothing is read', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(h.listAllEntries).not.toHaveBeenCalled()
  })

  it('ECSCHED-18: syncs only ACTIVE google-sheets entries; one failure does not stop the rest', async () => {
    const res = await call('Bearer test-secret')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(h.syncEntry.mock.calls.map((c) => c[0].ecclesiaId)).toEqual(['a', 'f'])
    expect(json).toMatchObject({ success: true, synced: 1, failed: 1 })
    expect(json.results).toEqual([
      { ecclesiaId: 'a', scheduleId: 'memorial', status: 'ok', rows: 3, failed: 0 },
      { ecclesiaId: 'f', scheduleId: 'memorial', status: 'error', code: 'UNEXPECTED' },
    ])
  })
})
