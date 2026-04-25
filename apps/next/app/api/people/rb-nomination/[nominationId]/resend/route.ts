import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'
import { sendRBConfirmationEmail } from '../../../../../../utils/email/send-rb-confirmation'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * POST /api/people/rb-nomination/[nominationId]/resend — Resend confirmation email
 *
 * Body: { ecclesia }
 * Nomination must be in 'confirmed' status. Admin/Owner or same-ecclesia recorder.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nominationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { nominationId } = await params
    const body = await request.json()
    const { ecclesia } = body

    if (!ecclesia?.trim()) {
      return NextResponse.json({ error: 'ecclesia is required' }, { status: 400 })
    }

    const viewerRole = (session.user.role as string)?.toLowerCase()
    if (viewerRole !== ROLES.ADMIN && viewerRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin or Owner access required' }, { status: 403 })
    }

    // Look up the nomination
    const nomination = await rbNominationRepository.get(
      `RB_NOM#${ecclesia.trim()}`,
      `NOMINATION#${nominationId}`
    )

    if (!nomination) {
      return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
    }

    if (nomination.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Can only resend for confirmed nominations' },
        { status: 400 }
      )
    }

    // Look up nominee
    const nominee = await personRepository.getByEmail(nomination.nomineeEmail)
    if (!nominee) {
      return NextResponse.json({ error: 'Nominee not found' }, { status: 404 })
    }

    // Re-send confirmation email
    await sendRBConfirmationEmail({
      recipientEmail: nomination.nomineeEmail,
      recipientName: nomination.nomineeName,
      ecclesiaName: ecclesia.trim(),
      emailPreference: nomination.emailPreference || 'personal',
      rbEcclesiaEmail: nomination.rbEcclesiaEmail,
      nominationId: nomination.nominationId,
      nominatorName: nomination.nominatedByName,
      personId: nominee.personId,
    })

    // Update confirmationSentAt
    const now = new Date().toISOString()
    await rbNominationRepository.update(
      `RB_NOM#${ecclesia.trim()}`,
      `NOMINATION#${nominationId}`,
      { confirmationSentAt: now } as any
    )

    return NextResponse.json({ success: true, confirmationSentAt: now })
  } catch (error) {
    console.error('Resend RB confirmation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
