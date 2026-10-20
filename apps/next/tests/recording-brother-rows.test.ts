import { describe, it, expect } from 'vitest'
import { buildRecordingBrotherRows } from '@my/app/utils/recording-brother-rows'

const ecc = (name: string) => ({ name, city: 'City', province: 'ON' })
const p = (personId: string, ecclesia: string, displayName = personId) => ({ personId, ecclesia, displayName })

describe('buildRecordingBrotherRows', () => {
  it("suggests an ecclesia's only inter-ecclesia contact", () => {
    const { rows } = buildRecordingBrotherRows([ecc('A')], [p('a1', 'A')], [], [null])
    expect(rows[0]).toMatchObject({ current: null, suggestedPersonId: 'a1' })
    expect(rows[0].candidates).toEqual([{ personId: 'a1', name: 'a1', source: 'inter-ecclesia contact' }])
  })

  it('does not guess between two contacts', () => {
    const { rows } = buildRecordingBrotherRows([ecc('A')], [p('a1', 'A'), p('a2', 'A')], [], [null])
    expect(rows[0].suggestedPersonId).toBeNull()
    expect(rows[0].candidates).toHaveLength(2)
  })

  it('prefers the holder of the RB email on file, listed once', () => {
    const { rows } = buildRecordingBrotherRows([ecc('A')], [p('a1', 'A'), p('a2', 'A')], [], [p('a2', 'A')])
    expect(rows[0].suggestedPersonId).toBe('a2')
    expect(rows[0].candidates.map((c) => [c.personId, c.source])).toEqual([
      ['a2', 'RB email on file'],
      ['a1', 'inter-ecclesia contact'],
    ])
  })

  it('ignores an RB-email holder from another ecclesia', () => {
    const { rows } = buildRecordingBrotherRows([ecc('A')], [], [], [p('b1', 'B')])
    expect(rows[0].candidates).toEqual([])
    expect(rows[0].suggestedPersonId).toBeNull()
  })

  it('shows the current RB and suggests nothing for that ecclesia', () => {
    const { rows } = buildRecordingBrotherRows([ecc('A')], [p('a1', 'A')], [p('rb', 'A', 'Current RB')], [null])
    expect(rows[0].current).toEqual({ personId: 'rb', name: 'Current RB' })
    expect(rows[0].suggestedPersonId).toBeNull()
  })

  it('lists contacts whose ecclesia matches no ecclesia record', () => {
    const { unmatched } = buildRecordingBrotherRows([ecc('A')], [p('x', 'A Ecclesia'), p('y', '')], [], [null])
    expect(unmatched.map((u) => u.personId)).toEqual(['x', 'y'])
  })
})
