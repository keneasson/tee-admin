import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  canVote,
  voteWeight,
  verificationProgress,
  progressLabel,
} from '@my/app/utils/contact-verification'
import { resolvePersonParam } from '@my/app/utils/resolve-person-param'

/**
 * POST /api/people/[email]/contacts/confirm
 * Body: { contactType: 'address' | 'phone', contactId: string }
 *
 * "I can confirm this is correct" — a member of the same ecclesia vouching for
 * a proposed contact change.
 *
 * Confirmation is a COMMUNITY act, because we mostly trust each other. Two
 * ordinary members, or one Recording Brother or Rep, is enough — the member
 * whose record it is never has to click anything, which matters when they are
 * ninety-two and not at ease with a browser.
 *
 * The rules live in `contact-verification.ts` as a single weight threshold, so
 * this route decides nothing on its own; it records a vote and applies the
 * verdict.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Sign in to confirm a change' }, { status: 401 })
    }

    const { email } = await params
    // Same resolver as the page and every other action on it: the param may be
    // a personId, a primary email, or a secondary one.
    const subject = await resolvePersonParam(email)
    if (!subject) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const body = await request.json()
    const { contactType, contactId } = body as {
      contactType?: 'address' | 'phone'
      contactId?: string
    }
    if (!contactId || (contactType !== 'address' && contactType !== 'phone')) {
      return NextResponse.json(
        { error: "contactType must be 'address' or 'phone', and contactId is required" },
        { status: 400 }
      )
    }

    const voterPerson = await personRepository.getByEmail(session.user.email)
    if (!voterPerson) {
      return NextResponse.json({ error: 'Your record could not be found' }, { status: 403 })
    }

    const voter = {
      personId: voterPerson.personId,
      role: (session.user as any).role as string | undefined,
      ecclesia: voterPerson.ecclesia,
      isRecordingBrother: Boolean((session.user as any).isRecordingBrother),
    }

    const existing = await personRepository.getContactVotes(
      subject.personId,
      contactType,
      contactId
    )

    const eligibility = canVote(voter, subject.personId, subject.ecclesia, existing)
    if (!eligibility.allowed) {
      // 409, not 403: the caller is authenticated and legitimate, the vote just
      // cannot be counted. The reason is written to be shown to them verbatim.
      return NextResponse.json({ error: eligibility.reason }, { status: 409 })
    }

    await personRepository.addContactVote(subject.personId, {
      contactType,
      contactId,
      voterPersonId: voter.personId,
      voterEmail: session.user.email,
      voterEcclesia: voter.ecclesia,
      voterRole: voter.role,
      weight: voteWeight(voter, subject.ecclesia),
      votedAt: new Date().toISOString(),
    })

    const progress = verificationProgress(
      (await personRepository.getContactVotes(subject.personId, contactType, contactId)).map(
        (v) => ({ voterPersonId: v.voterPersonId, weight: v.weight, votedAt: v.votedAt })
      )
    )

    // Threshold met — promote the proposal and retire what it replaced.
    if (progress.isVerified) {
      if (contactType === 'address') {
        await personRepository.verifyAddress(subject.personId, contactId, session.user.email)
      } else {
        await personRepository.verifyPhone(subject.personId, contactId, session.user.email)
      }
      // The value is settled; votes about it are noise, and leaving them would
      // let a recycled id inherit somebody else's confirmations.
      await personRepository.clearContactVotes(subject.personId, contactType, contactId)
    }

    return NextResponse.json({
      success: true,
      verified: progress.isVerified,
      progress: {
        weight: progress.weight,
        threshold: progress.threshold,
        remaining: progress.remaining,
        label: progressLabel(progress),
      },
    })
  } catch (error) {
    console.error('Error confirming contact change:', error)
    return NextResponse.json({ error: 'Failed to record your confirmation' }, { status: 500 })
  }
}
