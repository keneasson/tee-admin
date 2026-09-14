import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * QA BY REDIRECT.
 *
 * The email the brother would receive is sent to the Recording Brother instead,
 * so it can be checked in a real inbox. Reviewing an email inside a web page is
 * a simulation — an iframe says nothing about how Gmail or Outlook will treat
 * the tables, the images or the preview line.
 *
 * The ONLY differences from the live article are the `To:` header and one
 * appended footer block. Going live is then literally "change the To: and drop
 * the block", which is what makes this a test of the real thing rather than a
 * rehearsal of something else. These tests hold that property.
 */

const h = vi.hoisted(() => ({
  resolveAndSend: vi.fn(),
  sendEmail: vi.fn(),
  parkPending: vi.fn(),
  supersedePending: vi.fn(),
  wasSent: vi.fn(),
  getById: vi.fn(),
  getEcclesiaByName: vi.fn(),
}))

vi.mock('@/utils/email/exhorter-heads-up', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/email/exhorter-heads-up')>()
  return { ...actual, resolveAndSendExhorterHeadsUp: h.resolveAndSend }
})
vi.mock('../utils/email/sesClient', () => ({ sendEmail: h.sendEmail }))
vi.mock('@my/app/provider/dynamodb/repositories/exhorter-headsup-repository', () => ({
  exhorterHeadsUpRepository: {
    parkPending: h.parkPending,
    supersedePending: h.supersedePending,
    wasSent: h.wasSent,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: h.getById },
}))
vi.mock('../utils/dynamodb/locations', () => ({ getEcclesiaByName: h.getEcclesiaByName }))

import { prepareHeadsUpForReview } from '../utils/email/exhorter-heads-up-review'

const REAL_SUBJECT = 'Your exhortation at Toronto East on Sunday, September 20, 2026'
const REAL_HTML = '<html><body><p>Dear Brother Brad Stephens,</p></body></html>'
const REAL_TEXT = 'Dear Brother Brad Stephens,'

beforeEach(() => {
  vi.clearAllMocks()
  h.resolveAndSend.mockResolvedValue({
    date: '2026-09-20',
    test: false,
    status: 'dry-run',
    personId: 'p-brad',
    exhortName: 'Brad Stephens',
    rendered: {
      subject: REAL_SUBJECT,
      html: REAL_HTML,
      text: REAL_TEXT,
      contentDigest: 'abc123def456abc123def456abc12345',
    },
  })
  h.getById.mockResolvedValue({
    personId: 'p-brad',
    primaryEmail: 'brad@example.com',
    displayName: 'Brad Stephens',
  })
  h.getEcclesiaByName.mockResolvedValue({ recordingBrotherEmail: 'rb@tee-admin.com' })
  h.parkPending.mockResolvedValue(undefined)
  h.supersedePending.mockResolvedValue(0)
  h.wasSent.mockResolvedValue(false)
  h.sendEmail.mockResolvedValue(undefined)
})

