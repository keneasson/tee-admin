/**
 * Pure logic for secure self-serve email change (identity transfer).
 *
 * Kept free of node/crypto and platform imports so it is unit-testable and shared
 * by the token repository (packages/app) and the Next.js routes (apps/next):
 *  - the confusable-free confirmation-code alphabet + mapping from random bytes,
 *  - input normalization for the code,
 *  - the ESCALATING lockout ladder (3 wrong tries → 10m → 60m → 24h → locked).
 *
 * The server supplies randomness (crypto) and the clock (`Date.now()`); this
 * module only maps them, so every rule here is deterministic and testable.
 */

// A-Z minus the confusable I, L, O, plus digits 2-9 (no 0/1). 31 symbols.
export const EMAIL_CHANGE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const EMAIL_CHANGE_CODE_LENGTH = 6

/**
 * Map random bytes to a code over {@link EMAIL_CHANGE_CODE_ALPHABET}. The tiny
 * modulo bias (256 mod 31) is immaterial for a single-use, time-boxed,
 * rate-limited, lockout-guarded code — the search space is 31^6 ≈ 887M.
 */
export function codeFromBytes(bytes: ArrayLike<number>, length: number = EMAIL_CHANGE_CODE_LENGTH): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    const b = bytes[i] ?? 0
    out += EMAIL_CHANGE_CODE_ALPHABET[b % EMAIL_CHANGE_CODE_ALPHABET.length]
  }
  return out
}

/** Normalize user-entered code: uppercase, drop spaces/dashes and anything off-alphabet. */
export function normalizeCode(input: string): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// ---- Escalating lockout ladder ----------------------------------------------

/** Wrong tries allowed before a lockout is served. */
export const ATTEMPTS_PER_TIER = 3

/**
 * Lockout duration served the FIRST time each tier's attempts are exhausted, in
 * order. After the last finite tier, the account is locked until a human
 * intervenes ("call someone").
 */
export const LOCKOUT_DURATIONS_MS = [
  10 * 60 * 1000, // 10 minutes
  60 * 60 * 1000, // 60 minutes
  24 * 60 * 60 * 1000, // 24 hours
]

export interface LockoutState {
  /** Consecutive wrong tries within the current tier. */
  failCount: number
  /** Lockouts served so far (0 = none yet). Indexes {@link LOCKOUT_DURATIONS_MS}. */
  tier: number
  /** Epoch ms the current lockout ends; null = not locked; Infinity = permanent. */
  lockedUntil: number | null
}

export const INITIAL_LOCKOUT: LockoutState = { failCount: 0, tier: 0, lockedUntil: null }

/** Is the account currently locked out (given `now`)? */
export function isLocked(state: LockoutState, now: number): boolean {
  if (state.lockedUntil == null) return false
  return state.lockedUntil === Number.POSITIVE_INFINITY || state.lockedUntil > now
}

/** Wrong tries remaining before the next lockout is served. */
export function remainingAttempts(state: LockoutState): number {
  return Math.max(0, ATTEMPTS_PER_TIER - state.failCount)
}

/**
 * Record one wrong code at `now`. Below the per-tier threshold this just counts
 * up; hitting the threshold serves the current tier's lockout and advances to the
 * next tier (a finite duration, then permanent). Callers must reject attempts
 * while {@link isLocked}; this models only what a fresh wrong try does.
 */
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failCount = state.failCount + 1
  if (failCount < ATTEMPTS_PER_TIER) {
    return { ...state, failCount }
  }
  const duration = LOCKOUT_DURATIONS_MS[state.tier]
  const lockedUntil = duration === undefined ? Number.POSITIVE_INFINITY : now + duration
  return { failCount: 0, tier: state.tier + 1, lockedUntil }
}

/** Clear the ladder after a correct code / new flow. */
export function resetLockout(): LockoutState {
  return { ...INITIAL_LOCKOUT }
}

export interface LockDescription {
  locked: boolean
  permanent: boolean
  /** Epoch ms the lock ends (null when not locked; Infinity when permanent). */
  until: number | null
}

/** Human-facing lock status for messaging. */
export function describeLock(state: LockoutState, now: number): LockDescription {
  const locked = isLocked(state, now)
  const permanent = state.lockedUntil === Number.POSITIVE_INFINITY
  return { locked, permanent, until: locked ? state.lockedUntil : null }
}
