/**
 * The access-pattern registry: request building, the paginating
 * `queryPattern` helper, the new sparse entries their writers add, and the
 * backfill plan for items written before them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

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
    BatchGetCommand: cmd('BatchGetCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import { ENTRIES, PATTERNS, patternEntry, patternQuery, type AccessPattern } from '@my/app/provider/dynamodb/access-patterns'
import { TokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { EditRequestRepository } from '@my/app/provider/dynamodb/repositories/edit-request-repository'
import { ContactRequestRepository } from '@my/app/provider/dynamodb/repositories/contact-request-repository'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'
import { YouTubeOAuthRepository } from '@my/app/provider/dynamodb/repositories/youtube-oauth-repository'
import { planBackfill, updateInput } from '../../../scripts/backfill-access-patterns'

const ROOT = join(__dirname, '..', '..', '..')
const ALL = Object.values(PATTERNS) as AccessPattern<any>[]

beforeEach(() => {
  mockSend.mockReset()
})

describe('registry shape', () => {
  it('names are unique and match their keys; every writer file exists', () => {
    for (const [key, p] of Object.entries(PATTERNS)) {
      expect(p.name).toBe(key)
      const file = p.writer.split(' ')[0]
      expect(existsSync(join(ROOT, file)), `${p.name} writer ${file}`).toBe(true)
    }
  })

  it('tee-admin patterns use the lowercase gsi1..gsi4 attributes of their index', () => {
    for (const p of ALL.filter((x) => x.table === 'tee-admin')) {
      if (!p.index) {
        expect([p.pkAttr, p.skAttr]).toEqual(['pkey', 'skey'])
        continue
      }
      expect(['gsi1', 'gsi2', 'gsi3', 'gsi4']).toContain(p.index)
      expect([p.pkAttr, p.skAttr]).toEqual([`${p.index}pk`, `${p.index}sk`])
    }
  })

  it('no two patterns on one index share a key prefix', () => {
    const seen = new Map<string, string>()
    for (const p of ALL) {
      const prefix = p.shape.replace(/^(GSI\d|StatusIndex|pkey)\s+/, '').split(/[<\s]/)[0]
      const slot = `${p.table}/${p.index ?? 'base'}/${prefix}`
      expect(seen.get(slot), `${p.name} collides with ${seen.get(slot)} on ${slot}`).toBeUndefined()
      seen.set(slot, p.name)
    }
  })
})

describe('patternQuery', () => {
  it('builds index + key condition for each sort-key form', () => {
    expect(patternQuery(PATTERNS.postsAll, undefined)).toEqual({
      TableName: 'tee-admin',
      IndexName: 'gsi4',
      KeyConditionExpression: 'gsi4pk = :apPk',
      ExpressionAttributeValues: { ':apPk': 'POSTS#ALL' },
    })
    expect(patternQuery(PATTERNS.postById, { postId: 'p1' }).KeyConditionExpression).toBe(
      'gsi1pk = :apPk AND gsi1sk = :apSk'
    )
    expect(patternQuery(PATTERNS.nameTypeahead, { token: 'jo' })).toMatchObject({
      KeyConditionExpression: 'gsi3pk = :apPk AND begins_with(gsi3sk, :apSk)',
      ExpressionAttributeValues: { ':apPk': 'NAMEPFX#ALL#jo', ':apSk': 'jo' },
    })
    expect(patternQuery(PATTERNS.webAnalytics, { from: 'a', to: 'b' })).toMatchObject({
      KeyConditionExpression: 'gsi1pk = :apPk AND gsi1sk BETWEEN :apSk AND :apSk2',
      ExpressionAttributeValues: { ':apPk': 'ANALYTICS#WEB', ':apSk': 'a', ':apSk2': 'b' },
    })
    expect(patternQuery(PATTERNS.exhorterPending, { fromDate: '2026-10-01' }).KeyConditionExpression).toBe(
      'gsi1pk = :apPk AND gsi1sk >= :apSk'
    )
  })

  it('base-table and tee-schedules patterns use their own key names', () => {
    expect(patternQuery(PATTERNS.officesOfEcclesia, { ecclesiaId: 'tee' })).toEqual({
      TableName: 'tee-admin',
      KeyConditionExpression: 'pkey = :apPk AND begins_with(skey, :apSk)',
      ExpressionAttributeValues: { ':apPk': 'ECCLESIA_ID#tee', ':apSk': 'OFFICE#' },
    })
    expect(patternQuery(PATTERNS.schedulesByType, { type: 'bibleClass' })).toEqual({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :apPk',
      ExpressionAttributeValues: { ':apPk': 'SCHEDULE#BIBLECLASS' },
    })
    expect(patternQuery(PATTERNS.newsAll, undefined)).toMatchObject({ IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :apPk' })
  })

  it('reuses the people-index key builders unchanged', () => {
    expect(PATTERNS.peopleCards.pk()).toBe('PEOPLE#ALL')
    expect(PATTERNS.peopleCardsByEcclesiaId.pk({ ecclesiaId: 'x' })).toBe('ECCPEOPLE#x')
    expect(PATTERNS.ecclesiaByRbEmail.pk({ email: ' RB@X.org ' })).toBe('RBEMAIL#rb@x.org')
  })

  it('patternEntry refuses a base-table pattern', () => {
    expect(() => patternEntry(PATTERNS.officesOfEcclesia, { ecclesiaId: 'x' }, 's')).toThrow(/base-table/)
  })
})

describe('BaseRepository.queryPattern', () => {
  it('follows LastEvaluatedKey to the end and merges caller filters', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ id: 1 }], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [{ id: 2 }] })
    const repo = new TokenRepository()
    const items = await repo.queryPattern(PATTERNS.otpByEmail, { email: 'A@x.org' }, {
      filterExpression: 'expiresAt > :now',
      expressionAttributeValues: { ':now': 'T' },
    })
    expect(items).toEqual([{ id: 1 }, { id: 2 }])
    expect(mockSend).toHaveBeenCalledTimes(2)
    const [first, second] = mockSend.mock.calls.map((c) => c[0].params)
    expect(first).toMatchObject({
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :apPk',
      FilterExpression: 'expiresAt > :now',
      ExpressionAttributeValues: { ':apPk': 'OTP#a@x.org', ':now': 'T' },
    })
    expect(first.ExclusiveStartKey).toBeUndefined()
    expect(second.ExclusiveStartKey).toEqual({ k: 1 })
  })

  it('stops early once `limit` items are collected', async () => {
    mockSend.mockResolvedValue({ Items: [{ id: 1 }, { id: 2 }], LastEvaluatedKey: { k: 1 } })
    const items = await new TokenRepository().queryPattern(PATTERNS.postsAll as any, undefined, { limit: 2 })
    expect(items).toHaveLength(2)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('refuses a pattern on another table', async () => {
    await expect(new TokenRepository().queryPattern(PATTERNS.newsAll as any, undefined)).rejects.toThrow(/tee-schedules/)
  })
})

describe('writers add the new sparse entries; readers Query them', () => {
  it('OTP: written with gsi1 OTP#<email>; the active-code lookup is a Query, newest live wins', async () => {
    mockSend.mockResolvedValueOnce({})
    const repo = new TokenRepository()
    await repo.create({ personId: 'p1', email: 'Ann@X.org', tokenType: 'otp', otpCode: '123456' })
    const item = mockSend.mock.calls[0][0].params.Item
    expect(item.gsi1pk).toBe('OTP#ann@x.org')
    expect(item.gsi1sk).toBe(item.createdAt)

    mockSend.mockReset()
    await repo.create({ personId: 'p1', email: 'ann@x.org', tokenType: 'password_reset' })
    expect(mockSend.mock.calls[0][0].params.Item.gsi1pk).toBeUndefined()

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [{ createdAt: '1', otpCode: 'a' }, { createdAt: '2', otpCode: 'b' }] })
    expect((await repo.findActiveOtpByEmail('ANN@x.org'))?.otpCode).toBe('b')
    const q = mockSend.mock.calls[0][0]
    expect(q.type).toBe('QueryCommand')
    expect(q.params.ExpressionAttributeValues[':apPk']).toBe('OTP#ann@x.org')
    expect(q.params.FilterExpression).toBe('attribute_not_exists(usedAt) AND expiresAt > :now')
  })

  it('edit request: token + requester entries; both lookups Query', async () => {
    mockSend.mockResolvedValueOnce({})
    const repo = new EditRequestRepository()
    const req = await repo.createRequest('Asker@x.org', 'Asker', 'target@x.org', 'phone' as any, '555')
    const item = mockSend.mock.calls[0][0].params.Item
    expect(item.gsi4pk).toBe(`EDITREQTOKEN#${req.approvalToken}`)
    expect(item.gsi1pk).toBe('EDITREQBY#asker@x.org')
    expect(item.gsi1sk).toBe(`${item.createdAt}#${item.requestId}`)

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [{ ...item, tokenExpiry: '2999-01-01' }] })
    expect((await repo.getRequestByToken(req.approvalToken!))?.requestId).toBe(item.requestId)
    expect(mockSend.mock.calls[0][0].type).toBe('QueryCommand')

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [item] })
    await repo.getSentRequests('asker@x.org')
    expect(mockSend.mock.calls[0][0].params).toMatchObject({ IndexName: 'gsi1', ScanIndexForward: false })
  })

  it('contact request: requester entry; sent requests Query it', async () => {
    mockSend.mockResolvedValueOnce({})
    const repo = new ContactRequestRepository()
    await repo.createRequest('Asker@x.org', 'target@x.org', 'phone' as any)
    expect(mockSend.mock.calls[0][0].params.Item.gsi1pk).toBe('CONTACTREQBY#asker@x.org')

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [] })
    await repo.getSentRequests('asker@x.org')
    expect(mockSend.mock.calls[0][0].type).toBe('QueryCommand')
  })

  it('meeting: gsi4 MEETINGS entry follows nextOccurrence; listAll Queries it', async () => {
    mockSend.mockResolvedValueOnce({})
    await meetingRepository.create({ title: 't', ownerType: 'ecclesia', ownerName: 'TEE', active: true, nextOccurrence: '2026-11-01' } as any)
    expect(mockSend.mock.calls[0][0].params.Item).toMatchObject({ gsi4pk: 'MEETINGS', gsi4sk: '2026-11-01' })

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Attributes: {} })
    await meetingRepository.updateMeeting('m1', { nextOccurrence: '2026-12-01' })
    expect(mockSend.mock.calls[0][0].params.ExpressionAttributeValues).toEqual(
      expect.objectContaining({ ':val1': '2026-12-01' })
    )
    expect(Object.values(mockSend.mock.calls[0][0].params.ExpressionAttributeNames)).toEqual(
      expect.arrayContaining(['gsi1sk', 'gsi4pk', 'gsi4sk'])
    )

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [] })
    await meetingRepository.listAll()
    expect(mockSend.mock.calls[0][0].params).toMatchObject({ IndexName: 'gsi4', ExpressionAttributeValues: { ':apPk': 'MEETINGS' } })
  })

  it('YouTube OAuth: gsi4 entry on store; listAllTokens Queries it', async () => {
    const repo = new YouTubeOAuthRepository()
    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({})
    await repo.storeTokens('a@x.org', { access_token: 'a', refresh_token: 'r', expires_in: 60, scope: 's', token_type: 'b' })
    const put = mockSend.mock.calls.find((c) => c[0].type === 'PutCommand')![0]
    expect(put.params.Item).toMatchObject({ gsi4pk: 'OAUTH#youtube', gsi4sk: 'USER#a@x.org' })

    mockSend.mockReset()
    mockSend.mockResolvedValueOnce({ Items: [{ pkey: 'USER#a@x.org', refreshToken: 'r' }, { pkey: 'USER#b@x.org' }] })
    expect(await repo.listAllTokens()).toEqual([{ userEmail: 'a@x.org', hasRefreshToken: true }])
    expect(mockSend.mock.calls[0][0].type).toBe('QueryCommand')
  })

  it('ENTRIES.post adds the series entry only for a post in a series', () => {
    expect(ENTRIES.post({ sortKey: 'd#p' })).toEqual({ gsi4pk: 'POSTS#ALL', gsi4sk: 'd#p' })
    expect(ENTRIES.post({ seriesId: 's1', sortKey: 'd#p' })).toEqual({
      gsi4pk: 'POSTS#ALL',
      gsi4sk: 'd#p',
      gsi3pk: 'POSTSERIES#s1',
      gsi3sk: 'd#p',
    })
  })
})

describe('backfill plan', () => {
  const post = { pkey: 'POST#TEE', skey: 'POST#p1', gsi2sk: 'd#p1', seriesId: 's1' }
  const meeting = { pkey: 'MEETING#m1', skey: 'DETAILS', nextOccurrence: '2026-11-01' }
  const edit = {
    pkey: 'USER#t@x.org', skey: 'EDIT_REQUEST#r1', requestId: 'r1', requesterEmail: 'A@x.org',
    approvalToken: 'tok', createdAt: 'c',
  }
  const oauth = { pkey: 'USER#a@x.org', skey: 'OAUTH#youtube' }
  const person = { pkey: 'PERSON#1', skey: 'PROFILE', gsi1pk: 'EMAIL#a@x.org' }

  it('plans only missing entries, per pattern, and never touches other items', () => {
    const plan = planBackfill([post, meeting, edit, oauth, person] as any)
    expect(plan.counts).toEqual({
      postsAll: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
      postsBySeries: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
      meetingsAll: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
      editRequestsByRequester: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
      editRequestByToken: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
      youtubeOAuthAll: { candidates: 1, alreadySet: 0, toWrite: 1, conflicts: 0 },
    })
    expect(plan.writes.every((w) => Object.keys(w.set).every((k) => /^gsi[1-4](pk|sk)$/.test(k)))).toBe(true)
    expect(plan.writes.some((w) => w.key.pkey === 'PERSON#1')).toBe(false)
  })

  it('is idempotent and skips an item holding a different value', () => {
    const done = { ...meeting, gsi4pk: 'MEETINGS', gsi4sk: '2026-11-01' }
    const taken = { ...edit, gsi1pk: 'SOMETHING#else', gsi1sk: 'x' }
    const plan = planBackfill([done, taken] as any)
    expect(plan.counts.meetingsAll).toEqual({ candidates: 1, alreadySet: 1, toWrite: 0, conflicts: 0 })
    expect(plan.counts.editRequestsByRequester).toEqual({ candidates: 1, alreadySet: 0, toWrite: 0, conflicts: 1 })
    expect(plan.writes.map((w) => w.pattern)).toEqual(['editRequestByToken'])
  })

  it('writes with SET on just the gsi attributes, guarded against overwriting', () => {
    const [write] = planBackfill([meeting] as any).writes
    expect(updateInput(write)).toEqual({
      TableName: 'tee-admin',
      Key: { pkey: 'MEETING#m1', skey: 'DETAILS' },
      UpdateExpression: 'SET #a0 = :v0, #a1 = :v1',
      ConditionExpression:
        'attribute_exists(pkey) AND (attribute_not_exists(#a0) OR #a0 = :v0) AND (attribute_not_exists(#a1) OR #a1 = :v1)',
      ExpressionAttributeNames: { '#a0': 'gsi4pk', '#a1': 'gsi4sk' },
      ExpressionAttributeValues: { ':v0': 'MEETINGS', ':v1': '2026-11-01' },
    })
  })
})
