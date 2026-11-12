import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * The DynamoDB requests the speaker repository sends: the booking lock is a
 * conditional put, the overlay joins the same TransactWrite under an
 * optimistic version lock, and a cancelled transaction surfaces as a typed
 * conflict. No AWS calls — the document client is mocked.
 */

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

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
    TransactWriteCommand: cmd('TransactWriteCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import {
  SpeakerInviteRepository,
  SpeakerWriteConflict,
} from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import { ServiceOverrideRepository } from '@my/app/provider/dynamodb/repositories/service-override-repository'
import { PATTERNS } from '@my/app/provider/dynamodb/access-patterns'

const repo = new SpeakerInviteRepository()
const overrides = new ServiceOverrideRepository()

const booking = {
  pkey: 'SPEAKER_BOOKING#E#memorial',
  skey: '2026-11-15',
  ecclesia: 'E',
  type: 'memorial' as const,
  date: '2026-11-15',
  personId: 'p-a',
  inviteId: 'inv-1',
  createdAt: 'x',
  updatedAt: 'x',
}

beforeEach(() => mockSend.mockReset())

describe('speaker invite repository', () => {
  it('lists invites by ecclesia through the registered gsi1 pattern', async () => {
    expect(SpeakerInviteRepository.listingEntry({ ecclesia: 'E', createdAt: '2026-11-12T00:00:00Z', inviteId: 'i' })).toEqual({
      gsi1pk: 'SPEAKER_INVITES#E',
      gsi1sk: '2026-11-12T00:00:00Z#i',
    })
    mockSend.mockResolvedValue({ Items: [] })
    await repo.listInvitesByEcclesia('E')
    const q = mockSend.mock.calls[0][0].params
    expect(q.IndexName).toBe(PATTERNS.speakerInvitesByEcclesia.index)
    expect(q.ExpressionAttributeValues[':apPk']).toBe('SPEAKER_INVITES#E')
  })

  it('takes a booking with attribute_not_exists and writes the overlay in the same transaction', async () => {
    mockSend.mockResolvedValue({})
    const overlay = overrides.buildRoleFieldPut(
      { pkey: 'SERVICE_OVERRIDE#E', skey: 'memorial#2026-11-15', ecclesia: 'E', serviceType: 'memorial', date: '2026-11-15',
        note: 'keep me', roleFields: { Preside: 'Pat Presider' }, version: 3, createdBy: 'a', createdAt: 'c', updatedAt: 'u', lastUpdated: 'u' },
      { ecclesia: 'E', serviceType: 'memorial', date: '2026-11-15', field: 'Exhort', value: 'Alex Speaker', personId: 'p-a', by: 'p-a' }
    )
    await repo.commit([
      { kind: 'putBooking', booking, expect: 'absent' },
      { kind: 'override', put: overlay },
    ])
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.type).toBe('TransactWriteCommand')
    const [b, o] = cmd.params.TransactItems
    expect(b.Put.ConditionExpression).toBe('attribute_not_exists(pkey)')
    expect(o.Put.ConditionExpression).toBe('version = :overrideReadVersion')
    expect(o.Put.ExpressionAttributeValues).toEqual({ ':overrideReadVersion': 3 })
    // Other overlay fields survive; only Exhort is added.
    expect(o.Put.Item).toMatchObject({
      note: 'keep me',
      roleFields: { Preside: 'Pat Presider', Exhort: 'Alex Speaker' },
      roleFieldRefs: { Exhort: 'p-a' },
      version: 4,
    })
  })

  it('a new overlay record is conditioned on not existing; clearing removes just the field', () => {
    const created = overrides.buildRoleFieldPut(null, {
      ecclesia: 'E', serviceType: 'bibleClass', date: '2026-11-18', field: 'Speaker', value: 'Alex Speaker', personId: 'p-a', by: 'p-a',
    })
    expect(created.Put.ConditionExpression).toBe('attribute_not_exists(pkey)')
    expect(created.Put.Item).toMatchObject({ pkey: 'SERVICE_OVERRIDE#E', skey: 'bibleClass#2026-11-18', version: 1 })

    const cleared = overrides.buildRoleFieldPut(created.Put.Item, {
      ecclesia: 'E', serviceType: 'bibleClass', date: '2026-11-18', field: 'Speaker', value: null, by: 'p-a',
    })
    expect(cleared.Put.Item.roleFields).toBeUndefined()
    expect(cleared.Put.Item.roleFieldRefs).toBeUndefined()
    expect(cleared.Put.ConditionExpression).toBe('version = :overrideReadVersion')
  })

  it('a held booking is conditioned on person, invite and swap lock', () => {
    const [del] = repo.buildTransactItems([
      { kind: 'deleteBooking', ecclesia: 'E', type: 'memorial', date: '2026-11-15', expect: { personId: 'p-a', inviteId: 'inv-1', openSwapId: null } },
    ])
    expect(del.Delete.Key).toEqual({ pkey: 'SPEAKER_BOOKING#E#memorial', skey: '2026-11-15' })
    expect(del.Delete.ConditionExpression).toBe('personId = :bkPerson AND inviteId = :bkInvite AND attribute_not_exists(openSwapId)')
  })

  it('a cancelled transaction becomes a SpeakerWriteConflict', async () => {
    const err = new Error('cancelled') as Error & { CancellationReasons?: unknown }
    err.name = 'TransactionCanceledException'
    err.CancellationReasons = [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }]
    mockSend.mockRejectedValueOnce(err)
    let caught: unknown
    try {
      await repo.commit([
        { kind: 'putBooking', booking, expect: 'absent' },
        { kind: 'putInvite', invite: { inviteId: 'inv-1' } as any, expect: { version: 1 } },
      ])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SpeakerWriteConflict)
    expect((caught as SpeakerWriteConflict).reasons).toEqual(['putBooking:ConditionalCheckFailed', 'putInvite:None'])
  })
})
