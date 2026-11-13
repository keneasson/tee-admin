import { describe, it, expect, vi } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import SpeakerInvitation from '../../email-builder/emails/SpeakerInvitation'
import SpeakerConfirmation, {
  SpeakerConfirmationPreviewVariants,
  type SpeakerConfirmationProps,
} from '../../email-builder/emails/SpeakerConfirmation'
import SpeakerSwapRequest from '../../email-builder/emails/SpeakerSwapRequest'
import SpeakerInviterNotice from '../../email-builder/emails/SpeakerInviterNotice'
import { greetingFor } from '../../email-builder/components/SpeakerInviteParts'

vi.mock('../utils/email/resolve-brand-profile', () => ({
  resolveBrandProfile: vi.fn(async () => ({
    ecclesiaName: 'Example Ecclesia',
    displayName: 'Example Ecclesia',
    publicName: 'Example Ecclesia Christadelphians',
    addressLines: ['123 Example Street'],
  })),
}))

import {
  renderSpeakerConfirmation,
  renderSpeakerInvitation,
  renderSpeakerInviterNotice,
  renderSpeakerSwapRequest,
} from '../utils/email/speaker-invite-render'

/** Text of the rendered HTML with tags stripped and entities for ' decoded. */
const visible = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'")

describe('§9b greeting follows the recorded gender, never a guess', () => {
  it('Brother / Sister + surname when recorded; first name when not', () => {
    expect(greetingFor('Sample Speaker', 'Brother')).toBe('Dear Brother Speaker,')
    expect(greetingFor('Sample Speaker', 'Sister')).toBe('Dear Sister Speaker,')
    expect(greetingFor('Sample Speaker')).toBe('Dear Sample,')
    expect(greetingFor('Sample')).toBe('Dear Sample,')
    expect(greetingFor('', 'Brother')).toBe('Dear Brother,')
    expect(greetingFor('')).toBe('Hello,')
  })

  it('an invitation to someone with no recorded gender greets them by first name', async () => {
    const { greetingTitle: _t, ...props } = SpeakerInvitation.PreviewProps
    const text = visible(await render(<SpeakerInvitation {...props} />))
    expect(text).toContain('Dear Sample,')
    expect(text).not.toContain('Dear Brother')
  })
})

