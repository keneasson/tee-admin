import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * The speaker-invite email seam: who it sends to, from which sender, with
 * which links, under which idempotency claim. SES, tokens and DynamoDB are
 * mocked; the renders are replaced by a stub that hands back the props, so the
 * tests can read every link the template would receive. Placeholders only.
 */

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  claimEmail: vi.fn(),
  releaseEmail: vi.fn(),
  snapshotRoster: vi.fn(),
  generateEcclesiaToken: vi.fn(),
  people: new Map<string, any>(),
  loadSlotDetails: vi.fn(),
  rendered: [] as Array<{ kind: string; props: any }>,
}))

vi.mock('@/utils/email/sesClient', () => ({ sendEmail: h.sendEmail }))
vi.mock('@/utils/email/ecclesia-token', () => ({
  generateEcclesiaToken: h.generateEcclesiaToken,
  generateEmailPreferencesUrl: async (email: string, base: string) => `${base}/email-preferences?token=prefs-${email}`,
}))
vi.mock('@my/app/provider/dynamodb/repositories/speaker-invite-repository', () => ({
  speakerInviteRepository: { claimEmail: h.claimEmail, releaseEmail: h.releaseEmail },
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-recipient-repository', () => ({
  sendRecipientRepository: { snapshotRoster: h.snapshotRoster },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: async (id: string) => h.people.get(id) ?? null },
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  getEcclesiaByName: async (name: string) => ({ name, venue: 'Example Hall', address: '1 Example Street, Example City' }),
}))
vi.mock('@/utils/speaker-invites/slots', () => ({ loadSlotDetails: h.loadSlotDetails }))
vi.mock('@/utils/email/exhorter-heads-up', () => ({
  EMAIL_TRACKING_CONFIG_SET: 'tee-email-tracking',
  DEFAULT_TEE_ZOOM: { label: 'Home Zoom', url: 'https://zoom.example.test/j/1', meetingId: '1' },
  resolveHallAddress: (e: any) => e?.address,
}))
vi.mock('@/utils/email/speaker-invite-render', () => {
  const stub = (kind: string) => async (props: any) => {
    h.rendered.push({ kind, props })
    return { html: `<p>${kind}</p>`, text: kind, subject: `${kind} subject` }
  }
  return {
    renderSpeakerInvitation: stub('invitation'),
    renderSpeakerConfirmation: stub('confirmation'),
    renderSpeakerSwapRequest: stub('swap-request'),
    renderSpeakerInviterNotice: stub('inviter-notice'),
    renderSpeakerSwapOutcome: stub('swap-outcome'),
  }
})

import {
  sendCancellationEmail,
  sendConfirmationEmail,
  sendInvitationEmail,
  sendInviterNotice,
  sendSwapOutcomeEmail,
  sendSwapRequestEmail,
} from '@/utils/email/speaker-invite-emails'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

const HOME = HOME_ECCLESIA.canonicalName
const OTHER = 'Other Test Ecclesia'

function invite(overrides: Record<string, any> = {}): any {
  return {
    inviteId: 'inv-1',
    ecclesia: HOME,
    type: 'memorial',
    status: 'sent',
    inviterPersonId: 'p-rb',
    inviteePersonId: 'p-a',
    inviteeEmail: 'alex@example.test',
    offeredDates: [
      { date: '2026-11-15', time: '11:00', tz: 'America/Toronto' },
      { date: '2026-11-22', time: '11:00', tz: 'America/Toronto' },
    ],
    otherDatesWindow: { from: '2026-11-13', to: '2026-12-31' },
    history: [{ action: 'created' }],
    ...overrides,
  }
}

const sent = () => h.sendEmail.mock.calls.map((c) => c[0])
const lastRender = (kind: string) => [...h.rendered].reverse().find((r) => r.kind === kind)!.props

beforeEach(() => {
  vi.clearAllMocks()
  h.rendered.length = 0
  h.people.clear()
  h.people.set('p-rb', { personId: 'p-rb', firstName: 'Rob', lastName: 'Recorder', primaryEmail: 'rb@example.test' })
  h.people.set('p-a', { personId: 'p-a', firstName: 'Alex', lastName: 'Speaker', primaryEmail: 'alex@example.test' })
  h.people.set('p-b', { personId: 'p-b', firstName: 'Blair', lastName: 'Speaker', primaryEmail: 'blair@example.test' })
  h.claimEmail.mockResolvedValue(true)
  h.sendEmail.mockResolvedValue(undefined)
  h.snapshotRoster.mockResolvedValue(undefined)
  h.generateEcclesiaToken.mockImplementation(async (email: string) => `tok-${email}`)
  h.loadSlotDetails.mockResolvedValue({ slots: [] })
})