describe('the QA copy is the real email, redirected', () => {
  it('goes to the reviewer, never to the exhorter', async () => {
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(result.parked).toBe(true)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const sent = h.sendEmail.mock.calls[0][0]
    expect(sent.to).toBe('rb@tee-admin.com')
    expect(sent.to).not.toBe('brad@example.com')
  })

  it('carries the REAL subject, so the inbox rendering is the real one', async () => {
    // Not "Review: …". Truncation, preview text and threading all depend on
    // the subject, so a different one would be QA of a different email.
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(h.sendEmail.mock.calls[0][0].subject).toBe(REAL_SUBJECT)
  })

  it('renders live, not in test mode — no [TEST] prefix, the real content', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const args = h.resolveAndSend.mock.calls[0][0]
    expect(args.renderOnly).toBe(true)
    expect(args.test).toBe(false)
  })

  it('contains the exhorter\'s email verbatim, and adds only the footer block', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const sent = h.sendEmail.mock.calls[0][0]

    // Everything the brother would read is present, unaltered.
    expect(sent.body).toContain('Dear Brother Brad Stephens,')
    expect(sent.textBody).toContain(REAL_TEXT)

    // Plus one clearly-marked addition, and the link through to the decision.
    expect(sent.body).toContain('REVIEW COPY')
    expect(sent.body).toMatch(/Continue — Brad Stephens/)
    // A stable, findable page — the token only says WHICH copy.
    expect(sent.body).toMatch(/\/admin\/exhorter-heads-up\?token=/)

    // Spliced INSIDE </body> — content after it is dropped by some clients.
    expect(sent.body.indexOf('REVIEW COPY')).toBeLessThan(sent.body.lastIndexOf('</body>'))
  })

  it('says plainly that nothing has gone to the brother yet', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const sent = h.sendEmail.mock.calls[0][0]
    expect(sent.body).toContain('not sent to him')
    expect(sent.textBody).toContain('not sent to him')
    // And that the link itself is safe to open.
    expect(sent.textBody).toMatch(/nothing is sent until you press/i)
  })

  it('does not promise to SEND from a link that only opens a page', async () => {
    // The button used to read "Send this to Brad Stephens" directly above a
    // line saying it sends nothing — the label contradicted the fine print,
    // and the page it opens offers a Stop as well as a Send.
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const sent = h.sendEmail.mock.calls[0][0]
    for (const body of [sent.body, sent.textBody]) {
      expect(body).not.toContain('Send this to')
      expect(body).not.toMatch(/If it is right, send it/i)
    }
    // It says what actually happens, and that stopping is an option.
    expect(sent.body).toMatch(/or to stop it, if something needs fixing/i)
    expect(sent.textBody).toMatch(/or to stop it, if something needs fixing/i)
  })

  it('is tracked too, so a QA copy that never arrives is visible', async () => {
    // The QA is worthless if the test email silently vanishes.
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(h.sendEmail.mock.calls[0][0].configurationSetName).toBe('tee-email-tracking')
  })
})

describe('what is parked is what was read', () => {
  it('pins the digest of the email that was redirected', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const parked = h.parkPending.mock.calls[0][0]
    expect(parked.contentDigest).toBe('abc123def456abc123def456abc12345')
    expect(parked.recipientEmail).toBe('brad@example.com')
    expect(parked.previewedBy).toBe('rb@tee-admin.com')
    expect(parked.personId).toBe('p-brad')
    expect(parked.token).toMatch(/^[A-Za-z0-9_-]{20,}$/)
  })
})

describe('when there is nothing to send', () => {
  it('parks nothing and reports the reason', async () => {
    h.resolveAndSend.mockResolvedValue({
      date: '2026-09-20',
      test: false,
      status: 'unresolved',
      exhortName: 'Zxqwv Nomatch',
      matchStatus: 'not-found',
    })
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(result.parked).toBe(false)
    expect(result.report.status).toBe('unresolved')
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.parkPending).not.toHaveBeenCalled()
  })

  it('refuses when there is no reviewer address to redirect to', async () => {
    h.getEcclesiaByName.mockResolvedValue({})
    delete process.env.EXHORTER_HEADSUP_REVIEWER
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(result.parked).toBe(false)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(result.report.note).toMatch(/no reviewer address/i)
  })
})

/**
 * RE-TESTING AFTER A FIX.
 *
 * The point of QA is that you find something wrong. So: correct the Program,
 * resend, and read it again. The link in the WRONG email must stop working —
 * otherwise it sits in the inbox as a live way to send the mistake.
 */
