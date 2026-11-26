import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planDraftUpdate } from '@my/app/utils/email-draft-update'

/**
 * Custom-email drafts:
 * - A SENT email is a permanent, fully frozen record of what went out. Any
 *   update to it (subject, body, list or note) is refused with 409, and it
 *   can't be marked tested/sent again. The way to reuse it is Copy.
 * - Editing the content of a TESTED draft puts it back to `draft` and clears
 *   `lastTestedAt`, so the new content must be tested again.
 * - Copy makes a NEW, untested draft that points back at its source.
 */

const stored = {
  subject: 'Annual meeting',
  htmlContent: '<p>Ballot: https://example.com/old</p>',
  selectedList: 'list-1',
}

describe('planDraftUpdate', () => {
  it('locks a SENT email against content edits', () => {
    const plan = planDraftUpdate({ ...stored, status: 'sent' }, { ...stored, subject: 'New' })
    expect(plan.locked).toBe(true)
    expect(plan.resetToDraft).toBe(false)
  })

  it('locks a SENT email against a note-only edit too', () => {
    expect(planDraftUpdate({ ...stored, status: 'sent' }, { ...stored, note: 'n' }).locked).toBe(true)
  })

  it('resets a TESTED draft when the subject changes', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'tested', lastTestedAt: '2026-11-01T00:00:00.000Z' },
      { ...stored, subject: 'Annual meeting (new year)' }
    )
    expect(plan.locked).toBe(false)
    expect(plan.resetToDraft).toBe(true)
    expect(plan.changedContentFields).toEqual(['subject'])
  })

  it('resets a TESTED draft when the body or list changes', () => {
    const tested = { ...stored, status: 'tested' as const }
    expect(planDraftUpdate(tested, { ...stored, htmlContent: '<p>new</p>' }).resetToDraft).toBe(true)
    expect(planDraftUpdate(tested, { ...stored, selectedList: 'list-2' }).resetToDraft).toBe(true)
  })

  it('does NOT reset a tested draft on a note-only edit', () => {
    const plan = planDraftUpdate({ ...stored, status: 'tested' }, { ...stored, note: 'a new note' })
    expect(plan.resetToDraft).toBe(false)
    expect(plan.changedContentFields).toEqual([])
  })

  it('a plain draft has nothing to reset', () => {
    const plan = planDraftUpdate({ ...stored, status: 'draft' }, { ...stored, subject: 'new' })
    expect(plan.locked).toBe(false)
    expect(plan.resetToDraft).toBe(false)
  })

  it('a draft-status record that still carries lastTestedAt is cleared on a content edit', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'draft', lastTestedAt: '2026-11-01T00:00:00.000Z' },
      { ...stored, subject: 'new' }
    )
    expect(plan.resetToDraft).toBe(true)
  })
})

// ── Routes (DynamoDB mocked) ────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  send: vi.fn(),
  getById: vi.fn(),
  getByEmailForAuth: vi.fn(),
  getEmails: vi.fn(),
  getAllPersonsByEmail: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getById: h.getById,
    getByEmailForAuth: h.getByEmailForAuth,
    getEmails: h.getEmails,
    getAllPersonsByEmail: h.getAllPersonsByEmail,
  },
}))
vi.mock('@aws-sdk/lib-dynamodb', () => {
  class GetCommand {
    kind = 'get'
    constructor(public input: any) {}
  }
  class UpdateCommand {
    kind = 'update'
    constructor(public input: any) {}
  }
  class PutCommand {
    kind = 'put'
    constructor(public input: any) {}
  }
  class DeleteCommand {
    kind = 'delete'
    constructor(public input: any) {}
  }
  class QueryCommand {
    kind = 'query'
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: h.send }) },
    GetCommand,
    UpdateCommand,
    PutCommand,
    DeleteCommand,
    QueryCommand,
  }
})

import { PUT } from '../app/api/email-drafts/[id]/route'
import { PATCH } from '../app/api/email-drafts/[id]/status/route'
import { POST as COPY } from '../app/api/email-drafts/[id]/copy/route'
import { DELETE, GET as LIST, POST as CREATE } from '../app/api/email-drafts/route'