describe('invitation', () => {
  it('canonical brand sender, Reply-To = inviter, tracking set + Campaign tag, recipient snapshot', async () => {
    await sendInvitationEmail(invite())
    const [mail] = sent()
    expect(mail).toMatchObject({
      to: 'alex@example.test',
      from: '"Toronto East Ecclesia" <communications@tee-admin.com>',
      replyTo: 'rb@example.test',
      configurationSetName: 'tee-email-tracking',
      emailTags: [
        { Name: 'Reason', Value: 'speaker-invite' },
        { Name: 'Campaign', Value: 'speaker-invite-inv-1' },
      ],
    })
    expect(h.snapshotRoster).toHaveBeenCalledWith('speaker-invite-inv-1', [
      { email: 'alex@example.test', status: 'sent', ecclesia: HOME },
    ])
  })

  it('another ecclesia goes out under the Echad Hub brand', async () => {
    await sendInvitationEmail(invite({ ecclesia: OTHER }))
    expect(sent()[0].from).toBe('"Echad Hub" <communications@echadhub.org>')
    expect(lastRender('invitation').dateOptions[0].url).toMatch(/^https:\/\/echadhub\.org\/invite\//)
  })

  it('date buttons open the page with that date selected; other dates go to #other-dates', async () => {
    await sendInvitationEmail(invite())
    const props = lastRender('invitation')
    expect(h.generateEcclesiaToken).toHaveBeenCalledWith('alex@example.test')
    expect(props.dateOptions).toEqual([
      { label: 'Sunday, November 15, 2026 at 11:00am', url: 'https://tee-admin.com/invite/inv-1?token=tok-alex%40example.test&date=2026-11-15' },
      { label: 'Sunday, November 22, 2026 at 11:00am', url: 'https://tee-admin.com/invite/inv-1?token=tok-alex%40example.test&date=2026-11-22' },
    ])
    expect(props.otherDatesUrl).toBe('https://tee-admin.com/invite/inv-1?token=tok-alex%40example.test#other-dates')
    expect(props).toMatchObject({ inviteeName: 'Alex Speaker', inviterName: 'Rob Recorder', ecclesiaName: HOME })
  })

  it('a TEST send goes only to the given address, "[TEST]" subject, a token for THAT address, no claim', async () => {
    await sendInvitationEmail(invite(), { testTo: 'rb@example.test' })
    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ to: 'rb@example.test', subject: '[TEST] invitation subject' })
    expect(h.generateEcclesiaToken).toHaveBeenCalledWith('rb@example.test')
    expect(h.generateEcclesiaToken).not.toHaveBeenCalledWith('alex@example.test')
    expect(h.claimEmail).not.toHaveBeenCalled()
  })
})

