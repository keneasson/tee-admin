import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * Guard / resolve matrix for resolveAndSendExhorterHeadsUp (#124, slice A).
 *
 * All I/O is mocked (schedule read, directory, render, send, idempotency,
 * preferences URL) so this exercises the decision logic hermetically. The real
 * pure helpers (name resolver, home-ecclesia, timezone) run unmocked.
 */

const h = vi.hoisted(() => ({
  getScheduleData: vi.fn(),
  listAll: vi.fn(),
  getById: vi.fn(),
  sendEmail: vi.fn(),
  renderExhorterHeadsUp: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  generateEmailPreferencesUrl: vi.fn(),
  fetchServiceOverrides: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/schedule-service', () => ({
  ScheduleService: vi.fn().mockImplementation(() => ({ getScheduleData: h.getScheduleData })),
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { listAll: h.listAll, getById: h.getById },
}))
vi.mock('../utils/email/sesClient', () => ({ sendEmail: h.sendEmail }))
vi.mock('../utils/email/exhorter-heads-up-render', () => ({
  renderExhorterHeadsUp: h.renderExhorterHeadsUp,
}))
vi.mock('../utils/email/ecclesia-token', () => ({
  generateEmailPreferencesUrl: h.generateEmailPreferencesUrl,
}))
vi.mock('@my/app/provider/dynamodb/repositories/exhorter-headsup-repository', () => ({
  exhorterHeadsUpRepository: { claim: h.claim, release: h.release },
}))
vi.mock('@my/app/utils/service-overrides/merge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@my/app/utils/service-overrides/merge')>()
  return { ...actual, fetchServiceOverrides: h.fetchServiceOverrides }
})

import { resolveAndSendExhorterHeadsUp } from '../utils/email/exhorter-heads-up'

const TARGET_DATE = '2026-02-01' // a Sunday
const REQUESTER = 'admin@tee-admin.com'

function personRecord(
  over: Partial<PersonRecord> &
    Pick<PersonRecord, 'personId' | 'firstName' | 'lastName' | 'ecclesia'>
): PersonRecord {
  const { personId, firstName, lastName, ecclesia } = over
  return {
    pkey: `PERSON#${personId}`,
    skey: 'PROFILE',
    gsi1pk: `EMAIL#${firstName}.${lastName}@example.com`.toLowerCase(),
    gsi1sk: 'PERSON',
    gsi2pk: `ECCLESIA#${ecclesia}`,
    gsi2sk: `${lastName}#${firstName}#${personId}`.toLowerCase(),
    gsi3pk: `NAME#${lastName}`.toLowerCase(),
    gsi3sk: `${firstName}#${personId}`.toLowerCase(),
    primaryEmail: `${firstName}.${lastName}@example.com`.toLowerCase(),
    displayName: `${firstName} ${lastName}`,
    memberStatus: 'member' as PersonRecord['memberStatus'],
    ...over,
  } as PersonRecord
}

const BRAD = personRecord({
  personId: 'p-brad',
  firstName: 'Brad',
  lastName: 'Stephens',
  ecclesia: 'Toronto East Ecclesia',
  primaryEmail: 'brad@example.com',
})

function memorialSchedule(exhort: string) {
  return {
    content: [
      {
        Date: 'Feb 1, 2026',
        DateTime: '2026-02-01T16:00:00.000Z',
        ServiceTimezone: 'America/Toronto',
        Exhort: exhort,
        Preside: 'Someone Else',
        Key: 'memorial',
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getScheduleData.mockResolvedValue(memorialSchedule('Brad Stephens'))
  h.listAll.mockResolvedValue({ items: [BRAD], lastEvaluatedKey: undefined })
  h.getById.mockResolvedValue(BRAD)
  h.renderExhorterHeadsUp.mockResolvedValue({ html: '<html></html>', text: 'text' })
  h.sendEmail.mockResolvedValue(undefined)
  h.claim.mockResolvedValue(true)
  h.generateEmailPreferencesUrl.mockResolvedValue('https://tee-admin.com/email-preferences?token=x')
  h.fetchServiceOverrides.mockResolvedValue(new Map())
})

describe('resolveAndSendExhorterHeadsUp — matched', () => {
  it('LIVE sends to the real exhorter primaryEmail', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('sent')
    expect(report.sentTo).toBe('brad@example.com')
    expect(report.personId).toBe('p-brad')
    expect(report.visiting).toBe(false)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const arg = h.sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('brad@example.com')
    expect(arg.from).toContain('communications@tee-admin.com')
    expect(arg.replyTo).toBe('teerecbro@gmail.com')
  })

  it('TEST sends to the requester, NEVER the exhorter; no idempotency write', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('sent')
    expect(report.sentTo).toBe(REQUESTER)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail.mock.calls[0][0].to).toBe(REQUESTER)
    expect(h.sendEmail.mock.calls[0][0].to).not.toBe('brad@example.com')
    expect(h.claim).not.toHaveBeenCalled()
  })

  it('defaults to TEST mode when test is omitted', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      requesterEmail: REQUESTER,
    })
    expect(report.test).toBe(true)
    expect(report.sentTo).toBe(REQUESTER)
    expect(h.claim).not.toHaveBeenCalled()
  })
})