const ctx = (id = 'd1') => ({ params: Promise.resolve({ id }) })
const req = (body?: unknown) =>
  new Request('http://x/api/email-drafts/d1', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never

const item = (
  status: 'draft' | 'tested' | 'sent',
  extra: Record<string, unknown> = {}
): Record<string, any> => ({
  pkey: 'USER#owner@example.com',
  skey: 'EMAIL_DRAFT#d1',
  ...stored,
  note: 'old note',
  status,
  createdAt: '2025-11-29T00:00:00.000Z',
  updatedAt: '2025-12-01T00:00:00.000Z',
  createdBy: 'owner@example.com',
  ...extra,
})
const sentItem = item('sent', {
  sentAt: '2025-12-01T00:00:00.000Z',
  lastTestedAt: '2025-11-30T00:00:00.000Z',
})

/** A ConditionalCheckFailedException as DynamoDB raises it; `Item` = ALL_OLD. */
const conditionFailed = (oldItem?: unknown) =>
  Object.assign(new Error('The conditional request failed'), {
    name: 'ConditionalCheckFailedException',
    Item: oldItem,
  })

const commands = (kind: string) =>
  h.send.mock.calls.map((c) => c[0]).filter((c) => c.kind === kind).map((c) => c.input)

/** Reads find `found` (or nothing); writes behave as `write` does. */
const dynamo = (found: unknown, write: (cmd: any) => any = () => ({})) =>
  h.send.mockImplementation(async (cmd: any) =>
    cmd.kind === 'get' ? (found ? { Item: found } : {}) : write(cmd)
  )

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'owner@example.com' } })
  // Default: no PersonRecord → drafts are looked up under the session address only.
  h.getById.mockResolvedValue(null)
  h.getByEmailForAuth.mockResolvedValue(null)
  h.getEmails.mockResolvedValue([])
  h.getAllPersonsByEmail.mockResolvedValue([])
})

