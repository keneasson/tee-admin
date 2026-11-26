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
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
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
  return {
    DynamoDBDocumentClient: { from: () => ({ send: h.send }) },
    GetCommand,
    UpdateCommand,
    PutCommand,
  }
})

import { PUT } from '../app/api/email-drafts/[id]/route'
import { PATCH } from '../app/api/email-drafts/[id]/status/route'
import { POST as COPY } from '../app/api/email-drafts/[id]/copy/route'

const ctx = (id = 'd1') => ({ params: Promise.resolve({ id }) })
const req = (body?: unknown) =>
  new Request('http://x/api/email-drafts/d1', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never

const item = (status: 'draft' | 'tested' | 'sent', extra: Record<string, unknown> = {}) => ({
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

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'owner@example.com' } })
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
  it('marking an already-sent email as sent again is refused (409)', async () => {
    h.send.mockRejectedValue(conditionFailed({ status: { S: 'sent' } }))
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(409)
    const [input] = commands('update')
    expect(input.ConditionExpression).toContain('attribute_exists(skey)')
    expect(input.ConditionExpression).toContain('#status <> :sent')
  })

  it('marking a sent email as tested is refused too (it would unlock it)', async () => {
    h.send.mockRejectedValue(conditionFailed({ status: { S: 'sent' } }))
    const res = await PATCH(req({ action: 'tested' }), ctx())
    expect(res.status).toBe(409)
  })

  it('a missing draft is a 404, never a new item', async () => {
    h.send.mockRejectedValue(conditionFailed(undefined))
    const res = await PATCH(req({ action: 'sent' }), ctx())
    expect(res.status).toBe(404)
  })

  it('marks an unsent draft as sent', async () => {
    h.send.mockResolvedValue({ Attributes: { ...item('tested'), status: 'sent' } })
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
