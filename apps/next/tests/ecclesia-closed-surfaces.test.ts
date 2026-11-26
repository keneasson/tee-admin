/**
 * A closed ecclesia is FINDABLE (directory, search, history) but never chosen
 * or sent to: event sharing, new mailing lists, assignment of people/content.
 * Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  ecclesias: [] as any[],
  createBulkNotifications: vi.fn(async () => {}),
}))

vi.mock('@/utils/dynamodb/locations', () => ({
  getAllEcclesia: vi.fn(async () => h.ecclesias),
  getEcclesiaByName: vi.fn(async (name: string) => h.ecclesias.find((e) => e.name === name) ?? null),
}))
vi.mock('../utils/dynamodb/locations', () => ({
  getAllEcclesia: vi.fn(async () => h.ecclesias),
  getEcclesiaByName: vi.fn(async (name: string) => h.ecclesias.find((e) => e.name === name) ?? null),
}))
vi.mock('@/utils/ecclesia-offices', () => ({
  recordingBrothersOf: vi.fn(async (list: any[]) => new Map(list.map((e) => [e.ecclesiaId, { email: `rb@${e.ecclesiaId}.example.org` }]))),
}))
vi.mock('@my/app/provider/dynamodb/repositories/notification-repository', () => ({
  notificationRepository: { createBulkNotifications: h.createBulkNotifications },
}))
vi.mock('@my/app/services/event-sharing-resolver', () => ({ getEffectiveSharingScope: () => 'global' }))

import { notifyRBsOfSharedEvent } from '../utils/notify-rbs-of-shared-event'
import { refuseClosedEcclesia } from '../utils/ecclesia-assignment'
import { parseClosure } from '../utils/ecclesia-closure'
import { validateNewList } from '../utils/mailing-lists/create-list'

const e = (name: string, extra: Record<string, any> = {}) => ({
  name,
  ecclesiaId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  country: 'CA',
  province: 'ON',
  city: 'Placeville',
  ...extra,
})

beforeEach(() => {
  h.ecclesias = [e('Host Ecclesia'), e('Open Ecclesia'), e('Folded Ecclesia', { status: 'closed', closedYear: 2019 })]
  h.createBulkNotifications.mockClear()
})

describe('event sharing', () => {
  it('never notifies a closed ecclesia', async () => {
    await notifyRBsOfSharedEvent({ id: 'ev', title: 'Placeholder', type: 'general', hostingEcclesia: { name: 'Host Ecclesia' } } as any)
    expect(h.createBulkNotifications).toHaveBeenCalledWith(['rb@open-ecclesia.example.org'], expect.anything())
  })
})

describe('assigning a person to an ecclesia', () => {
  it('refuses a closed ecclesia (409)', async () => {
    const res = await refuseClosedEcclesia('Folded Ecclesia')
    expect(res?.status).toBe(409)
    expect((await res!.json()).code).toBe('ECCLESIA_CLOSED')
  })
  it('allows an active ecclesia, free text, and keeping the current (closed) one', async () => {
    expect(await refuseClosedEcclesia('Open Ecclesia')).toBeNull()
    expect(await refuseClosedEcclesia('Not In The Directory')).toBeNull()
    expect(await refuseClosedEcclesia('Folded Ecclesia', 'Folded Ecclesia')).toBeNull()
    expect(await refuseClosedEcclesia(undefined)).toBeNull()
  })
})

describe('mailing-list setup', () => {
  const owners = [
    { ownerType: 'ecclesia' as const, ownerId: 'open-ecclesia', name: 'Open Ecclesia' },
    { ownerType: 'ecclesia' as const, ownerId: 'folded-ecclesia', name: 'Folded Ecclesia', closed: true },
  ]
  const body = (ownerId: string) => ({ ownerType: 'ecclesia', ownerId, name: 'News', category: 'newsletters', scope: 'ecclesia' })

  it('a closed ecclesia cannot own a new list', () => {
    expect(validateNewList(body('folded-ecclesia'), owners, [])).toEqual({ ok: false, error: expect.stringContaining('closed') })
    expect(validateNewList(body('open-ecclesia'), owners, []).ok).toBe(true)
  })
})

describe('parseClosure (owner/admin close / reopen)', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  it('closed with optional year + note', () => {
    expect(parseClosure({ status: 'closed', closedYear: '2019', closedNote: '  Placeholder  ' }, now)).toEqual({
      ok: true,
      updates: { status: 'closed', closedYear: 2019, closedNote: 'Placeholder' },
    })
    expect(parseClosure({ status: 'closed' }, now)).toEqual({ ok: true, updates: { status: 'closed', closedYear: null, closedNote: null } })
  })
  it('reopen clears year + note', () => {
    expect(parseClosure({ status: 'active', closedYear: 2019 }, now)).toEqual({
      ok: true,
      updates: { status: 'active', closedYear: null, closedNote: null },
    })
  })
  it('rejects a bad status, a future year, and an over-long note', () => {
    expect(parseClosure({ status: 'gone' }, now).ok).toBe(false)
    expect(parseClosure({ status: 'closed', closedYear: 2099 }, now).ok).toBe(false)
    expect(parseClosure({ status: 'closed', closedNote: 'x'.repeat(281) }, now).ok).toBe(false)
  })
})