describe('PUT /api/email-drafts/[id]', () => {
  it('refuses to change the content of a SENT email (409), and writes nothing', async () => {
    h.send.mockImplementation(async (cmd: any) => (cmd.kind === 'get' ? { Item: sentItem } : {}))
    const res = await PUT(req({ ...stored, subject: 'New subject', note: 'old note' }), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already sent.*copy/i)
    expect(commands('update')).toHaveLength(0)
  })

  it('refuses a note-only edit on a SENT email too (409)', async () => {
    h.send.mockImplementation(async (cmd: any) => (cmd.kind === 'get' ? { Item: sentItem } : {}))
    const res = await PUT(req({ ...stored, note: 'new note' }), ctx())
    expect(res.status).toBe(409)
    expect(commands('update')).toHaveLength(0)
  })

  it('is enforced in the write: a send landing after the read still gets 409', async () => {
    h.send.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { Item: item('draft') }
      throw conditionFailed({ status: { S: 'sent' } })
    })
    const res = await PUT(req({ ...stored, subject: 'x' }), ctx())
    expect(res.status).toBe(409)
    const [input] = commands('update')
    expect(input.ConditionExpression).toContain('attribute_exists(skey)')
    expect(input.ConditionExpression).toContain('#status <> :sent')
    expect(input.ReturnValuesOnConditionCheckFailure).toBe('ALL_OLD')
  })

  it('editing a TESTED draft puts it back to draft and clears lastTestedAt', async () => {
    const tested = item('tested', { lastTestedAt: '2026-11-01T00:00:00.000Z' })
    h.send.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { Item: tested }
      const { lastTestedAt: _drop, ...rest } = tested
      return { Attributes: { ...rest, subject: 'New subject', status: 'draft' } }
    })

    const res = await PUT(req({ ...stored, subject: 'New subject', note: 'old note' }), ctx())
    expect(res.status).toBe(200)

    const [input] = commands('update')
    expect(input.UpdateExpression).toContain('#status = :draftStatus')
    expect(input.UpdateExpression).toContain('REMOVE #lastTestedAt')
    expect(input.ExpressionAttributeValues[':draftStatus']).toBe('draft')
    // only the changed content field is written
    expect(input.ExpressionAttributeValues[':subject']).toBe('New subject')
    expect(input.ExpressionAttributeValues).not.toHaveProperty(':htmlContent')

    const { draft } = await res.json()
    expect(draft.status).toBe('draft')
    expect(draft.lastTestedAt).toBeUndefined()
  })

  it('a note-only edit on a TESTED draft keeps it tested', async () => {
    const tested = item('tested', { lastTestedAt: '2026-11-01T00:00:00.000Z' })
    h.send.mockImplementation(async (cmd: any) =>
      cmd.kind === 'get' ? { Item: tested } : { Attributes: { ...tested, note: 'n' } }
    )
    const res = await PUT(req({ ...stored, note: 'n' }), ctx())
    expect(res.status).toBe(200)
    const [input] = commands('update')
    expect(input.UpdateExpression).not.toContain('#status =')
    expect(input.UpdateExpression).not.toContain('REMOVE')
  })

  it('a missing draft is a 404 and nothing is written', async () => {
    h.send.mockImplementation(async (cmd: any) => (cmd.kind === 'get' ? {} : { Attributes: {} }))
    const res = await PUT(req({ ...stored }), ctx())
    expect(res.status).toBe(404)
    expect(commands('update')).toHaveLength(0)
  })

  it('a draft deleted between read and write is a 404, not a new junk item', async () => {
    h.send.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { Item: item('draft') }
      throw conditionFailed(undefined)
    })
    const res = await PUT(req({ ...stored, subject: 'x' }), ctx())
    expect(res.status).toBe(404)
  })

  it('requires a signed-in user', async () => {
    h.auth.mockResolvedValue(null)
    const res = await PUT(req({ ...stored }), ctx())
    expect(res.status).toBe(401)
    expect(h.send).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/email-drafts/[id]/status', () => {
  const refuseSent = () => {
    throw conditionFailed({ status: { S: 'sent' } })
  }

  it('marking an already-sent email as sent again is refused (409)', async () => {
    dynamo(sentItem, refuseSent)
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(409)
    const [input] = commands('update')
    expect(input.ConditionExpression).toContain('attribute_exists(skey)')
    expect(input.ConditionExpression).toContain('#status <> :sent')
  })

  it('marking a sent email as tested is refused too (it would unlock it)', async () => {
    dynamo(sentItem, refuseSent)
    const res = await PATCH(req({ action: 'tested' }), ctx())
    expect(res.status).toBe(409)
  })

  it('a missing draft is a 404, never a new item', async () => {
    dynamo(null)
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(404)
    expect(commands('update')).toHaveLength(0)
  })

  it('a draft deleted between read and write is a 404', async () => {
    dynamo(item('tested'), () => {
      throw conditionFailed(undefined)
    })
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(404)
  })

  it('marks an unsent draft as sent', async () => {
    dynamo(item('tested'), () => ({ Attributes: { ...item('tested'), status: 'sent' } }))
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(200)
    expect(commands('update')[0].ExpressionAttributeValues[':status']).toBe('sent')
  })
})

