import { describe, it, expect } from 'vitest'
import { PII_BEARING_OCCASIONS, occasionIsPiiBearing } from '@my/app/utils/occasion-pii'
// Deep import (not the barrel): the barrel also exports the Tamagui screen,
// which a plain-node test env cannot load. Same convention as the sibling suites.
import {
  PII_BEARING_OCCASIONS as EDITOR_SET,
  gatePiiProse,
} from '@my/app/features/post-editor/pii-occasion-defaults'
import type { TextBlock } from '@my/app/types/post'

/**
 * REGRESSION GUARD for the drift that blocked the doc-editor keystone.
 *
 * The set of PII-bearing occasions had been declared twice — once in the Phase 0
 * adapter and once in the doc editor's chrome — and the copies disagreed
 * (`engagement` was in one, missing from the other). An engagement post's prose
 * was therefore gated to members on the legacy read path and published PUBLIC
 * through the editor: the same post, two different privacy answers.
 *
 * There is now one declaration. These tests fail if a second one ever reappears
 * or if the adapter and the editor stop agreeing.
 */
describe('PII-bearing occasions — one canonical set', () => {
  it('covers every occasion that can carry PII in free prose or pixels', () => {
    expect([...PII_BEARING_OCCASIONS].sort()).toEqual([
      'baptism',
      'engagement',
      'funeral',
      'medical',
    ])
  })

  it('the editor and the adapter read the SAME set object (not a copy)', () => {
    expect(EDITOR_SET).toBe(PII_BEARING_OCCASIONS)
  })

  it('gates engagement — the tag the two copies used to disagree about', () => {
    expect(occasionIsPiiBearing(['engagement'])).toBe(true)
  })

  it('the doc editor gates engagement prose to members — the side that leaked', () => {
    const prose: TextBlock = {
      id: 't1',
      kind: 'text',
      body: 'A private note naming both families.',
      containsPii: false,
    }

    const [gated] = gatePiiProse([prose], ['engagement'], false) as TextBlock[]

    expect(gated.visibility).toBe('members')
    expect(gated.containsPii).toBe(true)
  })

  it('make-public is still the author\'s explicit escape hatch', () => {
    const prose: TextBlock = { id: 't1', kind: 'text', body: 'Public notice.', containsPii: false }

    const [ungated] = gatePiiProse([prose], ['engagement'], true) as TextBlock[]

    expect(ungated.visibility).toBeUndefined()
  })
})
