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
    // A VISITING brother gets the full picture, address included.
    const html = await renderHtml({ ...baseProps, visiting: true })
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
    const html = await renderHtml({ ...baseProps, visiting: true, attendOptions: [] })
    expect(html).not.toContain('Toronto East Zoom')
    expect(html).not.toContain("If you can't be with us in person")
    // in-person address still shown — the visitor still has to find the hall
    expect(html).toContain('975 Cosburn Ave.')
  })

  describe('"Ways to attend" only says what the reader needs', () => {
    it('does not tell a home member where his own hall is', async () => {
      const html = await renderHtml(baseProps)
      expect(html).not.toContain('975 Cosburn Ave.')
      expect(html).not.toContain('In person')
      // Online options still go to everybody — a member may need to join remotely.
      expect(html).toContain('Toronto East Zoom')
    })

    it('drops the whole block when there is nothing to put in it', async () => {
      // Home member, no digital option: a heading over an empty section.
      const html = await renderHtml({ ...baseProps, attendOptions: [] })
      expect(html).not.toContain('Ways to attend')
    })

    it('keeps the block for a visitor even with no online option', async () => {
      const html = await renderHtml({ ...baseProps, visiting: true, attendOptions: [] })
      expect(html).toContain('Ways to attend')
    })
  })

  describe('coffee before the exhortation', () => {
    const withSS = { sundaySchool: { startDisplay: '9:30am', endDisplay: '10:30' } }

    it('tells a visitor they can come early for coffee', async () => {
      // Somebody travelling in appreciates knowing there is half an hour of
      // refreshments before the service, so arriving early is welcome.
      const html = await renderHtml({ ...baseProps, ...withSS, visiting: true })
      expect(html).toContain('welcome to come early and join us for coffee and snacks')
    })

    it('says nothing about coffee when there is no Sunday School', async () => {
      // No classes means no refreshments — the invitation would be wrong.
      const html = await renderHtml({ ...baseProps, visiting: true })
      expect(html).not.toContain('come early')
    })

    it('does not offer it to a home member, who knows', async () => {
      const html = await renderHtml({ ...baseProps, ...withSS })
      expect(html).not.toContain('come early')
      // The Sunday School times themselves are still there for the order of day.
      expect(html).toContain('Our Sunday school')
    })
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

/**
 * Footer and spacing details found by reading a real QA copy in Gmail — the
 * kind of thing an iframe preview would never have surfaced.
 */
describe('the footer reads properly', () => {
  it('says "a Christadelphian Initiative", not "and"', async () => {
    const html = await renderHtml(baseProps)
    expect(html).toContain('a Christadelphian Initiative')
    expect(html).not.toContain('and Christadelphian Initiative')
  })

  it('gives the signature room before the dark footer band', async () => {
    // "Love in Jesus name / Ken Easson" ended flush against the footer. A
    // signed-off letter needs a beat before the small print.
    const html = await renderHtml(baseProps)
    const sig = html.lastIndexOf('Ken Easson')
    const footer = html.indexOf('background:#011759', sig)
    expect(footer).toBeGreaterThan(-1)
    expect(html.slice(sig, footer)).toContain('height:24px')
  })

  it('uses a link colour that is legible on the dark navy footer', async () => {
    // #b9cfdd read as a muted mid-blue against #011759. This is a contrast
    // floor, not a taste preference: the check is arithmetic.
    const html = await renderHtml(baseProps)
    expect(html).toContain('#c7e4ff')

    const lum = (hex: string) => {
      const h = hex.replace('#', '')
      const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      const [r, g, b] = ch.map(f) as [number, number, number]
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    expect(ratio('#c7e4ff', '#011759')).toBeGreaterThan(10)
  })
})

describe('Sunday School times come from configuration', () => {
  it('renders the 9:30 line the schedule now provides', async () => {
    // The catalogue had a BLANK sundaySchool time, and a blank time is
    // indistinguishable from "no Sunday School" — so the line was silently
    // omitted from every email, and a visiting speaker was never told the
    // classes were on.
    const html = await renderHtml({
      ...baseProps,
      sundaySchool: { startDisplay: '9:30am', endDisplay: '10:30' },
    })
    expect(html).toContain(
      'Our Sunday school (kids and teens classes) is from 9:30am to 10:30 followed by coffee and snacks.'
    )
  })
})