describe('resending after correcting the Program', () => {
  it('retires the earlier unsent copy before parking the new one', async () => {
    h.supersedePending.mockResolvedValue(1)
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })

    expect(h.supersedePending).toHaveBeenCalledWith('2026-09-20', 'p-brad')
    expect(result.supersededCopies).toBe(1)

    // Order matters: retire the old link, THEN mint the new one.
    expect(h.supersedePending.mock.invocationCallOrder[0]).toBeLessThan(
      h.parkPending.mock.invocationCallOrder[0]
    )
  })

  it('mints a NEW token rather than reusing the old link', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const first = h.parkPending.mock.calls[0][0].token
    vi.clearAllMocks()
    h.supersedePending.mockResolvedValue(1)
    h.parkPending.mockResolvedValue(undefined)
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(h.parkPending.mock.calls[0][0].token).not.toBe(first)
  })
})

/**
 * TWO QA copies can sit in the inbox at once — one per upcoming exhortation.
 * A bare "Continue" on both gives the reader no way to tell which is which.
 * The links were never ambiguous to the server; they were ambiguous to the
 * person about to email a real brother, which is the half that matters.
 */
describe('which copy am I looking at?', () => {
  it('names the recipient and the Sunday on the button itself', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const sent = h.sendEmail.mock.calls[0][0]
    expect(sent.body).toMatch(/Continue — Brad Stephens, .*Sep 20/)
    expect(sent.textBody).toMatch(/\(Brad Stephens, .*Sep 20\)/)
  })

  it('says who and when at the top of the block too', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const sent = h.sendEmail.mock.calls[0][0]
    expect(sent.body).toMatch(/REVIEW COPY — for Brad Stephens, .*Sep 20/)
    expect(sent.textBody).toMatch(/REVIEW COPY — for Brad Stephens, .*Sep 20/)
  })

  it('distinguishes two copies for different Sundays', async () => {
    await prepareHeadsUpForReview({ date: '2026-09-20' })
    const first = h.sendEmail.mock.calls[0][0].body
    vi.clearAllMocks()
    h.supersedePending.mockResolvedValue(0)
    h.parkPending.mockResolvedValue(undefined)
    h.sendEmail.mockResolvedValue(undefined)
    h.resolveAndSend.mockResolvedValue({
      date: '2026-09-27',
      test: false,
      status: 'dry-run',
      personId: 'p-tom',
      exhortName: 'Tom Briggs',
      rendered: { subject: 's', html: '<html><body>x</body></html>', text: 'x', contentDigest: 'd' },
    })
    h.getById.mockResolvedValue({
      personId: 'p-tom',
      primaryEmail: 'briggstom64@example.com',
      displayName: 'Tom Briggs',
    })
    await prepareHeadsUpForReview({ date: '2026-09-27' })
    const second = h.sendEmail.mock.calls[0][0].body

    expect(first).toMatch(/Continue — Brad Stephens/)
    expect(second).toMatch(/Continue — Tom Briggs/)
    expect(first).not.toMatch(/Tom Briggs/)
    expect(second).not.toMatch(/Brad Stephens/)
  })
})

/**
 * Once the brother has been told, the Sunday is settled. The Saturday job
 * still runs — it does not know what a human did days earlier — so without a
 * check it would redirect a QA copy for a closed matter, and the reader would
 * press Continue only to be told it had already gone.
 *
 * The brother was never at risk: the send claim stops a second email. What was
 * at risk was the reviewer's time, and their confidence in what the inbox copy
 * means.
 */
describe('a Sunday already sent needs no review', () => {
  it('sends no QA copy and parks nothing', async () => {
    h.wasSent.mockResolvedValue(true)
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })

    expect(result.parked).toBe(false)
    expect(result.report.status).toBe('skipped:already-sent')
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.parkPending).not.toHaveBeenCalled()
    // And it must not retire anything either — the record of what went out
    // stays exactly as it is.
    expect(h.supersedePending).not.toHaveBeenCalled()
  })

  it('still sends one when the brother has NOT been told', async () => {
    h.wasSent.mockResolvedValue(false)
    const result = await prepareHeadsUpForReview({ date: '2026-09-20' })
    expect(result.parked).toBe(true)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })
})
