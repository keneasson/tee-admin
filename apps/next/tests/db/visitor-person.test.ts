import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * createVisitorPerson (the ONE visitor creator, §9a) and the recorded-facts
 * writes (§9b). DynamoDB is mocked; placeholder people only.
 */
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
}))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { VISITOR_PRIVACY_SETTINGS, createVisitorPerson } from '@my/app/provider/dynamodb/repositories/visitor-person'

const sent = (type: string) => mockSend.mock.calls.map((c) => c[0]).filter((c) => c?.type === type).map((c) => c.params)

function fakeDeps() {
  const calls: string[] = []
  const repository = {
    create: vi.fn(async (input: any) => {
      calls.push('create')
      return { personId: 'p-new', ...input } as any
    }),
    addPhone: vi.fn(async () => {
      calls.push('addPhone')
      return {} as any
    }),
    addEmail: vi.fn(async () => {
      calls.push('addEmail')
      return {} as any
    }),
  }
  const privacy = {
    createPrivacySettings: vi.fn(async () => {
      calls.push('privacy')
    }),
  }
  return { repository, privacy, calls }
}

describe('createVisitorPerson', () => {
  it('schedule import: exactly the create() call the ingest always made, then phone, then privacy', async () => {
    const d = fakeDeps()
    await createVisitorPerson(
      { firstName: 'Sam', lastName: 'Sample', ecclesia: 'Example', email: 'sam@example.test', phone: '555-0100', source: 'schedule-import', sourceRef: 'visiting-speakers:sheet-1' },
      d
    )
    expect(d.repository.create.mock.calls[0][0]).toStrictEqual({
      firstName: 'Sam',
      lastName: 'Sample',
      ecclesia: 'Example',
      memberStatus: 'visitor',
      role: 'guest',
      source: 'schedule-import',
      sourceRef: 'visiting-speakers:sheet-1',
      email: 'sam@example.test',
    })
    expect(d.repository.addPhone).toHaveBeenCalledWith('p-new', { type: 'mobile', number: '555-0100', isPrimary: true })
    expect(d.privacy.createPrivacySettings).toHaveBeenCalledWith('sam@example.test', { ...VISITOR_PRIVACY_SETTINGS })
    expect(d.calls).toEqual(['create', 'addPhone', 'privacy'])
  })

  it('emailless import: no email key, no privacy', async () => {
    const d = fakeDeps()
    await createVisitorPerson({ firstName: 'Sam', lastName: 'Sample', ecclesia: 'Example', source: 'schedule-import', sourceRef: 'r' }, d)
    expect(d.repository.create.mock.calls[0][0]).not.toHaveProperty('email')
    expect(d.calls).toEqual(['create'])
  })

  it('invitation: provenance, explicit role and vouched facts', async () => {
    const d = fakeDeps()
    await createVisitorPerson(
      { firstName: 'Sam', lastName: 'Sample', ecclesia: 'Example', email: 'sam@example.test', source: 'speaker-invitation', sourceRef: 'speaker-invite:inv-1', createdByPersonId: 'p-rb', role: 'member', gender: 'male', baptized: true, baptismDate: '2001-06-03' },
      d
    )
    expect(d.repository.create.mock.calls[0][0]).toMatchObject({
      role: 'member', memberStatus: 'visitor', source: 'speaker-invitation', sourceRef: 'speaker-invite:inv-1', createdByPersonId: 'p-rb',
      gender: 'male', genderSetByPersonId: 'p-rb', baptized: true, baptismDate: '2001-06-03', baptizedSetByPersonId: 'p-rb',
    })
  })

  it('shared household address (primary): login-excluded, and no privacy write over the holder’s settings', async () => {
    const d = fakeDeps()
    await createVisitorPerson(
      { firstName: 'Jo', lastName: 'Sample', ecclesia: 'Example', sharedEmail: { address: 'Home@Example.test', asPrimary: true }, source: 'speaker-invitation', sourceRef: 'r' },
      d
    )
    expect(d.repository.create.mock.calls[0][0]).toMatchObject({ email: 'home@example.test', emailLoginExcluded: true })
    expect(d.privacy.createPrivacySettings).not.toHaveBeenCalled()
  })

  it('shared household address (holder has it as a secondary): a login-excluded secondary row, no primary', async () => {
    const d = fakeDeps()
    await createVisitorPerson(
      { firstName: 'Jo', lastName: 'Sample', ecclesia: 'Example', sharedEmail: { address: 'home@example.test', asPrimary: false }, source: 'speaker-invitation', sourceRef: 'r' },
      d
    )
    expect(d.repository.create.mock.calls[0][0]).not.toHaveProperty('email')
    expect(d.repository.addEmail).toHaveBeenCalledWith('p-new', expect.objectContaining({ email: 'home@example.test', emailType: 'secondary', loginExcluded: true }))
    expect(d.privacy.createPrivacySettings).not.toHaveBeenCalled()
  })
})

