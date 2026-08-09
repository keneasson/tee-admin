import { describe, it, expect } from 'vitest'
import {
  EMAIL_CHANGE_CODE_ALPHABET,
  codeFromBytes,
  normalizeCode,
  INITIAL_LOCKOUT,
  ATTEMPTS_PER_TIER,
  LOCKOUT_DURATIONS_MS,
  isLocked,
  remainingAttempts,
  registerFailure,
  describeLock,
  type LockoutState,
} from '@my/app/utils/email-change'

describe('email-change confirmation code', () => {
  it('alphabet excludes the confusable characters (0 1 I L O)', () => {
    for (const ch of ['0', '1', 'I', 'L', 'O']) {
      expect(EMAIL_CHANGE_CODE_ALPHABET.includes(ch)).toBe(false)
    }
    // 23 letters (A-Z minus I,L,O) + 8 digits (2-9)
    expect(EMAIL_CHANGE_CODE_ALPHABET.length).toBe(31)
  })

  it('codeFromBytes is deterministic and stays within the alphabet', () => {
    const code = codeFromBytes([0, 1, 2, 30, 31, 62], 6)
    expect(code).toBe('ABC' + EMAIL_CHANGE_CODE_ALPHABET[30] + 'AA') // 31%31=0→A, 62%31=0→A
    for (const ch of code) expect(EMAIL_CHANGE_CODE_ALPHABET.includes(ch)).toBe(true)
    expect(code).toHaveLength(6)
  })

  it('normalizeCode uppercases and strips spaces/dashes/off-alphabet noise', () => {
    expect(normalizeCode(' a2-c d9 ')).toBe('A2CD9')
    expect(normalizeCode('')).toBe('')
  })
})

describe('escalating lockout ladder (3 tries → 10m → 60m → 24h → locked)', () => {
  const T0 = 1_000_000

  // Drive three wrong tries from a given state, asserting the lock lands on the 3rd.
  function threeFails(state: LockoutState, now: number) {
    let s = state
    s = registerFailure(s, now) // 1
    expect(isLocked(s, now)).toBe(false)
    s = registerFailure(s, now) // 2
    expect(isLocked(s, now)).toBe(false)
    expect(remainingAttempts(s)).toBe(ATTEMPTS_PER_TIER - 2)
    s = registerFailure(s, now) // 3 → lock served
    return s
  }

  it('counts down attempts within a tier without locking early', () => {
    let s = INITIAL_LOCKOUT
    expect(remainingAttempts(s)).toBe(3)
    s = registerFailure(s, T0)
    expect(remainingAttempts(s)).toBe(2)
    expect(isLocked(s, T0)).toBe(false)
  })

  it('serves 10m, then 60m, then 24h, then a permanent lock', () => {
    // Tier 0 → 10 minutes
    let s = threeFails(INITIAL_LOCKOUT, T0)
    expect(isLocked(s, T0)).toBe(true)
    expect(s.lockedUntil).toBe(T0 + LOCKOUT_DURATIONS_MS[0])
    expect(describeLock(s, T0).permanent).toBe(false)

    // After it expires, the counter is clear and we're on the next tier
    const t1 = (s.lockedUntil as number) + 1
    expect(isLocked(s, t1)).toBe(false)
    expect(s.failCount).toBe(0)

    // Tier 1 → 60 minutes
    s = threeFails(s, t1)
    expect(s.lockedUntil).toBe(t1 + LOCKOUT_DURATIONS_MS[1])

    // Tier 2 → 24 hours
    const t2 = (s.lockedUntil as number) + 1
    s = threeFails(s, t2)
    expect(s.lockedUntil).toBe(t2 + LOCKOUT_DURATIONS_MS[2])

    // Tier 3 → permanent ("call someone")
    const t3 = (s.lockedUntil as number) + 1
    s = threeFails(s, t3)
    expect(s.lockedUntil).toBe(Number.POSITIVE_INFINITY)
    expect(isLocked(s, t3 + 10 ** 12)).toBe(true) // still locked far in the future
    expect(describeLock(s, t3).permanent).toBe(true)
  })
})
