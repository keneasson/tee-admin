import { describe, it, expect, vi } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import SpeakerSwapOutcome from '../../email-builder/emails/SpeakerSwapOutcome'

vi.mock('../utils/email/resolve-brand-profile', () => ({
  resolveBrandProfile: vi.fn(async () => ({
    ecclesiaName: 'Example Ecclesia',
    displayName: 'Example Ecclesia',
    publicName: 'Example Ecclesia Christadelphians',
    addressLines: ['123 Example Street'],
  })),
}))

import { renderSpeakerSwapOutcome } from '../utils/email/speaker-invite-render'

const visible = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'")

describe('SpeakerSwapOutcome (declined / expired swap request, §7.5)', () => {
  it('declined: says who could not trade, that nothing changed, and links to manage', async () => {
    const html = await render(<SpeakerSwapOutcome {...SpeakerSwapOutcome.PreviewProps} />)
    const text = visible(html)
    // §9b: recorded title + surname (the preview carries greetingTitle 'Brother').
    expect(text).toContain('Dear Brother Speaker,')
    expect(text).toContain('Other is not able to trade Sunday, March 8, 2026 at 11:00am with you.')
    expect(text).toContain('Nothing has changed: you are still booked for Sunday, March 1, 2026 at 11:00am.')
    expect(html).toContain('https://tee-admin.com/invite/example')
  })

  it('expired: lapsed wording; no manage button without a link', async () => {
    const { manageUrl: _m, ...rest } = SpeakerSwapOutcome.PreviewProps
    const html = await render(<SpeakerSwapOutcome {...rest} outcome="expired" />)
    const text = visible(html)
    expect(text).toContain('did not answer your request to trade for Sunday, March 8, 2026 at 11:00am in time')
    expect(text).not.toContain('Manage your appointment')
  })

  it('render helper returns html, text and the subject', async () => {
    const out = await renderSpeakerSwapOutcome({ ...SpeakerSwapOutcome.PreviewProps, outcome: 'expired' })
    expect(out.subject).toBe('Your Memorial exhortation swap request expired')
    expect(out.text).toContain('Nothing has changed')
    expect(out.html).toContain('<html')
  })
})
