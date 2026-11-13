import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * §9a / §9b API: email lookup, follow-up resolve, the invite candidate search,
 * confirm-brother, and household identity on the invite pages (a shared
 * address is trusted). AWS is never touched; placeholder people only.
 */

const h = vi.hoisted(() => ({
  getTrust: vi.fn(),
  requireAssurance: vi.fn(),
  personForSessionEmail: vi.fn(),
  verifyEcclesiaToken: vi.fn(),
  people: new Map<string, any>(),
  emailRows: [] as Array<{ email: string; personId: string; primary: boolean }>,
  getInvite: vi.fn(),
  resolveFollowUp: vi.fn(),
  searchPeopleByNamePrefix: vi.fn(),
  confirmBaptizedBrother: vi.fn(),
}))

vi.mock('@/utils/auth-trust', async () => {
  const actual: any = await vi.importActual('@/utils/auth-trust')
  return { ...actual, getTrust: h.getTrust, requireAssurance: h.requireAssurance }
})
vi.mock('@/utils/auth', () => ({ auth: vi.fn() }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.personForSessionEmail }))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: h.verifyEcclesiaToken }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => {
  const holders = (email: string) =>
    [...new Set(h.emailRows.filter((r) => r.email === email).map((r) => r.personId))].map((id) => h.people.get(id))
  return {
    personRepository: {
      getById: async (id: string) => h.people.get(id) ?? null,
      // The household default: the PRIMARY holder not marked loginExcluded.
      getByEmail: async (email: string) =>
        h.people.get(h.emailRows.find((r) => r.email === email && r.primary)?.personId ?? '') ?? null,
      getAllPersonsByEmail: async (email: string) => holders(email),
      confirmBaptizedBrother: h.confirmBaptizedBrother,
    },
  }
})
vi.mock('@my/app/provider/dynamodb/people-index', () => ({
  peopleIndexReady: async () => true,
  searchPeopleByNamePrefix: h.searchPeopleByNamePrefix,
}))
vi.mock('@/utils/speaker-invites/service', async () => {
  const actual: any = await vi.importActual('@/utils/speaker-invites/service')
  return { ...actual, getInvite: h.getInvite, resolveFollowUp: h.resolveFollowUp }
})
vi.mock('@/utils/speaker-invites/views', () => ({ inviterInviteView: async (i: any) => i }))

import { GET as lookupGet } from '@/app/api/speaker-invites/lookup-email/route'
import { POST as resolvePost } from '@/app/api/speaker-invites/[inviteId]/follow-up/resolve/route'
import { GET as candidatesGet } from '@/app/api/speaker-invites/candidates/route'
import { POST as confirmPost } from '@/app/api/speaker-invites/confirm-brother/route'
import { resolveInviteActor, refuseActor } from '@/utils/speaker-invites/actor'
import { peopleWhoCanUse } from '@/utils/sign-in-identity'

const X = 'Ecclesia X'
const Y = 'Ecclesia Y'
const accounts: Record<string, any> = {
  'rb-x@example.test': { personId: 'p-rbx', ecclesia: X, isRecordingBrother: true, role: 'member', firstName: 'Rob', lastName: 'Recorder', displayName: 'Rob Recorder' },
  'rb-y@example.test': { personId: 'p-rby', ecclesia: Y, isRecordingBrother: true, role: 'member', firstName: 'Ray', lastName: 'Recorder', displayName: 'Ray Recorder' },
  'admin-x@example.test': { personId: 'p-ax', ecclesia: X, role: 'admin', firstName: 'Ada', lastName: 'Admin', displayName: 'Ada Admin' },
  'owner@example.test': { personId: 'p-owner', ecclesia: Y, role: 'owner', firstName: 'Oz', lastName: 'Owner', displayName: 'Oz Owner' },
}

