/**
 * POST/DELETE /api/ecclesia/[name]/schedule: another ecclesia's manual rows
 * land in its own partition and never touch Toronto East's legacy
 * `SCHEDULE#<TYPE>` rows (docs/ECCLESIA_SCHEDULES.md §Storage). Also the
 * schedule-management gate (§Gate). Mocked client; placeholder names.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, auth, canEdit } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  auth: vi.fn(),
  canEdit: vi.fn(),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const cmd = (type: string) => vi.fn().mockImplementation((params) => ({ type, params }))
  return {
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
    QueryCommand: cmd('QueryCommand'),
    PutCommand: cmd('PutCommand'),
    GetCommand: cmd('GetCommand'),
    UpdateCommand: cmd('UpdateCommand'),
    DeleteCommand: cmd('DeleteCommand'),
    ScanCommand: cmd('ScanCommand'),
    BatchWriteCommand: cmd('BatchWriteCommand'),
    BatchGetCommand: cmd('BatchGetCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))
vi.mock('@/utils/auth', () => ({ auth }))
vi.mock('@/utils/ecclesia-permissions', () => ({ checkEcclesiaEditPermission: canEdit }))

import { POST, DELETE } from '@/app/api/ecclesia/[name]/schedule/route'
import { canManageEcclesiaSchedules } from '@/utils/ecclesia-schedule-permissions'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'

const OTHER = 'Example Ecclesia'
const HOME = 'Toronto East Ecclesia'

const req = (body: unknown) => ({ json: async () => body }) as any
const params = (name: string) => ({ params: Promise.resolve({ name: encodeURIComponent(name) }) })
const sentPks = () =>
  mockSend.mock.calls.map((c) => c[0].params?.Item?.PK ?? c[0].params?.Key?.PK).filter(Boolean)

beforeEach(() => {
  vi.clearAllMocks()
  mockSend.mockResolvedValue({})
  auth.mockResolvedValue({ user: { email: 'rb@example.org', role: 'member' } })
  canEdit.mockResolvedValue(true)
})

describe('another ecclesia never writes the legacy partition', () => {
  it('POST for a non-home ecclesia writes SCHEDULE#<id>#<kind> only', async () => {
    const res = await POST(req({ type: 'memorial', date: '2026-11-15', data: { Exhort: 'Ann Example' } }), params(OTHER))
    expect(res.status).toBe(201)
    expect(sentPks()).toEqual(['SCHEDULE#example-ecclesia#memorial'])
    expect(sentPks().some((pk) => /^SCHEDULE#[A-Z]+$/.test(pk))).toBe(false)
  })

  it('DELETE for a non-home ecclesia deletes from its own partition only', async () => {
    const res = await DELETE(req({ type: 'memorial', date: '2026-11-15' }), params(OTHER))
    expect(res.status).toBe(200)
    expect(sentPks()).toEqual(['SCHEDULE#example-ecclesia#memorial'])
    expect(mockSend.mock.calls[0][0].params.Key.SK).toBe(`DATE#${new Date('2026-11-15').toISOString()}#0`)
  })

  it('home ecclesia keeps writing and deleting its legacy partition', async () => {
    await POST(req({ type: 'bibleClass', date: '2026-11-18', data: {} }), params(HOME))
    await DELETE(req({ type: 'bibleClass', date: '2026-11-18' }), params(HOME))
    expect(sentPks()).toEqual(['SCHEDULE#BIBLECLASS', 'SCHEDULE#BIBLECLASS'])
  })

  it('no write at all without edit permission', async () => {
    canEdit.mockResolvedValue(false)
    expect((await POST(req({ type: 'memorial', date: '2026-11-15', data: {} }), params(OTHER))).status).toBe(403)
    expect((await DELETE(req({ type: 'memorial', date: '2026-11-15' }), params(OTHER))).status).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('canManageEcclesiaSchedules = canSendSpeakerInvite', () => {
  const X = 'Ecclesia X'
  const cases: Array<[any, string, string]> = [
    [{ ecclesia: 'Ecclesia Y' }, 'owner', X],
    [{ ecclesia: X, isRecordingBrother: true }, 'member', X],
    [{ ecclesia: X }, 'rep', X],
    [{ ecclesia: 'Ecclesia Y', isRecordingBrother: true }, 'member', X],
    [{ ecclesia: X }, 'admin', X],
    [{ ecclesia: X }, 'recorder', X],
    [{ ecclesia: X }, 'member', X],
    [null, 'rep', X],
  ]
  it('agrees with the speaker-invite rule in every case', () => {
    for (const [person, role, ecclesia] of cases) {
      expect(canManageEcclesiaSchedules(person, role, ecclesia)).toBe(canSendSpeakerInvite(person, role, ecclesia))
    }
    expect(canManageEcclesiaSchedules({ ecclesia: X }, 'rep', X)).toBe(true)
    expect(canManageEcclesiaSchedules({ ecclesia: X }, 'admin', X)).toBe(false)
  })
})