describe('POST /api/email-drafts/[id]/copy', () => {
  it('copies subject, body and list into a NEW untested draft that points back at the source', async () => {
    h.send.mockImplementation(async (cmd: any) => (cmd.kind === 'get' ? { Item: sentItem } : {}))
    const res = await COPY(req(), ctx('d1'))
    expect(res.status).toBe(200)

    const { draft } = await res.json()
    expect(draft).toMatchObject({
      subject: stored.subject,
      htmlContent: stored.htmlContent,
      selectedList: stored.selectedList,
      status: 'draft',
      note: '',
      copiedFrom: 'd1',
      createdBy: 'owner@example.com',
    })
    expect(draft.id).not.toBe('d1')
    expect(draft.sentAt).toBeUndefined()
    expect(draft.lastTestedAt).toBeUndefined()
    expect(draft.createdAt).not.toBe(sentItem.createdAt)

    const [put] = commands('put')
    expect(put.Item.pkey).toBe('USER#owner@example.com')
    expect(put.Item.skey).toBe(`EMAIL_DRAFT#${draft.id}`)
    expect(put.Item).not.toHaveProperty('sentAt')
    expect(put.Item).not.toHaveProperty('lastTestedAt')
    expect(put.ConditionExpression).toBe('attribute_not_exists(skey)')
    // the source is read only, never modified
    expect(commands('update')).toHaveLength(0)
  })

  it('a missing source is a 404 and nothing is written', async () => {
    h.send.mockResolvedValue({})
    const res = await COPY(req(), ctx('nope'))
    expect(res.status).toBe(404)
    expect(commands('put')).toHaveLength(0)
  })

  it('requires a signed-in user', async () => {
    h.auth.mockResolvedValue(null)
    const res = await COPY(req(), ctx())
    expect(res.status).toBe(401)
    expect(h.send).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/email-drafts?id=…', () => {
  const del = (id = 'd1') =>
    new Request(`http://x/api/email-drafts?id=${id}`, { method: 'DELETE' }) as never

  it('refuses to delete a SENT email (409), enforced in the delete condition', async () => {
    dynamo(sentItem, () => {
      throw conditionFailed({ status: { S: 'sent' } })
    })
    const res = await DELETE(del())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/permanent record/i)
    const [input] = commands('delete')
    expect(input.ConditionExpression).toContain('attribute_exists(skey)')
    expect(input.ConditionExpression).toContain('#status <> :sent')
    expect(input.ExpressionAttributeValues[':sent']).toBe('sent')
    expect(input.ReturnValuesOnConditionCheckFailure).toBe('ALL_OLD')
  })

  it('deletes an unsent draft', async () => {
    dynamo(item('draft'))
    const res = await DELETE(del())
    expect(res.status).toBe(200)
    expect(commands('delete')[0].Key).toEqual({
      pkey: 'USER#owner@example.com',
      skey: 'EMAIL_DRAFT#d1',
    })
  })

  it('a missing draft is a 404 and nothing is deleted', async () => {
    dynamo(null)
    const res = await DELETE(del('nope'))
    expect(res.status).toBe(404)
    expect(commands('delete')).toHaveLength(0)
  })

  it('a draft that vanishes between read and delete is a 404', async () => {
    dynamo(item('draft'), () => {
      throw conditionFailed(undefined)
    })
    const res = await DELETE(del())
    expect(res.status).toBe(404)
  })

  it('requires a signed-in user', async () => {
    h.auth.mockResolvedValue(null)
    const res = await DELETE(del())
    expect(res.status).toBe(401)
    expect(h.send).not.toHaveBeenCalled()
  })
})

// ── Drafts belong to the PERSON, not the sign-in address ────────────────────

describe('drafts across a person’s own addresses', () => {
  const PRIMARY = 'primary@example.com'
  const ALT = 'alt@example.com'
  const SHARED = 'shared-household@example.com'

  const signInAs = (email: string, personId?: string) =>
    h.auth.mockResolvedValue({ user: { email, ...(personId ? { personId } : {}) } })

  /** Person p1: primary PRIMARY, also ALT, plus SHARED which p2 also holds. */
  const personP1 = () => {
    h.getByEmailForAuth.mockResolvedValue({ personId: 'p1', email: PRIMARY })
    h.getById.mockImplementation(async (id: string) =>
      id === 'p1' ? { personId: 'p1', primaryEmail: PRIMARY } : null
    )
    h.getEmails.mockResolvedValue([{ email: PRIMARY }, { email: 'Alt@Example.com' }, { email: SHARED }])
    h.getAllPersonsByEmail.mockImplementation(async (email: string) =>
      email === SHARED ? [{ personId: 'p1' }, { personId: 'p2' }] : [{ personId: 'p1' }]
    )
  }

  /** A fake table: drafts by pkey. */
  const table = (byPkey: Record<string, Record<string, any>[]>) =>
    h.send.mockImplementation(async (cmd: any) => {
      const rows = (pkey: string) => byPkey[pkey] ?? []
      if (cmd.kind === 'query') return { Items: rows(cmd.input.ExpressionAttributeValues[':pkey']) }
      const hit = cmd.input.Key
        ? rows(cmd.input.Key.pkey).find((i) => i.skey === cmd.input.Key.skey)
        : undefined
      if (cmd.kind === 'get') return hit ? { Item: hit } : {}
      if (cmd.kind === 'update') {
        return { Attributes: { ...hit, subject: cmd.input.ExpressionAttributeValues[':subject'] ?? hit?.subject } }
      }
      return {}
    })

  const draftUnder = (email: string, id: string, extra: Record<string, unknown> = {}) => ({
    ...item('draft', extra),
    pkey: 'USER#' + email,
    skey: 'EMAIL_DRAFT#' + id,
    createdBy: email,
  })

  const listReq = () => new Request('http://x/api/email-drafts') as never
  const queriedKeys = () => commands('query').map((q) => q.ExpressionAttributeValues[':pkey'])
  const listIds = async () =>
    ((await (await LIST(listReq())).json()).drafts as { id: string }[]).map((d) => d.id).sort()

  it('drafts saved under address A are listed when signed in as address B of the same person', async () => {
    personP1()
    signInAs(ALT)
    table({
      ['USER#' + PRIMARY]: [draftUnder(PRIMARY, 'a1'), draftUnder(PRIMARY, 'a2')],
      ['USER#' + ALT]: [draftUnder(ALT, 'b1')],
    })
    expect(await listIds()).toEqual(['a1', 'a2', 'b1'])
  })

  it('another person’s drafts are NOT visible — a shared household address is left out', async () => {
    personP1()
    signInAs(ALT)
    table({
      ['USER#' + SHARED]: [draftUnder(SHARED, 'theirs')],
      ['USER#other@example.com']: [draftUnder('other@example.com', 'stranger')],
    })
    expect(await listIds()).toEqual([])
    expect(queriedKeys()).not.toContain('USER#' + SHARED)
    expect(queriedKeys()).not.toContain('USER#other@example.com')
    expect(queriedKeys().sort()).toEqual(['USER#' + ALT, 'USER#' + PRIMARY].sort())
  })

  it('a personId on the session is used over the address lookup', async () => {
    personP1()
    h.getByEmailForAuth.mockResolvedValue({ personId: 'p2', email: 'someone-else@example.com' })
    signInAs(ALT, 'p1')
    table({ ['USER#' + PRIMARY]: [draftUnder(PRIMARY, 'a1')] })
    expect(await listIds()).toEqual(['a1'])
    expect(h.getById).toHaveBeenCalledWith('p1')
  })

  it('an update finds the draft under the other address and writes it THERE', async () => {
    personP1()
    signInAs(ALT)
    table({ ['USER#' + PRIMARY]: [draftUnder(PRIMARY, 'a1')] })
    const res = await PUT(req({ ...stored, subject: 'Edited' }), ctx('a1'))
    expect(res.status).toBe(200)
    const [update] = commands('update')
    expect(update.Key).toEqual({ pkey: 'USER#' + PRIMARY, skey: 'EMAIL_DRAFT#a1' })
    expect(update.ConditionExpression).toContain('attribute_exists(skey)')
  })

  it('a by-id request for another person’s draft is a 404', async () => {
    personP1()
    signInAs(ALT)
    table({ ['USER#' + SHARED]: [draftUnder(SHARED, 'theirs')] })
    const res = await PUT(req({ ...stored, subject: 'x' }), ctx('theirs'))
    expect(res.status).toBe(404)
    expect(commands('update')).toHaveLength(0)
  })

  it('a new draft lands under the person’s PRIMARY address', async () => {
    personP1()
    signInAs(ALT)
    table({})
    const res = await CREATE(req({ ...stored, note: '' }))
    expect(res.status).toBe(200)
    expect(commands('put')[0].Item.pkey).toBe('USER#' + PRIMARY)
  })

  it('a copy lands under the PRIMARY address too', async () => {
    personP1()
    signInAs(ALT)
    table({ ['USER#' + ALT]: [draftUnder(ALT, 'b1', { status: 'sent' })] })
    const res = await COPY(req(), ctx('b1'))
    expect(res.status).toBe(200)
    expect(commands('put')[0].Item.pkey).toBe('USER#' + PRIMARY)
  })

  it('no PersonRecord: falls back to the session address only', async () => {
    signInAs('nobody@example.com')
    table({
      ['USER#nobody@example.com']: [draftUnder('nobody@example.com', 'n1')],
      ['USER#' + PRIMARY]: [draftUnder(PRIMARY, 'a1')],
    })
    expect(await listIds()).toEqual(['n1'])
    expect(queriedKeys()).toEqual(['USER#nobody@example.com'])

    await CREATE(req({ ...stored }))
    expect(commands('put')[0].Item.pkey).toBe('USER#nobody@example.com')
  })

  it('a person lookup failure also falls back to the session address only', async () => {
    h.getByEmailForAuth.mockRejectedValue(new Error('lookup down'))
    signInAs(ALT)
    table({ ['USER#' + ALT]: [draftUnder(ALT, 'b1')] })
    expect(await listIds()).toEqual(['b1'])
  })
})
