import { describe, it, expect, vi } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: vi.fn() })) },
  QueryCommand: vi.fn(),
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  ScanCommand: vi.fn(),
  BatchWriteCommand: vi.fn(),
  TransactWriteCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import {
  parseLegacyRow,
  planRelationshipMigration,
  type AddressHolders,
} from '@my/app/provider/dynamodb/relationship-migration'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

const person = (personId: string, firstName = 'Named') => ({ personId, firstName }) as unknown as PersonRecord

/** address → holders, as the GSI1 lookup would return them. */
function lookupFrom(table: Record<string, PersonRecord[]>, excluded: Record<string, string[]> = {}) {
  return async (email: string): Promise<AddressHolders> => ({
    persons: table[email] ?? [],
    emailRows: (excluded[email] ?? []).map((id) => ({ pkey: `PERSON#${id}`, email, loginExcluded: true })),
  })
}

const legacy = (source: string, target: string, type: string, status = 'active') => ({
  pkey: `USER#${source}`,
  skey: `RELATIONSHIP#${target}#${type}`,
  sourceEmail: source,
  targetEmail: target,
  relationshipType: type,
  status,
  createdAt: '2025-01-01T00:00:00.000Z',
})

describe('parseLegacyRow', () => {
  it('reads source, target and type from the keys when fields are missing', () => {
    expect(
      parseLegacyRow({ pkey: 'USER#A@example.org', skey: 'RELATIONSHIP#b@example.org#child' })
    ).toEqual({ sourceEmail: 'a@example.org', targetEmail: 'b@example.org', type: 'child', status: 'active' })
  })
  it('rejects a row that is not a legacy relationship', () => {
    expect(parseLegacyRow({ pkey: 'PERSON#x', skey: 'REL#y#spouse' })).toBeNull()
    expect(parseLegacyRow({ pkey: 'USER#a', skey: 'RELATIONSHIP#b#cousin' })).toBeNull()
  })
})

describe('planRelationshipMigration', () => {
  it('turns both legacy directions into ONE pair of person-keyed rows', async () => {
    const plan = await planRelationshipMigration(
      [legacy('mum@example.org', 'kid@example.org', 'parent'), legacy('kid@example.org', 'mum@example.org', 'child')],
      lookupFrom({ 'mum@example.org': [person('p-mum')], 'kid@example.org': [person('p-kid')] }),
      'NOW'
    )
    expect(plan.unresolved).toEqual([])
    expect(plan.pairs).toHaveLength(1)
    const [pair] = plan.pairs
    expect(pair.legacyKeys).toHaveLength(2)
    const keys = pair.rows.map((r) => `${r.pkey} ${r.skey}`).sort()
    expect(keys).toEqual(['PERSON#p-kid REL#p-mum#child', 'PERSON#p-mum REL#p-kid#parent'])
    expect(pair.rows.every((r) => r.createdAt === '2025-01-01T00:00:00.000Z')).toBe(true)
  })

  it('resolves a secondary address to its person (any address the person holds)', async () => {
    const plan = await planRelationshipMigration(
      [legacy('old-alias@example.org', 'sib@example.org', 'sibling')],
      lookupFrom({ 'old-alias@example.org': [person('p-me')], 'sib@example.org': [person('p-sib')] })
    )
    expect(plan.pairs[0].rows.map((r) => r.pkey).sort()).toEqual(['PERSON#p-me', 'PERSON#p-sib'])
  })

  it('a @family.local placeholder resolves to the person who holds it', async () => {
    const plan = await planRelationshipMigration(
      [legacy('me@example.org', 'pending-1-abcde@family.local', 'child')],
      lookupFrom({ 'me@example.org': [person('p-me')], 'pending-1-abcde@family.local': [person('p-child')] })
    )
    expect(plan.unresolved).toEqual([])
    expect(plan.pairs[0].rows.map((r) => r.targetPersonId).sort()).toEqual(['p-child', 'p-me'])
  })

  it('an address nobody holds is listed, never written', async () => {
    const plan = await planRelationshipMigration(
      [legacy('me@example.org', 'gone@example.org', 'sibling'), legacy('ghost@example.org', 'me@example.org', 'sibling')],
      lookupFrom({ 'me@example.org': [person('p-me')] })
    )
    expect(plan.pairs).toEqual([])
    expect(plan.unresolved.map((u) => u.reason)).toEqual(['target-not-found', 'source-not-found'])
  })

  it('a shared household address never makes a spouse their own spouse', async () => {
    // Both spouses hold the shared inbox; one also has a placeholder primary.
    const plan = await planRelationshipMigration(
      [legacy('home@example.org', 'pending-2-xyz@family.local', 'spouse')],
      lookupFrom({
        'home@example.org': [person('p-wife'), person('p-husband')],
        'pending-2-xyz@family.local': [person('p-husband')],
      })
    )
    expect(plan.pairs).toHaveLength(1)
    expect(plan.pairs[0].rows.map((r) => `${r.sourcePersonId}>${r.targetPersonId}`).sort()).toEqual([
      'p-husband>p-wife',
      'p-wife>p-husband',
    ])
    expect(plan.pairs[0].resolvedBySignInRule).toBe(false)
  })

  it('still-ambiguous holders resolve by the sign-in rule, and are flagged for review', async () => {
    const plan = await planRelationshipMigration(
      [legacy('home@example.org', 'kid@example.org', 'parent')],
      lookupFrom(
        { 'home@example.org': [person('p-b'), person('p-a')], 'kid@example.org': [person('p-kid')] },
        { 'home@example.org': ['p-a'] } // p-a's row is loginExcluded → p-b signs in there
      )
    )
    expect(plan.pairs[0].resolvedBySignInRule).toBe(true)
    expect(plan.pairs[0].rows.map((r) => r.pkey).sort()).toEqual(['PERSON#p-b', 'PERSON#p-kid'])
  })

  it('active wins when the two legacy directions disagree on status', async () => {
    const plan = await planRelationshipMigration(
      [legacy('a@example.org', 'b@example.org', 'sibling', 'removed'), legacy('b@example.org', 'a@example.org', 'sibling')],
      lookupFrom({ 'a@example.org': [person('p-a')], 'b@example.org': [person('p-b')] })
    )
    expect(plan.pairs[0].status).toBe('active')
    expect(plan.pairs[0].rows.every((r) => r.status === 'active')).toBe(true)
  })

  it('a row whose two addresses are the same person is not written', async () => {
    const plan = await planRelationshipMigration(
      [legacy('one@example.org', 'two@example.org', 'sibling')],
      lookupFrom({ 'one@example.org': [person('p-x')], 'two@example.org': [person('p-x')] })
    )
    expect(plan.pairs).toEqual([])
    expect(plan.unresolved[0].reason).toBe('same-person')
  })
})