describe('Speaker Invitation templates render', () => {
  it('invitation: subject phrase, up to 3 date links, note, other dates, sign-off', async () => {
    const props = SpeakerInvitation.PreviewProps
    const html = await render(
      <SpeakerInvitation
        {...props}
        dateOptions={[
          ...props.dateOptions,
          { label: 'Fourth date', url: 'https://tee-admin.com/invite/example?date=2026-03-22' },
        ]}
      />
    )
    const text = visible(html)
    expect(text).toContain('An invitation to exhort at our Memorial Service')
    // The header sits under the ecclesia name, so it doesn't repeat it.
    expect(html).toMatch(/>An invitation to exhort at our Memorial Service<\//)
    // §9b: the recorded title + surname (the preview carries greetingTitle 'Brother').
    expect(text).toContain('Dear Brother Speaker,')
    expect(html).toContain('date=2026-03-01')
    expect(html).toContain('date=2026-03-15')
    expect(html).not.toContain('Fourth date')
    expect(text).toContain('View more dates at')
    expect(text).toContain('It has been too long')
    expect(text).toContain('Love in Jesus name')
    expect(text).toContain('Brother Sample Inviter')
  })

  it('invitation: no note and no other-dates link when absent', async () => {
    const { note: _n, otherDatesUrl: _o, ...rest } = SpeakerInvitation.PreviewProps
    const text = visible(await render(<SpeakerInvitation {...rest} inviteType="lecture" />))
    expect(text).toContain('speak at a Public Lecture')
    expect(text).not.toContain('View other open dates')
    expect(text).not.toContain('It has been too long')
  })

  it('confirmation: details, calendar links and the change line', async () => {
    const html = await render(<SpeakerConfirmation {...SpeakerConfirmationPreviewVariants.confirmed} />)
    const text = visible(html)
    expect(text).toContain('Sunday, March 1, 2026')
    expect(text).toContain('11:00am Eastern Time (Toronto)')
    expect(text).toContain('Example Christadelphian Hall, 123 Example Street')
    expect(text).toContain('Example Zoom')
    expect(text).toContain('Add to Google Calendar')
    expect(text).toContain('Download calendar file (.ics)')
    expect(text).toContain('If for any reason you need to change your appointment, click here')
    expect(text).not.toContain('Please inform')
  })

  it('confirmation (changed): short-notice callout with a name', async () => {
    const text = visible(
      await render(<SpeakerConfirmation {...SpeakerConfirmationPreviewVariants.changedShortNotice} />)
    )
    expect(text).toContain('has moved from Sunday, March 8, 2026')
    expect(text).toContain('Please inform the Presiding brother (Presiding Example) of this change')
  })

  it('confirmation (changed): short-notice callout without a name, and the Host wording', async () => {
    const changed: SpeakerConfirmationProps = SpeakerConfirmationPreviewVariants.changedShortNotice
    const noName = visible(
      await render(<SpeakerConfirmation {...changed} shortNotice={{ counterpartRole: 'Exhorting' }} />)
    )
    expect(noName).toContain('Please inform the Exhorting brother of this change')
    expect(noName).not.toContain('brother (')
    const host = visible(
      await render(
        <SpeakerConfirmation
          {...changed}
          inviteType="bible_class"
          shortNotice={{ counterpartRole: 'Host', counterpartName: 'Host Example' }}
        />
      )
    )
    expect(host).toContain('Please inform the host (Host Example) of this change')
  })

  it('confirmation (cancelled): no Google button, cancellation .ics, no change line', async () => {
    const text = visible(await render(<SpeakerConfirmation {...SpeakerConfirmationPreviewVariants.cancelled} />))
    expect(text).toContain('has been cancelled')
    expect(text).not.toContain('Add to Google Calendar')
    expect(text).toContain('Download the cancellation (.ics)')
    expect(text).not.toContain('need to change your appointment')
  })

  it('swap request: headline and Accept/Decline links to the page', async () => {
    const html = await render(<SpeakerSwapRequest {...SpeakerSwapRequest.PreviewProps} />)
    const text = visible(html)
    expect(text).toContain('Other Speaker asks to trade Sunday, March 1, 2026 for your Sunday, March 8, 2026')
    expect(html).toContain('action=accept')
    expect(html).toContain('action=decline')
    expect(text).toContain('Accept the trade')
    expect(text).toContain('Decline')
  })

  it('inviter notice: changed / accepted / cancelled wording and the Sheet reminder', async () => {
    const props = SpeakerInviterNotice.PreviewProps
    const changed = visible(await render(<SpeakerInviterNotice {...props} />))
    expect(changed).toContain('moved the Bible Class from Wednesday, March 4, 2026 to Wednesday, March 11, 2026 at 7:30pm')
    expect(changed).toContain('Google Sheet')
    const accepted = visible(await render(<SpeakerInviterNotice {...props} kind="accepted" />))
    expect(accepted).toContain('accepted your invitation')
    const cancelled = visible(await render(<SpeakerInviterNotice {...props} kind="cancelled" />))
    expect(cancelled).toContain('That date is open again')
  })
})

describe('speaker-invite-render helpers', () => {
  it('return html, text and subject with the tenant identity injected', async () => {
    const { identity: _i, ...props } = SpeakerInvitation.PreviewProps
    const out = await renderSpeakerInvitation(props)
    expect(out.subject).toBe('An invitation to exhort at our Memorial Service at Example Ecclesia')
    expect(out.html).toContain('Example Ecclesia Christadelphians')
    expect(out.text).toContain('Love in Jesus name')
  })

  it('confirmation subjects follow the variant; shortNotice reaches the html', async () => {
    const { identity: _i, ...props } = SpeakerConfirmationPreviewVariants.changedShortNotice
    const out = await renderSpeakerConfirmation(props)
    expect(out.subject).toBe('Updated: Memorial exhortation at Example Ecclesia on Sunday, March 1, 2026')
    expect(out.text).toContain('Please inform the Presiding brother (Presiding Example) of this change')
    const cancelled = await renderSpeakerConfirmation({ ...props, variant: 'cancelled', shortNotice: undefined })
    expect(cancelled.subject).toMatch(/^Cancelled: /)
  })

  it('swap request and inviter notice subjects', async () => {
    const { identity: _a, ...swap } = SpeakerSwapRequest.PreviewProps
    expect((await renderSpeakerSwapRequest(swap)).subject).toBe(
      'Other Speaker asks to trade Memorial exhortation dates with you'
    )
    const { identity: _b, ...notice } = SpeakerInviterNotice.PreviewProps
    expect((await renderSpeakerInviterNotice(notice)).subject).toBe(
      'Sample Speaker changed date: Bible Class now on Wednesday, March 11, 2026'
    )
  })
})

describe('SpeakerInvitation opening lines', () => {
  const base = SpeakerInvitation.PreviewProps
  it.each([
    ['memorial', 'exhort at our Memorial Service'],
    ['bible_class', 'speak at our Bible Class'],
    ['lecture', 'speak at a Public Lecture'],
  ] as const)('%s: "We invite you to %s at …"', async (inviteType, verb) => {
    // Plain text wraps at ~80 columns; compare with whitespace collapsed.
    const text = (await render(React.createElement(SpeakerInvitation, { ...base, inviteType }), { plainText: true })).replace(/\s+/g, ' ')
    expect(text).toContain(`Greetings in our Master’s name. We invite you to ${verb} at Example Ecclesia.`)
    expect(text).toContain('Here are a few dates we have coming up:')
  })

  it('no "each button" line; positive other-dates link; reach-out line with the phone', async () => {
    const text = (await render(React.createElement(SpeakerInvitation, base), { plainText: true })).replace(/\s+/g, ' ')
    expect(text).not.toContain('Each button opens')
    expect(text).toContain('Prefer a different date? View more dates at TEE-Admin')
    expect(text).not.toContain('(View more')
    expect(text).toContain('Feel free to reach out: reply to this email or give me a call at 555-0100.')
    expect(text).toContain('Brother Sample Inviter')
    const noPhone = (await render(React.createElement(SpeakerInvitation, { ...base, inviterPhone: undefined }), { plainText: true })).replace(/\s+/g, ' ')
    expect(noPhone).toContain('Feel free to reach out: just reply to this email.')
  })

  it('the personal note sits between the greeting and the dates', async () => {
    const text = (await render(React.createElement(SpeakerInvitation, base), { plainText: true })).replace(/\s+/g, ' ')
    const greet = text.indexOf('We invite you to')
    const note = text.indexOf('It has been too long')
    const dates = text.indexOf('Here are a few dates')
    expect(greet).toBeLessThan(note)
    expect(note).toBeLessThan(dates)
  })

  it('says "a date" when only one is offered', async () => {
    const text = await render(
      React.createElement(SpeakerInvitation, { ...base, dateOptions: base.dateOptions.slice(0, 1) }),
      { plainText: true }
    )
    expect(text).toContain('Here is a date we have coming up:')
  })
})
