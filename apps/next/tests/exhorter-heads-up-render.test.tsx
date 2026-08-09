import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import ExhorterHeadsUp, {
  type ExhorterHeadsUpProps,
} from '../../email-builder/emails/ExhorterHeadsUp'

/**
 * Server-side render check for the ExhorterHeadsUp template (#124, slice A).
 * Renders with a fixture and asserts it does not throw and the key strings
 * (greeting / short host name / date / time / address / zoom / conditional
 * lunch / RB signature / footer) appear.
 */

const baseProps: ExhorterHeadsUpProps = {
  exhorterName: 'Brad Stephens',
  hostEcclesiaName: 'Toronto East',
  address: '975 Cosburn Ave., East York, ON M4C 2W8, Canada',
  dateDisplay: 'Sunday, February 1, 2026',
  timeDisplay: '11:00am',
  attendOptions: [
    {
      label: 'Toronto East Zoom',
      url: 'https://us04web.zoom.us/j/586952386',
      meetingId: '586 952 386',
      password: '036110',
      dialInNumber: '+1 647 374 4685',
    },
  ],
  signatoryName: 'Ken Easson',
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
  it('renders formal greeting, short host name, date, time, address, zoom', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('Dear Brother Brad Stephens,')
    expect(html).toContain('Toronto East')
    expect(html).not.toContain('Christadelphians on') // short name in the body sentence
    expect(html).toContain('Sunday, February 1, 2026')
    expect(html).toContain('11:00am')
    expect(html).toContain('In person')
    expect(html).toContain('975 Cosburn Ave.')
    expect(html).toContain('Toronto East Zoom')
    expect(html).toContain('586 952 386')
  })

  it('signs off with the Recording Brother and "Ecclesial Recorder"', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('With love in the LORD')
    expect(html).toContain('Brother Ken Easson')
    expect(html).toContain('Ecclesial Recorder')
  })

  it('omits the digital block when there are no attend options', async () => {
    const html = await renderHtml({ ...baseProps, attendOptions: [] })
    expect(html).not.toContain('Toronto East Zoom')
    expect(html).not.toContain("If you can't be with us in person")
    // in-person address still shown
    expect(html).toContain('975 Cosburn Ave.')
  })

  it('includes the follow-up "what to expect" (theme/readings/hymns) line', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('theme')
    expect(html).toContain('readings')
    expect(html).toContain('hymn')
  })

  it('renders the lunch line per lunchType, and omits it when undefined', async () => {
    const potluck = await renderHtml({ ...baseProps, lunchType: 'potluck' })
    expect(potluck).toContain('potluck fellowship lunch')

    const provided = await renderHtml({ ...baseProps, lunchType: 'provided' })
    expect(provided).toContain('lunch will be provided')

    const none = await renderHtml({ ...baseProps, lunchType: undefined })
    expect(none).not.toContain('fellowship lunch')
    expect(none).not.toContain('lunch will be provided')
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
