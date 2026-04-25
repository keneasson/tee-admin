import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'
import { sendRBConfirmationEmail } from '../../../../../../utils/email/send-rb-confirmation'

/**
 * POST /api/people/rb-nomination/[nominationId]/second — Second a nomination
 *
 * Body: { ecclesia }
 * Must be a member of the same ecclesia. Cannot second own nomination or second twice.
 * If this is the 2nd second → auto-confirm.
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
      return NextResponse.json(
        { error: 'ecclesia is required' },
        { status: 400 }
      )
    }

    const viewerEmail = session.user.email

    // Verify viewer is a member of this ecclesia
    let viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    if (!viewerPerson || viewerPerson.ecclesia !== ecclesia) {
      return NextResponse.json(
        { error: 'You must be a member of this ecclesia to second a nomination' },
        { status: 403 }
      )
    }

    const { nomination, confirmed } = await rbNominationRepository.addSecond(
      ecclesia.trim(),
      nominationId,
      viewerEmail,
      viewerPerson.displayName || viewerEmail
    )

    // If nomination was confirmed (2 seconds collected), send confirmation email to nominee
    if (confirmed) {
      const nominee = await personRepository.getByEmail(nomination.nomineeEmail)
      if (nominee) {
        await sendRBConfirmationEmail({
          recipientEmail: nomination.nomineeEmail,
          recipientName: nomination.nomineeName,
          ecclesiaName: ecclesia.trim(),
          emailPreference: nomination.emailPreference || 'personal',
          rbEcclesiaEmail: nomination.rbEcclesiaEmail,
          nominationId: nomination.nominationId,
          personId: nominee.personId,
        })

        // Track when confirmation email was sent
        await rbNominationRepository.update(
          `RB_NOM#${ecclesia.trim()}`,
          `NOMINATION#${nominationId}`,
          { confirmationSentAt: new Date().toISOString() } as any
        )
      }
    }

    return NextResponse.json({
      success: true,
      nomination,
      confirmed,
    })
  } catch (error) {
    console.error('Second RB nomination error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
