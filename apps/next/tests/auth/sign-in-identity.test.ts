import { describe, it, expect, vi } from 'vitest'

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({ personRepository: {} }))

import {
  identityAtSignIn,
  mayActAs,
  mustChooseIdentity,
  peopleWhoCanUse,
  switchIdentity,
  toChoices,
  type SignInIdentityDeps,
} from '../../utils/sign-in-identity'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * R2: proving the email authorizes; when more than one person can use the
 * proven address, the session asks "Are you A or B?" and trusts the answer.
 */

const person = (personId: string, displayName: string, extra: Partial<PersonRecord> = {}) =>
  ({ personId, displayName, ecclesia: 'Alpha', ...extra }) as PersonRecord

const ALICE = person('alice', 'Alice Home')
const BOB = person('bob', 'Bob Home')
const GONE = person('gone', 'Late Member', { role: 'deceased' })
const OUTSIDER = person('outsider', 'Someone Else')

function deps(holders: Record<string, PersonRecord[]>, office: Record<string, PersonRecord[]> = {}): SignInIdentityDeps {
  return {
    holdersOf: vi.fn(async (a: string) => holders[a] ?? []),
    officeHoldersOf: vi.fn(async (a: string) => office[a] ?? []),
    // The household sign-in rule's default: the first holder.
    defaultHolder: vi.fn(async (a: string) => (holders[a] ?? [])[0] ?? null),
  }
}

const HOME = 'home@example.org'
const SHARED = deps({ [HOME]: [ALICE, BOB, GONE] })
const SINGLE = deps({ 'alice@example.org': [ALICE] })

describe('peopleWhoCanUse', () => {
  it('lists every living holder once, plus office holders (R3 extension point)', async () => {
    const d = deps({ [HOME]: [ALICE, BOB, GONE, ALICE] }, { [HOME]: [OUTSIDER, BOB] })
    expect((await peopleWhoCanUse('Home@Example.org', d)).map((p) => p.personId)).toEqual(['alice', 'bob', 'outsider'])
  })

  it('is empty for no address', async () => {
    expect(await peopleWhoCanUse('', SHARED)).toEqual([])
  })
})

describe('nameless records (leftover mailbox imports)', () => {
  const LEFTOVER = person('leftover', '')
  const MAILBOX = 'mailbox@example.org'

  it('step aside when a named person uses the address: no question, signed in as that person', async () => {
    const d = deps({ [MAILBOX]: [LEFTOVER, ALICE] }) // the household default picks the leftover
    expect((await peopleWhoCanUse(MAILBOX, d)).map((p) => p.personId)).toEqual(['alice'])
    expect(await identityAtSignIn({ signInEmail: MAILBOX, identified: false, assurance: 'authenticated' }, d)).toEqual({
      signInEmail: MAILBOX,
      personId: 'alice',
      chooseIdentity: false,
    })
    expect(await mayActAs('leftover', MAILBOX, d)).toBe(false)
  })

  it('still sign in when nobody named holds the address', async () => {
    const d = deps({ [MAILBOX]: [LEFTOVER] })
    expect((await identityAtSignIn({ signInEmail: MAILBOX, identified: false, assurance: 'authenticated' }, d)).personId).toBe('leftover')
  })
})

describe('mustChooseIdentity', () => {
  it('asks only when several people use the address and nothing named one', () => {
    expect(mustChooseIdentity({ people: [ALICE, BOB], identified: false, assurance: 'authenticated' })).toBe(true)
    expect(mustChooseIdentity({ people: [ALICE], identified: false, assurance: 'authenticated' })).toBe(false)
    expect(mustChooseIdentity({ people: [ALICE, BOB], identified: true, assurance: 'authenticated' })).toBe(false)
    // A forwardable email link proves nothing about the inbox.
    expect(mustChooseIdentity({ people: [ALICE, BOB], identified: false, assurance: 'recognized' })).toBe(false)
  })
})

describe('identityAtSignIn', () => {
  it('a code to a shared inbox: the default holder, and ask who', async () => {
    expect(await identityAtSignIn({ signInEmail: HOME, userId: 'alice', identified: false, assurance: 'authenticated' }, SHARED)).toEqual({
      signInEmail: HOME,
      personId: 'alice',
      chooseIdentity: true,
    })
  })

  it("one holder: no question", async () => {
    const id = await identityAtSignIn({ signInEmail: 'alice@example.org', identified: false, assurance: 'authenticated' }, SINGLE)
    expect(id).toEqual({ signInEmail: 'alice@example.org', personId: 'alice', chooseIdentity: false })
  })

  it("a household member's own password names them: no question", async () => {
    const id = await identityAtSignIn({ signInEmail: HOME, userId: 'bob', identified: true, assurance: 'authenticated' }, SHARED)
    expect(id).toEqual({ signInEmail: HOME, personId: 'bob', chooseIdentity: false })
  })

  it("a credential id that doesn't hold the address names nobody (e.g. a Google account id)", async () => {
    const id = await identityAtSignIn({ signInEmail: HOME, userId: 'google-123', identified: true, assurance: 'authenticated' }, SHARED)
    expect(id).toEqual({ signInEmail: HOME, personId: 'alice', chooseIdentity: true })
  })
})

describe('switchIdentity', () => {
  const session = { signInEmail: HOME, personId: 'alice', chooseIdentity: true }

  it('accepts a person who uses the proven address', async () => {
    expect(await switchIdentity(session, 'bob', SHARED)).toEqual({ signInEmail: HOME, personId: 'bob', chooseIdentity: false })
  })

  it('rejects anyone else, and a deceased holder, leaving the session unchanged', async () => {
    expect(await switchIdentity(session, 'outsider', SHARED)).toBe(session)
    expect(await switchIdentity(session, 'gone', SHARED)).toBe(session)
  })

  it('rejects a switch when the session proved no address', async () => {
    expect(await switchIdentity({ personId: 'alice' }, 'bob', SHARED)).toEqual({ personId: 'alice' })
    expect(await mayActAs('bob', undefined, SHARED)).toBe(false)
  })
})

describe('toChoices', () => {
  it('names and ecclesias, sorted by name', () => {
    expect(toChoices([BOB, ALICE])).toEqual([
      { personId: 'alice', name: 'Alice Home', ecclesia: 'Alpha' },
      { personId: 'bob', name: 'Bob Home', ecclesia: 'Alpha' },
    ])
  })
})