describe('resolveAndSendExhorterHeadsUp — guards (no send)', () => {
  it('placeholder Exhort → skipped:placeholder', async () => {
    h.getScheduleData.mockResolvedValue(memorialSchedule('TBD'))
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('skipped:placeholder')
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('unresolved name → unresolved (reported, not sent)', async () => {
    h.getScheduleData.mockResolvedValue(memorialSchedule('Zxqwv Nomatch'))
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('unresolved')
    expect(report.matchStatus).toBe('not-found')
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('matched but empty primaryEmail → skipped:no-email', async () => {
    h.getById.mockResolvedValue(
      personRecord({
        personId: 'p-brad',
        firstName: 'Brad',
        lastName: 'Stephens',
        ecclesia: 'Toronto East Ecclesia',
        primaryEmail: '',
      })
    )
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('skipped:no-email')
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('no schedule row for the date → no-schedule-row', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: '2026-03-15',
      test: false,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('no-schedule-row')
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})

describe('resolveAndSendExhorterHeadsUp — visiting flag', () => {
  it('non-home ecclesia member → visiting true', async () => {
    h.getById.mockResolvedValue(
      personRecord({
        personId: 'p-brad',
        firstName: 'Brad',
        lastName: 'Stephens',
        ecclesia: 'Hamilton Book Road',
        primaryEmail: 'brad@example.com',
      })
    )
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.visiting).toBe(true)
  })

  it('memberStatus visitor → visiting true', async () => {
    h.getById.mockResolvedValue(
      personRecord({
        personId: 'p-brad',
        firstName: 'Brad',
        lastName: 'Stephens',
        ecclesia: 'Toronto East Ecclesia',
        primaryEmail: 'brad@example.com',
        memberStatus: 'visitor' as PersonRecord['memberStatus'],
      })
    )
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.visiting).toBe(true)
  })

  it('home-ecclesia member → visiting false', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.visiting).toBe(false)
  })
})

describe('resolveAndSendExhorterHeadsUp — zoom source', () => {
  it('uses the default Zoom when no override', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.zoomSource).toBe('default')
    const attend = h.renderExhorterHeadsUp.mock.calls[0][0].attendOptions
    expect(attend[0].label).toBe('Toronto East Zoom')
  })

  it('uses override attendOptions when present', async () => {
    h.fetchServiceOverrides.mockResolvedValue(
      new Map([
        [
          'memorial#2026-02-01',
          {
            serviceType: 'memorial',
            date: '2026-02-01',
            attendOptions: [{ id: 'a1', label: 'Toronto West Stream', mode: 'stream', url: 'https://tw' }],
          },
        ],
      ])
    )
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: true,
      requesterEmail: REQUESTER,
    })
    expect(report.zoomSource).toBe('override')
    const attend = h.renderExhorterHeadsUp.mock.calls[0][0].attendOptions
    expect(attend[0].label).toBe('Toronto West Stream')
  })
})

describe('resolveAndSendExhorterHeadsUp — idempotency (LIVE only)', () => {
  it('second live call is skipped:already-sent when claim fails', async () => {
    h.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const first = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })
    const second = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      requesterEmail: REQUESTER,
    })

    expect(first.status).toBe('sent')
    expect(second.status).toBe('skipped:already-sent')
    expect(h.sendEmail).toHaveBeenCalledTimes(1) // second never sent
  })

  it('releases the claim when the send throws (live)', async () => {
    h.sendEmail.mockRejectedValueOnce(new Error('SES down'))
    await expect(
      resolveAndSendExhorterHeadsUp({ date: TARGET_DATE, test: false, requesterEmail: REQUESTER })
    ).rejects.toThrow('SES down')
    expect(h.release).toHaveBeenCalledWith('2026-02-01', 'p-brad')
  })
})

describe('resolveAndSendExhorterHeadsUp — dryRun', () => {
  it('resolves + reports without sending or claiming', async () => {
    const report = await resolveAndSendExhorterHeadsUp({
      date: TARGET_DATE,
      test: false,
      dryRun: true,
      requesterEmail: REQUESTER,
    })
    expect(report.status).toBe('dry-run')
    expect(report.personId).toBe('p-brad')
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.claim).not.toHaveBeenCalled()
  })
})
