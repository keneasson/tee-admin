import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planDraftUpdate } from '@my/app/utils/email-draft-update'

/**
 * Editing a custom-email draft that was already tested or sent must not keep
 * calling it "tested"/"sent": that status described the OLD content. Changing
 * the subject, body or list puts it back to `draft` and clears `lastTestedAt`
 * (so the new content needs a fresh test); `sentAt` is kept as history.
 * A note-only edit leaves the status alone.
 */

const stored = {
  subject: 'Annual meeting',
  htmlContent: '<p>Ballot: https://example.com/old</p>',
  selectedList: 'list-1',
}

describe('planDraftUpdate', () => {
  it('resets a SENT draft when the subject changes', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'sent', lastTestedAt: '2025-12-01T00:00:00.000Z' },
      { ...stored, subject: 'Annual meeting (new year)' }
    )
    expect(plan.resetToDraft).toBe(true)
    expect(plan.changedContentFields).toEqual(['subject'])
  })

  it('resets a SENT draft when the body changes', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'sent' },
      { ...stored, htmlContent: '<p>Ballot: https://example.com/new</p>' }
    )
    expect(plan.resetToDraft).toBe(true)
    expect(plan.changedContentFields).toEqual(['htmlContent'])
  })

  it('resets a TESTED draft when the list changes', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'tested', lastTestedAt: '2026-11-01T00:00:00.000Z' },
      { ...stored, selectedList: 'list-2' }
    )
    expect(plan.resetToDraft).toBe(true)
  })

  it('does NOT reset on a note-only edit', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'sent', lastTestedAt: '2025-12-01T00:00:00.000Z' },
      { ...stored, note: 'a new note' }
    )
    expect(plan.resetToDraft).toBe(false)
    expect(plan.changedContentFields).toEqual([])
  })

  it('does NOT reset when the save changes nothing', () => {
    expect(planDraftUpdate({ ...stored, status: 'tested' }, { ...stored }).resetToDraft).toBe(false)
  })

  it('ignores fields the update leaves out', () => {
    expect(planDraftUpdate({ ...stored, status: 'sent' }, { note: 'x' }).resetToDraft).toBe(false)
  })

  it('a plain draft has nothing to reset', () => {
    const plan = planDraftUpdate({ ...stored, status: 'draft' }, { ...stored, subject: 'new' })
    expect(plan.resetToDraft).toBe(false)
    expect(plan.changedContentFields).toEqual(['subject'])
  })

  it('a draft-status record that still carries lastTestedAt is cleared on a content edit', () => {
    const plan = planDraftUpdate(
      { ...stored, status: 'draft', lastTestedAt: '2026-11-01T00:00:00.000Z' },
      { ...stored, subject: 'new' }
    )
    expect(plan.resetToDraft).toBe(true)
  })
})

// ── PUT /api/email-drafts/[id] ──────────────────────────────────────────────

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
  return {
    DynamoDBDocumentClient: { from: () => ({ send: h.send }) },
    GetCommand,
    UpdateCommand,
  }
})

import { PUT } from '../app/api/email-drafts/[id]/route'

const ctx = () => ({ params: Promise.resolve({ id: 'd1' }) })
const req = (body: unknown) =>
  new Request('http://x/api/email-drafts/d1', {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as never

const sentItem = {
  pkey: 'USER#owner@example.com',
  skey: 'EMAIL_DRAFT#d1',
  ...stored,
  note: '',
  status: 'sent',
  sentAt: '2025-12-01T00:00:00.000Z',
  lastTestedAt: '2025-11-30T00:00:00.000Z',
  createdAt: '2025-11-29T00:00:00.000Z',
  updatedAt: '2025-12-01T00:00:00.000Z',
  createdBy: 'owner@example.com',
}

/** The UpdateCommand input the route sent. */
const updateInput = () => h.send.mock.calls.map((c) => c[0]).find((c) => c.kind === 'update')?.input

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'owner@example.com' } })
})

describe('PUT /api/email-drafts/[id]', () => {
  it('editing a sent draft puts it back to draft, clears lastTestedAt, keeps sentAt', async () => {
    h.send.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { Item: sentItem }
      const { lastTestedAt: _drop, ...rest } = sentItem
      return { Attributes: { ...rest, subject: 'New subject', status: 'draft' } }
    })

    const res = await PUT(req({ ...stored, subject: 'New subject', note: '' }), ctx())
    expect(res.status).toBe(200)

    const input = updateInput()
    expect(input.UpdateExpression).toContain('#status = :draftStatus')
    expect(input.UpdateExpression).toContain('REMOVE #lastTestedAt')
    expect(input.UpdateExpression).not.toContain('sentAt')
    expect(input.ExpressionAttributeValues[':draftStatus']).toBe('draft')
    expect(input.ConditionExpression).toBe('attribute_exists(skey)')

    const { draft } = await res.json()
    expect(draft.status).toBe('draft')
    expect(draft.lastTestedAt).toBeUndefined()
    expect(draft.sentAt).toBe('2025-12-01T00:00:00.000Z')
  })

  it('a note-only edit leaves status and lastTestedAt alone', async () => {
    h.send.mockImplementation(async (cmd: any) =>
      cmd.kind === 'get' ? { Item: sentItem } : { Attributes: { ...sentItem, note: 'n' } }
    )

    const res = await PUT(req({ ...stored, note: 'n' }), ctx())
    expect(res.status).toBe(200)
    const input = updateInput()
    expect(input.UpdateExpression).not.toContain('#status')
    expect(input.UpdateExpression).not.toContain('REMOVE')
    expect(input.ConditionExpression).toBe('attribute_exists(skey)')
  })

  it('a missing draft is a 404 and nothing is written', async () => {
    h.send.mockImplementation(async (cmd: any) => (cmd.kind === 'get' ? {} : { Attributes: {} }))

    const res = await PUT(req({ ...stored }), ctx())
    expect(res.status).toBe(404)
    expect(updateInput()).toBeUndefined()
  })

  it('a draft deleted between read and write is a 404, not a new junk item', async () => {
    h.send.mockImplementation(async (cmd: any) => {
      if (cmd.kind === 'get') return { Item: sentItem }
      const err = new Error('The conditional request failed')
      err.name = 'ConditionalCheckFailedException'
      throw err
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