describe('idempotency (exhorter heads-up pattern)', () => {
  it('claims per invite + event + sequence before sending', async () => {
    await sendInvitationEmail(invite())
    expect(h.claimEmail).toHaveBeenCalledWith('inv-1#invitation#1', { sentTo: 'alex@example.test', event: 'invitation' })
    expect(h.claimEmail.mock.invocationCallOrder[0]).toBeLessThan(h.sendEmail.mock.invocationCallOrder[0])
  })

  it('an existing claim means already sent: nothing goes out', async () => {
    h.claimEmail.mockResolvedValue(false)
    await sendInvitationEmail(invite())
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('a failed send releases the claim and rethrows (so the service records email_failed)', async () => {
    h.sendEmail.mockRejectedValueOnce(new Error('SES down'))
    await expect(sendInvitationEmail(invite())).rejects.toThrow('SES down')
    expect(h.releaseEmail).toHaveBeenCalledWith('inv-1#invitation#1')
    expect(h.snapshotRoster).not.toHaveBeenCalled()
  })
})

describe('confirmation, cancellation, swap request, inviter notice', () => {
  const booking = { ecclesia: HOME, type: 'memorial' as const, date: '2026-11-15', time: '11:00', tz: 'America/Toronto', personId: 'p-a', inviteId: 'inv-1' }

  it('confirmation carries .ics, manage and Google links, the hall, and its own date’s short notice', async () => {
    h.loadSlotDetails.mockResolvedValue({
      slots: [{ date: '2026-11-15', override: { attendOptions: [{ id: 'z', label: 'Override Zoom', mode: 'online', url: 'https://zoom.example.test/j/2' }] } }],
    })
    await sendConfirmationEmail(invite({ status: 'accepted', acceptedDate: '2026-11-15' }), booking, {
      reason: 'swapped',
      swapId: 'sw-1',
      shortNotice: { date: '2026-11-15', counterpartRole: 'Presiding', counterpartName: 'Pat Presider' },
    })
    const props = lastRender('confirmation')
    expect(props).toMatchObject({
      variant: 'changed',
      icsUrl: 'https://tee-admin.com/api/invite/inv-1/ics?token=tok-alex%40example.test',
      manageUrl: 'https://tee-admin.com/invite/inv-1?token=tok-alex%40example.test',
      hallName: 'Example Hall',
      address: '1 Example Street, Example City',
      dateDisplay: 'Sunday, November 15, 2026',
      timeDisplay: '11:00am',
      shortNotice: { counterpartRole: 'Presiding', counterpartName: 'Pat Presider' },
      onlineMeetings: [{ label: 'Override Zoom', url: 'https://zoom.example.test/j/2' }],
    })
    expect(props.googleCalendarUrl).toContain('dates=20261115T160000Z/20261115T173000Z')
    expect(sent()[0]).toMatchObject({ to: 'alex@example.test', replyTo: 'rb@example.test' })
  })

  it('a speaker without an invite (Sheet-filled, swapped in) gets no .ics or manage link', async () => {
    await sendConfirmationEmail(null, { ...booking, personId: 'p-b', inviteId: undefined }, { reason: 'swapped', swapId: 'sw-1' })
    const props = lastRender('confirmation')
    expect(props.icsUrl).toBeUndefined()
    expect(props.manageUrl).toBeUndefined()
    expect(h.claimEmail).toHaveBeenCalledWith('swap#sw-1#confirmation#p-b', expect.anything())
  })

  it('cancellation uses the cancelled variant with the .ics link and no Google link', async () => {
    await sendCancellationEmail(invite({ status: 'cancelled', acceptedDate: '2026-11-15' }), booking)
    const props = lastRender('confirmation')
    expect(props.variant).toBe('cancelled')
    expect(props.googleCalendarUrl).toBeUndefined()
    expect(props.icsUrl).toContain('/api/invite/inv-1/ics?token=')
  })

  it('swap request goes to the other speaker with their own token; buttons open the swap page', async () => {
    await sendSwapRequestEmail({
      swapId: 'sw-1', ecclesia: HOME, type: 'memorial', field: 'Exhort', status: 'open',
      requester: { personId: 'p-a', name: 'Alex Speaker', date: '2026-11-15', time: '11:00', tz: 'America/Toronto', inviteId: 'inv-1', hadBooking: true },
      target: { personId: 'p-b', name: 'Blair Speaker', date: '2026-11-22', time: '11:00', tz: 'America/Toronto', hadBooking: false },
      createdAt: 'x', expiresAt: '2026-11-15T16:00:00.000Z', version: 1, pkey: 'x', skey: 'META',
    } as any)
    const props = lastRender('swap-request')
    expect(props.acceptUrl).toBe('https://tee-admin.com/invite/swap/sw-1?token=tok-blair%40example.test&action=accept')
    expect(props.declineUrl).toBe('https://tee-admin.com/invite/swap/sw-1?token=tok-blair%40example.test&action=decline')
    expect(sent()[0]).toMatchObject({ to: 'blair@example.test', replyTo: 'alex@example.test' })
  })

  it('swap outcome uses the template, to the requester, with the other speaker’s first name only', async () => {
    await sendSwapOutcomeEmail({
      swapId: 'sw-1', ecclesia: HOME, type: 'memorial', field: 'Exhort', status: 'declined',
      requester: { personId: 'p-a', name: 'Alex Speaker', date: '2026-11-15', time: '11:00', tz: 'America/Toronto', inviteId: 'inv-1', hadBooking: true },
      target: { personId: 'p-b', name: 'Blair Speaker', date: '2026-11-22', time: '11:00', tz: 'America/Toronto', hadBooking: false },
      createdAt: 'x', expiresAt: 'x', version: 2, pkey: 'x', skey: 'META',
    } as any, 'declined')
    expect(lastRender('swap-outcome')).toMatchObject({
      outcome: 'declined',
      otherSpeakerName: 'Blair',
      requesterDateDisplay: 'Sunday, November 15, 2026 at 11:00am',
      manageUrl: 'https://tee-admin.com/invite/inv-1?token=tok-alex%40example.test',
    })
    expect(sent()[0]).toMatchObject({ to: 'alex@example.test', subject: 'swap-outcome subject' })
    expect(h.claimEmail).toHaveBeenCalledWith('sw-1#swap-outcome', expect.anything())
  })

  it('inviter notice goes to the inviter and carries the Sheet reminder when asked', async () => {
    await sendInviterNotice(invite({ status: 'cancelled', acceptedDate: '2026-11-15', acceptedTime: '11:00' }), 'cancelled', {
      sheetReminder: { name: 'Alex Speaker', date: '2026-11-15' },
    })
    const props = lastRender('inviter-notice')
    expect(props).toMatchObject({
      kind: 'cancelled',
      speakerName: 'Alex Speaker',
      sheetReminder: { name: 'Alex Speaker', dateDisplay: 'Sunday, November 15, 2026' },
    })
    expect(sent()[0]).toMatchObject({ to: 'rb@example.test', replyTo: 'alex@example.test' })
    expect(h.claimEmail).toHaveBeenCalledWith('inv-1#inviter-cancelled#1', expect.anything())
  })
})
