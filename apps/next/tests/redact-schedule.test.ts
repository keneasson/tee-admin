import { describe, it, expect } from 'vitest'
import { firstNameOf, ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import { redactScheduleData } from '@my/app/utils/redact-schedule'

const member: Viewer = { assurance: 'authenticated', role: 'member', tenant: 'Toronto East', email: 'm@x.z' }
const recognized: Viewer = { assurance: 'recognized', role: 'member', tenant: 'Toronto East', email: 'r@x.z' }

describe('firstNameOf', () => {
  it('takes the first name, stripping honorifics', () => {
    expect(firstNameOf('Brad Stephens')).toBe('Brad')
    expect(firstNameOf('Ken Easson')).toBe('Ken')
    expect(firstNameOf('Desmond Amos ')).toBe('Desmond')
    expect(firstNameOf('Bro. John Smith')).toBe('John')
    expect(firstNameOf('Sister Jane Doe')).toBe('Jane')
    expect(firstNameOf('Hakime')).toBe('Hakime')
    expect(firstNameOf('')).toBe('')
    expect(firstNameOf(undefined)).toBe('')
  })
})

describe('redactScheduleData — anon (public web)', () => {
  const memorial = {
    tabs: [{ id: 'memorial' }],
    data: {
      memorial: [
        {
          date: '2026-07-26', Preside: 'Brad Stephens', Exhort: 'Desmond Amos', Organist: 'Joan Curry',
          Steward: 'Zaiden Easson', Doorkeeper: 'Ken Easson', Lunch: 'The Smith family',
          Reading1: 'Genesis 1', Reading2: 'Matthew 5', 'Hymn-opening': '158',
        },
      ],
      bibleClass: [
        { Presider: 'Peter Skariah', Speaker: 'Bro. John Vance', Topic: 'Daily readings',
          InPerson: '123 Main St, Toronto', resolvedAddress: '123 Main St', resolvedMapUrl: 'http://maps' },
      ],
    },
  }
  const r = redactScheduleData(memorial, ANONYMOUS_VIEWER) as typeof memorial

  it('reduces role-assignment names to first name', () => {
    const m = r.data.memorial[0] as any
    expect(m.Preside).toBe('Brad')
    expect(m.Exhort).toBe('Desmond')
    expect(m.Organist).toBe('Joan')
    expect(m.Doorkeeper).toBe('Ken')
    const b = r.data.bibleClass[0] as any
    expect(b.Presider).toBe('Peter')
    expect(b.Speaker).toBe('John')
  })

  it('leaves non-name fields (readings, hymns, topic, date) untouched', () => {
    const m = r.data.memorial[0] as any
    expect(m.Reading1).toBe('Genesis 1')
    expect(m.Reading2).toBe('Matthew 5')
    expect(m['Hymn-opening']).toBe('158')
    expect(m.date).toBe('2026-07-26')
    expect((r.data.bibleClass[0] as any).Topic).toBe('Daily readings')
  })

  it('drops precise host address / map url and collapses in-person address to Yes', () => {
    const b = r.data.bibleClass[0] as any
    expect(b.resolvedAddress).toBeUndefined()
    expect(b.resolvedMapUrl).toBeUndefined()
    expect(b.InPerson).toBe('Yes')
  })

  it('does not mutate the input', () => {
    expect((memorial.data.memorial[0] as any).Preside).toBe('Brad Stephens')
  })
})

describe('redactScheduleData — reveal tiers pass through unchanged', () => {
  const data = { data: { memorial: [{ Preside: 'Brad Stephens' }] } }
  it('authenticated member', () => {
    expect(redactScheduleData(data, member)).toBe(data)
  })
  it('recognized via newsletter-email', () => {
    expect(redactScheduleData(data, recognized, 'newsletter-email')).toBe(data)
  })
})
