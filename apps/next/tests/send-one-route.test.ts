import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * Guard + envelope matrix for POST /api/email/send-one (Issue #127).
 *
 * The safety-critical bits: owner/admin only, permission attestation REQUIRED
 * (re-checked server-side), reason/email validation, and — when it does send —
 * a 1:1 send using the SAME canonical envelope (from/replyTo/subject) as the
 * broadcast, WITHOUT clearing the type's pending note (that belongs to the real
 * broadcast, not this side-send).
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getEmailContent: vi.fn(),
  buildEmailEnvelope: vi.fn(),
  sendEmail: vi.fn(),
  getNote: vi.fn(),
  clearNote: vi.fn(),
  resolveTenantFromEnv: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../utils/email/get-email-content', () => ({ getEmailContent: h.getEmailContent }))
vi.mock('../utils/email/email-send', () => ({ buildEmailEnvelope: h.buildEmailEnvelope }))
vi.mock('../utils/email/sesClient', () => ({ sendEmail: h.sendEmail }))
vi.mock('@my/app/provider/dynamodb/repositories/pending-email-note-repository', () => ({
  pendingEmailNoteRepository: { getNote: h.getNote, clearNote: h.clearNote },
}))
vi.mock('@my/app/config/tenants', () => ({ resolveTenantFromEnv: h.resolveTenantFromEnv }))

import { POST } from '../app/api/email/send-one/route'

function req(body: any) {
  return { json: async () => body } as any
}

const OWNER = { user: { email: 'owner@tee-admin.com', role: ROLES.OWNER } }

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(OWNER)
  h.getEmailContent.mockResolvedValue(['<html>news</html>', 'news text'])
  h.buildEmailEnvelope.mockReturnValue({
    from: '"Toronto East" <communications@tee-admin.com>',
    replyTo: 'teerecbro@gmail.com',
    subject: 'Toronto East Christadelphians Newsletter 2026-07-30',
  })
  h.sendEmail.mockResolvedValue(undefined)
  h.getNote.mockResolvedValue(undefined)
  h.resolveTenantFromEnv.mockReturnValue({ senderDomain: 'tee-admin.com', publicName: 'Toronto East Christadelphians' })
})

describe('POST /api/email/send-one — guards', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(401)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue({ user: { email: 'm@x.com', role: ROLES.MEMBER } })
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(403)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('403 when permission attestation is missing/false', async () => {
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com' }))
    expect(res.status).toBe(403)
    const res2 = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: false }))
    expect(res2.status).toBe(403)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('400 on an unsupported reason (e.g. business-meeting)', async () => {
    const res = await POST(req({ reason: 'business-meeting', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(400)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('400 on an invalid email', async () => {
    const res = await POST(req({ reason: 'newsletter', to: 'not-an-email', permission: true }))
    expect(res.status).toBe(400)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('422 when there is no content to render', async () => {
    h.getEmailContent.mockResolvedValue([])
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(422)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/email/send-one — sends', () => {
  it('sends 1:1 with the canonical envelope and does NOT clear the pending note', async () => {
    const res = await POST(
      req({ reason: 'newsletter', to: 'Donna@Example.com', recipientName: 'Donna Webb', permission: true })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.to).toBe('donna@example.com') // normalized

    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const arg = h.sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('donna@example.com')
    expect(arg.from).toContain('communications@tee-admin.com') // canonical sender, not noreply@
    expect(arg.replyTo).toBe('teerecbro@gmail.com')
    expect(arg.subject).toContain('Newsletter')
    expect(arg.body).toContain('news')

    // A one-off side-send must never clear the broadcast's pending note.
    expect(h.clearNote).not.toHaveBeenCalled()
  })

  it('uses the type pending note when no note is supplied', async () => {
    h.getNote.mockResolvedValue('Special reminder')
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(200)
    expect(h.getNote).toHaveBeenCalledWith('newsletter')
    // note is threaded into the render
    expect(h.getEmailContent).toHaveBeenCalledWith('newsletter', 'Special reminder')
    const json = await res.json()
    expect(json.hadNote).toBe(true)
  })

  it('502 when SES send throws', async () => {
    h.sendEmail.mockRejectedValue(new Error('SES down'))
    const res = await POST(req({ reason: 'newsletter', to: 'a@b.com', permission: true }))
    expect(res.status).toBe(502)
  })
})
