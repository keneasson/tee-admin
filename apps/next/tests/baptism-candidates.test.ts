import { describe, it, expect } from 'vitest'
import { getBaptismCandidates, formatCandidateNames } from '@my/app/types/events'

describe('getBaptismCandidates', () => {
  it('returns [] when neither candidate nor candidates is set', () => {
    expect(getBaptismCandidates({})).toEqual([])
    expect(getBaptismCandidates(null)).toEqual([])
    expect(getBaptismCandidates(undefined)).toEqual([])
  })

  it('falls back to the single legacy candidate when candidates is empty', () => {
    expect(
      getBaptismCandidates({ candidate: { firstName: 'Jasper', lastName: 'Deadman' } })
    ).toEqual([{ firstName: 'Jasper', lastName: 'Deadman' }])
  })

  it('ignores a blank legacy candidate', () => {
    expect(getBaptismCandidates({ candidate: { firstName: '', lastName: '' } })).toEqual([])
  })

  it('prefers the candidates array when it has named rows', () => {
    expect(
      getBaptismCandidates({
        candidate: { firstName: 'Jasper', lastName: 'Deadman' },
        candidates: [
          { firstName: 'Seth', lastName: 'Cooper' },
          { firstName: 'Isabella', lastName: 'Toste' },
        ],
      })
    ).toEqual([
      { firstName: 'Seth', lastName: 'Cooper' },
      { firstName: 'Isabella', lastName: 'Toste' },
    ])
  })

  it('drops blank rows from the candidates array', () => {
    expect(
      getBaptismCandidates({
        candidates: [
          { firstName: 'Seth', lastName: 'Cooper' },
          { firstName: '', lastName: '' },
        ],
      })
    ).toEqual([{ firstName: 'Seth', lastName: 'Cooper' }])
  })

  it('falls back to legacy candidate when candidates has only blank rows', () => {
    expect(
      getBaptismCandidates({
        candidate: { firstName: 'Jasper', lastName: 'Deadman' },
        candidates: [{ firstName: '', lastName: '' }],
      })
    ).toEqual([{ firstName: 'Jasper', lastName: 'Deadman' }])
  })
})

describe('formatCandidateNames', () => {
  it('returns empty string for no candidates', () => {
    expect(formatCandidateNames([])).toBe('')
    expect(formatCandidateNames(null)).toBe('')
    expect(formatCandidateNames(undefined)).toBe('')
  })

  it('formats one name', () => {
    expect(formatCandidateNames([{ firstName: 'Jasper', lastName: 'Deadman' }])).toBe(
      'Jasper Deadman'
    )
  })

  it('formats two names with "and"', () => {
    expect(
      formatCandidateNames([
        { firstName: 'Seth', lastName: 'Cooper' },
        { firstName: 'Isabella', lastName: 'Toste' },
      ])
    ).toBe('Seth Cooper and Isabella Toste')
  })

  it('formats three or more names with commas and a trailing "and"', () => {
    expect(
      formatCandidateNames([
        { firstName: 'A', lastName: 'One' },
        { firstName: 'B', lastName: 'Two' },
        { firstName: 'C', lastName: 'Three' },
      ])
    ).toBe('A One, B Two and C Three')
  })

  it('skips blank names when joining', () => {
    expect(
      formatCandidateNames([
        { firstName: 'Seth', lastName: 'Cooper' },
        { firstName: '', lastName: '' },
      ])
    ).toBe('Seth Cooper')
  })
})
