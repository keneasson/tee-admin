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

  it('welcomes a VISITING brother to the host ecclesia', async () => {
    const html = await renderHtml({ ...baseProps, visiting: true })
    expect(html).toContain('We are looking forward to having you join us and hearing you Exhort at')
    expect(html).toContain('Toronto East')
    // The earlier draft opened "Just confirming our arrangements…"; "just"
    // in particular was to go.
    expect(html).not.toContain('Just confirming')
    expect(html).not.toContain('your exhortation at')
  })

  it('does not tell one of its OWN members he is joining us at his own meeting', async () => {
    // Brad is Toronto East. "having you join us … at Toronto East" reads wrong
    // for a brother of the host ecclesia; he is simply exhorting.
    const html = await renderHtml(baseProps)
    expect(html).toContain('We are looking forward to hearing you Exhort on')
    expect(html).not.toContain('having you join us')
    expect(html).not.toContain('hearing you Exhort at')
  })

  it('signs off "Love in Jesus name" over the Recording Brother\'s name alone', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('Looking forward to seeing you again.')
    expect(html).toContain('Love in Jesus name')
    expect(html).toContain('Ken Easson')
    // It is a note from a brother, not a memo from an office.
    expect(html).not.toContain('With love in the LORD')
    expect(html).not.toContain('Ecclesial Recorder')
  })

  it('mentions Sunday School only when it actually runs that week', async () => {
    // Classes do not run every week. Telling a visiting speaker to arrive for a
    // class that is not on is worse than saying nothing, so the line is driven
    // by the sundaySchool schedule rather than assumed.
    const without = await renderHtml(baseProps)
    expect(without).not.toContain('Sunday school')

    const withSS = await renderHtml({
      ...baseProps,
      sundaySchool: { startDisplay: '9:30am', endDisplay: '10:30' },
    })
    expect(withSS).toContain(
      'Our Sunday school (kids and teens classes) is from 9:30am to 10:30 followed by coffee and snacks.'
    )
  })

  it('renders an occasion note when there is one, and nothing when there is not', async () => {
    const without = await renderHtml(baseProps)
    expect(without).not.toContain('opening for Sunday School')

    const withNote = await renderHtml({
      ...baseProps,
      note: 'That Sunday is also our opening for Sunday School.',
    })
    expect(withNote).toContain('That Sunday is also our opening for Sunday School.')

    // Whitespace is not a note.
    const blank = await renderHtml({ ...baseProps, note: '   ' })
    expect(blank).toBe(without)
  })

  it('invites the exhorter to lunch only when a lunch is scheduled', async () => {
    const without = await renderHtml(baseProps)
    expect(without).not.toContain('invited to stay')

    const withLunch = await renderHtml({ ...baseProps, lunchType: 'potluck' })
    expect(withLunch).toContain('invited to stay for a potluck fellowship lunch')
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
