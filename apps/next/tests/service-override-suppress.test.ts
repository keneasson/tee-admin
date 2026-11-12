import { describe, it, expect } from 'vitest'
import { applyOverrideToProgramItem, sameScheduleName } from '@my/app/utils/service-overrides/merge'
import type { ServiceOccurrenceOverrideRecord } from '@my/app/provider/dynamodb/service-override-types'

/**
 * Conditional blank (speaker invitations): an overlay '' with a
 * `roleFieldSuppress` entry hides the Sheet value only while the Sheet still
 * names the suppressed speaker. Records without the map merge exactly as
 * before — this path feeds the newsletter. Placeholder names only.
 */

const override = (extra: Partial<ServiceOccurrenceOverrideRecord>): ServiceOccurrenceOverrideRecord =>
  ({
    pkey: 'SERVICE_OVERRIDE#E',
    skey: 'memorial#2026-11-15',
    ecclesia: 'E',
    serviceType: 'memorial',
    date: '2026-11-15',
    createdBy: 'x',
    createdAt: 'x',
    updatedAt: 'x',
    lastUpdated: 'x',
    version: 1,
    ...extra,
  }) as ServiceOccurrenceOverrideRecord

const row = (Exhort: string) => ({ Preside: 'Pat Presider', Exhort })

describe('roleFieldSuppress — conditional blank', () => {
  const o = override({ roleFields: { Exhort: '' }, roleFieldSuppress: { Exhort: 'Alex Speaker' } })

  it('keeps the suppressed name hidden, however the Sheet spells it', () => {
    expect(applyOverrideToProgramItem(row('Alex Speaker'), o).Exhort).toBe('')
    expect(applyOverrideToProgramItem(row('  bro. ALEX   speaker '), o).Exhort).toBe('')
    expect(applyOverrideToProgramItem(row('Brother Alex Speaker'), o).Exhort).toBe('')
  })

  it('lets a different, later Sheet name through', () => {
    expect(applyOverrideToProgramItem(row('Blair Speaker'), o).Exhort).toBe('Blair Speaker')
  })

  it('a blank Sheet stays blank', () => {
    expect(applyOverrideToProgramItem(row(''), o).Exhort).toBe('')
  })

  it('other fields of the same record still apply', () => {
    const both = override({
      roleFields: { Exhort: '', Preside: 'Quinn Presider' },
      roleFieldSuppress: { Exhort: 'Alex Speaker' },
    })
    expect(applyOverrideToProgramItem(row('Blair Speaker'), both)).toMatchObject({
      Exhort: 'Blair Speaker',
      Preside: 'Quinn Presider',
    })
  })
})

describe('regression: records without roleFieldSuppress merge exactly as before', () => {
  it("an unconditional '' still blanks whatever the Sheet says", () => {
    const o = override({ roleFields: { Exhort: '' } })
    expect(applyOverrideToProgramItem(row('Blair Speaker'), o).Exhort).toBe('')
  })

  it('a name overlay still replaces the Sheet value', () => {
    const o = override({ roleFields: { Exhort: 'Alex Speaker' }, roleFieldRefs: { Exhort: 'p-a' } })
    const item = applyOverrideToProgramItem(row('Blair Speaker'), o)
    expect(item).toEqual({ Preside: 'Pat Presider', Exhort: 'Alex Speaker' })
  })

  it('a suppress entry on a key whose value is NOT blank is ignored', () => {
    const o = override({ roleFields: { Exhort: 'Alex Speaker' }, roleFieldSuppress: { Exhort: 'Blair Speaker' } })
    expect(applyOverrideToProgramItem(row('Casey Visitor'), o).Exhort).toBe('Alex Speaker')
  })
})

describe('sameScheduleName', () => {
  it('ignores case, whitespace, punctuation and an honorific; empty never matches', () => {
    expect(sameScheduleName('Bro. Alex Speaker', 'alex speaker')).toBe(true)
    expect(sameScheduleName('Alex Speaker', 'Alex Speakers')).toBe(false)
    expect(sameScheduleName('', '')).toBe(false)
  })
})
