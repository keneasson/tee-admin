import { describe, it, expect } from 'vitest'
import {
  confirmBrotherChanges,
  isConfirmedBrother,
  isInvitableSpeaker,
  parseSpeakerFactsEdit,
  titleFor,
  titledName,
} from '@my/app/utils/speaker-eligibility'
import { groupInviteCandidates, matchEcclesias, splitTypedName } from '@my/app/features/speaker-invites/invitee-search'
import { brotherName, titledFullName } from '@my/app/features/speaker-invites/format'

/** docs/SPEAKER_INVITATIONS.md §9a / §9b — pure helpers. Placeholder names only. */

describe('isInvitableSpeaker — the ONE predicate (truth table)', () => {
  const baptized = [undefined, null, true, false] as const
  const gender = [undefined, null, 'male', 'female'] as const
  for (const b of baptized) {
    for (const g of gender) {
      const expected = b !== false && g !== 'female'
      it(`baptized=${String(b)} gender=${String(g)} → ${expected}`, () => {
        expect(isInvitableSpeaker({ baptized: b, gender: g })).toBe(expected)
      })
    }
  }
  it('nothing is inferred from the role', () => {
    expect(isInvitableSpeaker({ role: 'guest' } as any)).toBe(true)
    expect(isInvitableSpeaker({ role: 'owner', gender: 'female' } as any)).toBe(false)
    expect(isInvitableSpeaker(null)).toBe(false)
  })
  it('confirmed brother = both facts recorded', () => {
    expect(isConfirmedBrother({ baptized: true, gender: 'male' })).toBe(true)
    expect(isConfirmedBrother({ baptized: true })).toBe(false)
    expect(isConfirmedBrother({ gender: 'male' })).toBe(false)
  })
})

describe('confirmBrotherChanges — sets only what is unset, never overwrites', () => {
  it('fills the gaps', () => {
    expect(confirmBrotherChanges({})).toEqual({ gender: 'male', baptized: true })
    expect(confirmBrotherChanges({ gender: 'male', baptized: null })).toEqual({ baptized: true })
    expect(confirmBrotherChanges({ baptized: true })).toEqual({ gender: 'male' })
  })
  it('already confirmed → nothing; recorded to the contrary → conflict', () => {
    expect(confirmBrotherChanges({ gender: 'male', baptized: true })).toBe('nothing')
    expect(confirmBrotherChanges({ gender: 'female' })).toBe('conflict')
    expect(confirmBrotherChanges({ baptized: false, gender: 'male' })).toBe('conflict')
  })
})

describe('picker grouping (§9b)', () => {
  it('brethren first; unset facts under "not yet confirmed"; sisters and unbaptized never shown', () => {
    const list = [
      { personId: 'a', displayName: 'A Confirmed', gender: 'male' as const, baptized: true },
      { personId: 'b', displayName: 'B Unknown' },
      { personId: 'c', displayName: 'C Sister', gender: 'female' as const, baptized: true },
      { personId: 'd', displayName: 'D NotBaptized', gender: 'male' as const, baptized: false },
      { personId: 'e', displayName: 'E MaleOnly', gender: 'male' as const },
      { personId: 'f', displayName: 'F BaptizedOnly', baptized: true },
    ]
    const { brethren, unconfirmed } = groupInviteCandidates(list)
    expect(brethren.map((c) => c.personId)).toEqual(['a'])
    expect(unconfirmed.map((c) => c.personId)).toEqual(['b', 'e', 'f'])
  })
})

describe('titles (§9b): only for a recorded gender AND recorded baptism, else the first name', () => {
  it('titleFor needs both facts', () => {
    expect(titleFor({ gender: 'male', baptized: true })).toBe('Brother')
    expect(titleFor({ gender: 'female', baptized: true })).toBe('Sister')
    // Unbaptized or unknown baptism: never titled.
    expect(titleFor({ gender: 'female', baptized: false })).toBeUndefined()
    expect(titleFor({ gender: 'male', baptized: false })).toBeUndefined()
    expect(titleFor({ gender: 'male' })).toBeUndefined()
    expect(titleFor({ baptized: true })).toBeUndefined()
    expect(titleFor(null)).toBeUndefined()
  })
  it('brotherName uses the server-sent title', () => {
    expect(brotherName({ firstName: 'Sam', lastName: 'Sample', title: 'Brother' })).toBe('Brother Sample')
    expect(brotherName({ firstName: 'Sam', lastName: 'Sample', title: 'Sister' })).toBe('Sister Sample')
    expect(brotherName({ firstName: 'Sam', lastName: 'Sample' })).toBe('Sam')
    expect(brotherName({ lastName: 'Sample' })).toBe('the invited speaker')
    expect(brotherName(null)).toBe('the invited speaker')
  })
  it('titledFullName (swap page) and titledName', () => {
    expect(titledFullName('Sam Middle Sample', 'Brother')).toBe('Brother Sample')
    expect(titledFullName('Sam Sample')).toBe('Sam')
    expect(titledName({ firstName: 'Sam', title: 'Brother' })).toBe('Sam')
  })
})

describe('"add them" prefill', () => {
  it('two+ words: first word first, the rest last; one word: first name', () => {
    expect(splitTypedName('  Sam   Van Sample ')).toEqual({ firstName: 'Sam', lastName: 'Van Sample' })
    expect(splitTypedName('Sam Sample')).toEqual({ firstName: 'Sam', lastName: 'Sample' })
    expect(splitTypedName('Sam')).toEqual({ firstName: 'Sam', lastName: '' })
    expect(splitTypedName('   ')).toEqual({ firstName: '', lastName: '' })
  })
})

describe('ecclesia autocomplete matching', () => {
  const names = ['Example East', 'Example West', 'Sampletown', 'Other Place']
  it('exactly one match is offered filled in', () => {
    expect(matchEcclesias('sampl', names)).toEqual({ kind: 'one', name: 'Sampletown' })
  })
  it('several are listed, prefix matches first', () => {
    expect(matchEcclesias('EXAMPLE', names)).toEqual({ kind: 'many', names: ['Example East', 'Example West'] })
    expect(matchEcclesias('e', names).kind).toBe('many')
  })
  it('none offers the typed text; exact needs nothing; empty is empty', () => {
    expect(matchEcclesias(' Nowhere ', names)).toEqual({ kind: 'none', typed: 'Nowhere' })
    expect(matchEcclesias('other place', names)).toEqual({ kind: 'exact', name: 'Other Place' })
    expect(matchEcclesias('', names)).toEqual({ kind: 'empty' })
  })
})

describe('parseSpeakerFactsEdit (profile / admin person form)', () => {
  it('reads Brother / Sister / Not set, Yes / No / Not set and an optional date', () => {
    expect(parseSpeakerFactsEdit({ gender: 'male', baptized: true, baptismDate: '2001-06-03' })).toEqual({
      ok: true, facts: { gender: 'male', baptized: true, baptismDate: '2001-06-03' },
    })
    expect(parseSpeakerFactsEdit({ gender: null, baptized: null, baptismDate: '' })).toEqual({
      ok: true, facts: { gender: null, baptized: null, baptismDate: null },
    })
    expect(parseSpeakerFactsEdit({ firstName: 'x' })).toEqual({ ok: true, facts: {} })
  })
  it('refuses anything else', () => {
    expect(parseSpeakerFactsEdit({ gender: 'm' }).ok).toBe(false)
    expect(parseSpeakerFactsEdit({ baptized: 'yes' }).ok).toBe(false)
    expect(parseSpeakerFactsEdit({ baptismDate: '03/06/2001' }).ok).toBe(false)
  })
})