function signIn(email: string) {
  const role = accounts[email].role
  h.requireAssurance.mockResolvedValue({
    ok: true,
    ctx: { trust: 'authenticated', email, authTime: Date.now(), session: { user: { email, role } } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.people.clear()
  h.emailRows = []
  for (const p of Object.values(accounts)) h.people.set(p.personId, p)
  h.personForSessionEmail.mockImplementation(async (email: string) => {
    if (accounts[email]) return accounts[email]
    const row = h.emailRows.find((r) => r.email === email && r.primary)
    return row ? h.people.get(row.personId) : null
  })
  // A household: Casey signs in with the address; Jordan joined it (login-excluded).
  h.people.set('p-casey', { personId: 'p-casey', firstName: 'Casey', lastName: 'Home', displayName: 'Casey Home', ecclesia: Y, role: 'member', primaryEmail: 'home@example.test' })
  h.people.set('p-jordan', { personId: 'p-jordan', firstName: 'Jordan', lastName: 'Home', displayName: 'Jordan Home', ecclesia: Y, role: 'member', primaryEmail: 'home@example.test' })
  h.emailRows.push({ email: 'home@example.test', personId: 'p-casey', primary: true })
  h.emailRows.push({ email: 'home@example.test', personId: 'p-jordan', primary: false })
})

describe('GET /api/speaker-invites/lookup-email', () => {
  const get = (email: string) => lookupGet(new Request(`http://x/api/speaker-invites/lookup-email?email=${encodeURIComponent(email)}`))

  it('an inviter gets the name floor only (no contact details) or null', async () => {
    signIn('rb-x@example.test')
    const res = await get('HOME@example.test')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ match: { personId: 'p-casey', displayName: 'Casey Home', ecclesia: Y, invitable: true } })
    expect(await (await get('nobody@example.test')).json()).toEqual({ match: null })
  })

  it('reports a sister as not invitable', async () => {
    signIn('owner@example.test')
    h.people.get('p-casey').gender = 'female'
    expect((await (await get('home@example.test')).json()).match.invitable).toBe(false)
  })

  it('a malformed address is 400; a non-inviter is 403', async () => {
    signIn('rb-x@example.test')
    expect((await get('not-an-email')).status).toBe(400)
    signIn('admin-x@example.test')
    expect((await get('home@example.test')).status).toBe(403)
  })
})

describe('POST /api/speaker-invites/{id}/follow-up/resolve', () => {
  const post = () =>
    resolvePost(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ inviteId: 'inv-1' }) })

  it('the inviter of that ecclesia, or the owner; never an RB of another ecclesia or an admin', async () => {
    h.getInvite.mockResolvedValue({ inviteId: 'inv-1', ecclesia: X })
    h.resolveFollowUp.mockResolvedValue({ ok: true, invite: { inviteId: 'inv-1' } })
    for (const email of ['rb-y@example.test', 'admin-x@example.test']) {
      signIn(email)
      expect((await post()).status).toBe(403)
    }
    expect(h.resolveFollowUp).not.toHaveBeenCalled()
    signIn('rb-x@example.test')
    expect((await post()).status).toBe(200)
    expect(h.resolveFollowUp).toHaveBeenCalledWith('inv-1', { personId: 'p-rbx', trust: 'authenticated' })
    signIn('owner@example.test')
    expect((await post()).status).toBe(200)
  })

  it('an unknown invite is 404', async () => {
    signIn('rb-x@example.test')
    h.getInvite.mockResolvedValue(null)
    expect((await post()).status).toBe(404)
  })
})

