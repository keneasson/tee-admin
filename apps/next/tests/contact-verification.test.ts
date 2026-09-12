import { describe, it, expect } from 'vitest'
import {
  voteWeight,
  verificationProgress,
  progressLabel,
  canVote,
  VERIFICATION_THRESHOLD,
  type Voter,
  type ContactVote,
} from '@my/app/utils/contact-verification'

/**
 * "We mostly trust each other." A proposed contact change is confirmed by ANY
 * of: two other members of the ecclesia, one Recording Brother or Rep, or the
 * member themselves (handled by the approval flow).
 *
 * Those collapse into ONE rule — confirmation weight >= 2 — so there is no
 * second code path to drift out of step.
 */
const TEE = 'Toronto East Ecclesia'
const member = (over: Partial<Voter> = {}): Voter => ({
  personId: 'v1', role: 'member', ecclesia: TEE, ...over,
})
const vote = (voterPersonId: string, weight: number): ContactVote => ({
  voterPersonId, weight, votedAt: '2026-09-11T00:00:00.000Z',
})

describe('who may confirm, and for how much', () => {
  it('an ordinary member is worth half the threshold', () => {
    expect(voteWeight(member(), TEE)).toBe(1)
    expect(VERIFICATION_THRESHOLD).toBe(2)
  })

  it('a Recording Brother alone meets the threshold', () => {
    expect(voteWeight(member({ isRecordingBrother: true }), TEE)).toBe(2)
  })

  it('a Rep alone meets the threshold', () => {
    expect(voteWeight(member({ role: 'rep' }), TEE)).toBe(2)
  })

  it('someone from ANOTHER ecclesia cannot confirm — they lack local knowledge', () => {
    expect(voteWeight(member({ ecclesia: 'Brant County' }), TEE)).toBe(0)
  })

  it('a guest has no standing to assert somebody has moved', () => {
    expect(voteWeight(member({ role: 'guest' }), TEE)).toBe(0)
  })

  it('a trusted member still cannot verify single-handedly', () => {
    // Trust raises weight, but never past the point where one careless vote
    // could confirm a change on its own.
    const trusted = voteWeight(member({ trustMultiplier: 5 }), TEE)
    expect(trusted).toBeLessThan(VERIFICATION_THRESHOLD)
  })
})

describe('progress is visible, not hidden', () => {
  it('two member confirmations verify the change', () => {
    const p = verificationProgress([vote('a', 1), vote('b', 1)])
    expect(p.isVerified).toBe(true)
    expect(progressLabel(p)).toBe('Confirmed')
  })

  it('one member confirmation shows what is still needed', () => {
    const p = verificationProgress([vote('a', 1)])
    expect(p.isVerified).toBe(false)
    expect(progressLabel(p)).toBe('Needs 1 more confirmation')
  })

  it('no confirmations yet still states the requirement plainly', () => {
    expect(progressLabel(verificationProgress([]))).toBe('Needs 2 confirmations')
  })

  it('a single RB confirmation verifies outright', () => {
    expect(verificationProgress([vote('rb', 2)]).isVerified).toBe(true)
  })
})

describe('who is blocked from confirming, and why', () => {
  it('you cannot confirm your own record — approving is the stronger act', () => {
    const r = canVote(member({ personId: 'self' }), 'self', TEE, [])
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('approve the change instead')
  })

  it('you cannot confirm twice', () => {
    const r = canVote(member({ personId: 'v1' }), 'subject', TEE, [vote('v1', 1)])
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('already confirmed')
  })

  it('a member of another ecclesia is told why', () => {
    const r = canVote(member({ ecclesia: 'Brant County' }), 'subject', TEE, [])
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('same ecclesia')
  })

  it('an eligible member may confirm', () => {
    expect(canVote(member(), 'subject', TEE, []).allowed).toBe(true)
  })
})

/**
 * The badge is what members actually read, and the whole design rests on a
 * pending change being VISIBLE. These lock the wording and the arithmetic that
 * produces it — a silent regression here is a credibility problem, not a
 * cosmetic one.
 */
describe('the sentence a member reads on the badge', () => {
  it('two ordinary confirmations arrive exactly at the threshold, not past it', () => {
    const p = verificationProgress([vote('a', 1), vote('b', 1)])
    expect(p.weight).toBe(VERIFICATION_THRESHOLD)
    expect(p.isVerified).toBe(true)
    expect(progressLabel(p)).toBe('Confirmed')
  })

  it('a half-step of trust scaling never rounds a member into "no more needed"', () => {
    // A trusted member is capped at 1.5 so one careless vote can never verify.
    const w = voteWeight(member({ trustMultiplier: 3 }), TEE)
    const p = verificationProgress([vote('a', w)])
    expect(p.isVerified).toBe(false)
    expect(p.remaining).toBe(1)
    expect(progressLabel(p)).toBe('Needs 1 more confirmation')
  })

  it('an over-weight tally never reports a negative remainder', () => {
    const p = verificationProgress([vote('a', 2), vote('b', 2)])
    expect(p.remaining).toBe(0)
    expect(p.isVerified).toBe(true)
  })
})

describe('the reason shown when a viewer cannot confirm', () => {
  const votes = [vote('v1', 1)]

  it('points the member at approving rather than telling them "no"', () => {
    const r = canVote(member({ personId: 'subject' }), 'subject', TEE, [])
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/approve/i)
  })

  it('says plainly that they have already confirmed', () => {
    const r = canVote(member({ personId: 'v1' }), 'subject', TEE, votes)
    expect(r.reason).toMatch(/already confirmed/i)
  })

  it('always gives a reason when it blocks — never a silently missing button', () => {
    const blocked = [
      canVote(member({ personId: 'subject' }), 'subject', TEE, []),
      canVote(member({ personId: 'v1' }), 'subject', TEE, votes),
      canVote(member({ personId: 'v9', ecclesia: 'Hamilton' }), 'subject', TEE, []),
      canVote(member({ personId: 'v9', role: 'guest' }), 'subject', TEE, []),
    ]
    for (const r of blocked) {
      expect(r.allowed).toBe(false)
      expect(r.reason && r.reason.length).toBeGreaterThan(0)
    }
  })
})