describe('PersonRepository — §9a/§9b writes', () => {
  let repo: PersonRepository
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({})
    repo = new PersonRepository()
  })

  it('create(): emailLoginExcluded marks the EMAIL# row; provenance and facts land on the PROFILE', async () => {
    await repo.create({
      firstName: 'Jo', lastName: 'Sample', ecclesia: 'Example', email: 'home@example.test', emailLoginExcluded: true,
      memberStatus: 'visitor', role: 'member', source: 'speaker-invitation', sourceRef: 'speaker-invite:inv-1',
      createdByPersonId: 'p-rb', gender: 'male', genderSetByPersonId: 'p-rb', baptized: true, baptizedSetByPersonId: 'p-rb',
    })
    const items = sent('PutCommand').map((p) => p.Item)
    const profile = items.find((i) => i.skey === 'PROFILE')
    const email = items.find((i) => i.skey.startsWith('EMAIL#'))
    expect(profile).toMatchObject({ gsi1pk: 'EMAIL#home@example.test', createdByPersonId: 'p-rb', gender: 'male', genderSetByPersonId: 'p-rb', baptized: true })
    expect(profile.genderSetAt).toEqual(expect.any(String))
    expect(email).toMatchObject({ email: 'home@example.test', loginExcluded: true })
  })

  it('create() without the new inputs writes none of the new fields', async () => {
    await repo.create({ firstName: 'Sam', lastName: 'Sample', ecclesia: 'Example', email: 'sam@example.test' })
    const items = sent('PutCommand').map((p) => p.Item)
    const profile = items.find((i) => i.skey === 'PROFILE')
    for (const k of ['gender', 'baptized', 'createdByPersonId', 'genderSetAt', 'baptizedSetAt']) expect(profile).not.toHaveProperty(k)
    expect(items.find((i) => i.skey.startsWith('EMAIL#'))).not.toHaveProperty('loginExcluded')
  })

  it('confirmBaptizedBrother sets only the unset fact, conditioned on it still being unset', async () => {
    mockSend.mockImplementation(async (cmd: any) =>
      cmd.type === 'GetCommand' ? { Item: { pkey: 'PERSON#p-1', skey: 'PROFILE', personId: 'p-1', gender: 'male' } } : {}
    )
    const r = await repo.confirmBaptizedBrother('p-1', 'p-rb')
    expect(r).toMatchObject({ ok: true, person: { gender: 'male', baptized: true, baptizedSetByPersonId: 'p-rb' } })
    const [u] = sent('UpdateCommand')
    expect(u.UpdateExpression).toBe('SET #b = :yes, baptizedSetByPersonId = :by, baptizedSetAt = :now')
    expect(u.ConditionExpression).toContain('attribute_not_exists(#b)')
    expect(u.UpdateExpression).not.toContain('#g')
  })

  it('confirmBaptizedBrother never overwrites: a sister / unbaptized record is a conflict with no write', async () => {
    mockSend.mockImplementation(async (cmd: any) =>
      cmd.type === 'GetCommand' ? { Item: { pkey: 'PERSON#p-1', skey: 'PROFILE', personId: 'p-1', baptized: false } } : {}
    )
    expect(await repo.confirmBaptizedBrother('p-1', 'p-rb')).toEqual({ ok: false, reason: 'conflict' })
    expect(sent('UpdateCommand')).toHaveLength(0)
  })

  it('confirmBaptizedBrother: a concurrent edit (condition fails) is a conflict', async () => {
    mockSend.mockImplementation(async (cmd: any) => {
      if (cmd.type === 'GetCommand') return { Item: { pkey: 'PERSON#p-1', skey: 'PROFILE', personId: 'p-1' } }
      throw Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' })
    })
    expect(await repo.confirmBaptizedBrother('p-1', 'p-rb')).toEqual({ ok: false, reason: 'conflict' })
  })

  it('setSpeakerFacts sets, clears ("Not set") and records who', async () => {
    await repo.setSpeakerFacts('p-1', { gender: null, baptized: true, baptismDate: '2001-06-03' }, 'p-admin')
    const [u] = sent('UpdateCommand')
    expect(u.UpdateExpression).toContain('REMOVE #gender')
    expect(u.UpdateExpression).toContain('#baptized = :baptized')
    expect(u.UpdateExpression).toContain('genderSetByPersonId = :by')
    expect(u.UpdateExpression).toContain('baptizedSetByPersonId = :by')
    expect(u.ExpressionAttributeValues).toMatchObject({ ':baptized': true, ':baptismDate': '2001-06-03', ':by': 'p-admin' })
  })
})
