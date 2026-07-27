import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import ExhorterHeadsUp, {
  type ExhorterHeadsUpProps,
} from '../../email-builder/emails/ExhorterHeadsUp'

/**
 * Server-side render check for the ExhorterHeadsUp template (#124, slice A).
 * Renders with a fixture and asserts it does not throw and the key strings
 * (date / host / time / zoom / conditional lunch / footer) appear.
 */

const baseProps: ExhorterHeadsUpProps = {
  firstName: 'Brad',
  hostEcclesiaName: 'Toronto East Christadelphians',
  dateDisplay: 'Sunday, February 1, 2026',
  timeDisplay: '11:00am',
  visiting: false,
  attendOptions: [
    {
      label: 'Toronto East Zoom',
      url: 'https://us04web.zoom.us/j/586952386',
      meetingId: '586 952 386',
      password: '036110',
      dialInNumber: '+1 647 374 4685',
    },
  ],
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences?token=abc',
  identity: {
    name: 'Toronto East Christadelphians',
    addressLines: ['975 Cosburn Avenue', 'Toronto, On M4C 2W8', 'Canada'],
    homeUrl: 'https://tee-admin.com',
    homeLabel: 'Toronto East Christadelphians',
  },
}

async function renderHtml(props: ExhorterHeadsUpProps): Promise<string> {
  return render(<ExhorterHeadsUp {...props} />)
}

describe('ExhorterHeadsUp template render', () => {
  it('renders without throwing and includes date, host, time, zoom', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('Toronto East Christadelphians')
    expect(html).toContain('Sunday, February 1, 2026')
    expect(html).toContain('11:00am')
    expect(html).toContain('Brad')
    expect(html).toContain('Toronto East Zoom')
    expect(html).toContain('586 952 386')
  })

  it('includes the follow-up "what to expect" (theme/readings/hymns) line', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('theme')
    expect(html).toContain('readings')
    expect(html).toContain('hymn')
  })

  it('shows the lunch line ONLY when visiting', async () => {
    const visitingHtml = await renderHtml({ ...baseProps, visiting: true })
    expect(visitingHtml).toContain('Lunch is provided')

    const memberHtml = await renderHtml({ ...baseProps, visiting: false })
    expect(memberHtml).not.toContain('Lunch is provided')
  })

  it('footer: powered-by Echad Hub link and Email Preferences link', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('powered by')
    expect(html).toContain('Echad Hub')
    expect(html).toContain('https://echadhub.org')
    expect(html).toContain('Email Preferences')
    expect(html).toContain('https://tee-admin.com/email-preferences?token=abc')
  })

  it('does not ship an unsubstituted {{token}} placeholder', async () => {
    const html = await renderHtml(baseProps)
    expect(html).not.toContain('{{')
  })
})