describe('GET /api/speaker-invites/candidates (§9b grouping)', () => {
  const get = (q: string) => candidatesGet(new Request(`http://x/api/speaker-invites/candidates?q=${encodeURIComponent(q)}`))

  it('brethren first, then unconfirmed; sisters, unbaptized and deceased never shown; no contact details', async () => {
    signIn('rb-x@example.test')
    const add = (id: string, extra: Record<string, any>) =>
      h.people.set(id, { personId: id, firstName: id, lastName: 'Sample', primaryEmail: `${id}@example.test`, ...extra })
    add('p-unset', {})
    add('p-bro', { gender: 'male', baptized: true })
    add('p-sis', { gender: 'female', baptized: true })
    add('p-no', { gender: 'male', baptized: false })
    add('p-dead', { role: 'deceased', gender: 'male', baptized: true })
    add('p-guest', { role: 'guest' })
    h.searchPeopleByNamePrefix.mockResolvedValue(
      ['p-unset', 'p-bro', 'p-sis', 'p-no', 'p-dead', 'p-guest'].map((id) => ({ personId: id, displayName: `${id} Sample`, ecclesia: Y, role: h.people.get(id).role }))
    )
    const body = await (await get('sample')).json()
    expect(body.candidates.map((c: any) => c.personId)).toEqual(['p-bro', 'p-unset', 'p-guest'])
    expect(body.candidates[0]).toEqual({ personId: 'p-bro', displayName: 'p-bro Sample', ecclesia: Y, gender: 'male', baptized: true })
    expect(JSON.stringify(body)).not.toContain('@example.test')
  })

  it('is inviter-gated', async () => {
    signIn('admin-x@example.test')
    expect((await get('sample')).status).toBe(403)
    expect(h.searchPeopleByNamePrefix).not.toHaveBeenCalled()
  })
})

describe('POST /api/speaker-invites/confirm-brother', () => {
  const post = (body: any) => confirmPost(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))

  it('inviters only; records the inviter as the one who set it', async () => {
    signIn('admin-x@example.test')
    expect((await post({ personId: 'p-casey' })).status).toBe(403)
    signIn('rb-x@example.test')
    h.confirmBaptizedBrother.mockResolvedValue({ ok: true, person: { ...h.people.get('p-casey'), gender: 'male', baptized: true } })
    const res = await post({ personId: 'p-casey' })
    expect(res.status).toBe(200)
    expect(h.confirmBaptizedBrother).toHaveBeenCalledWith('p-casey', 'p-rbx')
    expect(await res.json()).toEqual({ person: { personId: 'p-casey', displayName: 'Casey Home', ecclesia: Y, gender: 'male', baptized: true } })
  })

  it('409 when recorded to the contrary; 404 unknown; 400 without a personId', async () => {
    signIn('owner@example.test')
    h.confirmBaptizedBrother.mockResolvedValue({ ok: false, reason: 'conflict' })
    expect((await post({ personId: 'p-casey' })).status).toBe(409)
    h.confirmBaptizedBrother.mockResolvedValue({ ok: false, reason: 'not_found' })
    expect((await post({ personId: 'p-x' })).status).toBe(404)
    expect((await post({})).status).toBe(400)
  })
})

describe('household identity on the invite pages (§9a: a shared address is trusted)', () => {
  const invitee = { personId: 'p-jordan', email: 'home@example.test' }

  it('both people can use the address; the existing holder still signs in by default', async () => {
    const who = (await peopleWhoCanUse('home@example.test')).map((p) => p.personId).sort()
    expect(who).toEqual(['p-casey', 'p-jordan'])
    expect(await h.personForSessionEmail('home@example.test')).toMatchObject({ personId: 'p-casey' })
  })

  it('a token for the shared address resolves to the household default, who may act as the invitee', async () => {
    h.getTrust.mockResolvedValue({ trust: 'recognized', email: 'home@example.test', session: null })
    const actor = await resolveInviteActor(invitee, { ecclesiaToken: 'tok' })
    // History records who is acting (Casey), the page acts for Jordan's invite.
    expect(actor).toEqual({ trust: 'recognized', personId: 'p-casey', isInvitee: true, mismatch: false })
    expect(refuseActor(actor, 'recognized')).toBeNull()
  })

  it('a household member signed in with ANOTHER address they hold still counts', async () => {
    h.people.set('p-casey', { ...h.people.get('p-casey') })
    h.emailRows.push({ email: 'casey-work@example.test', personId: 'p-casey', primary: true })
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'casey-work@example.test', session: { user: {} } })
    const actor = await resolveInviteActor(invitee, {})
    expect(actor).toMatchObject({ personId: 'p-casey', isInvitee: true })
  })

  it('someone who cannot use the address is still not the invitee', async () => {
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'rb-x@example.test', session: { user: {} } })
    const actor = await resolveInviteActor(invitee, {})
    expect(actor).toMatchObject({ isInvitee: false, mismatch: false })
  })
})
