import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'
import { getEcclesiaByName } from '../../../../utils/dynamodb/locations'
import { sendRBConfirmationEmail } from '../../../../utils/email/send-rb-confirmation'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * GET /api/people/rb-nomination?ecclesia=X — Get open nominations for an ecclesia
 *
 * Also returns hasRecordingBrother flag.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Require at least member role
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const ecclesia = searchParams.get('ecclesia')
    if (!ecclesia) {
      return NextResponse.json({ error: 'ecclesia parameter is required' }, { status: 400 })
    }

    // Check if ecclesia has a Recording Brother via EcclesiaRecord
    const ecclesiaRecord = await getEcclesiaByName(ecclesia)
    const hasRecordingBrother = !!ecclesiaRecord?.recordingBrotherEmail

    const nominations = await rbNominationRepository.getOpenByEcclesia(ecclesia)

    return NextResponse.json({
      success: true,
      nominations,
      hasRecordingBrother,
    })
  } catch (error) {
    console.error('Get RB nominations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/people/rb-nomination — Create a new nomination or directly set RB
 *
 * Body: { ecclesia, nomineeEmail, nomineeName, directSet? }
 *
 * Standard nomination: Must be a member of the target ecclesia.
 * Direct set (directSet=true): Admin/Owner only — bypasses nomination/seconder process.
 * Ecclesia must NOT already have a Recording Brother.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { ecclesia, nomineeEmail, nomineeName, directSet, emailPreference, rbEcclesiaEmail } = body

    if (!ecclesia?.trim() || !nomineeEmail?.trim() || !nomineeName?.trim()) {
      return NextResponse.json(
        { error: 'ecclesia, nomineeEmail, and nomineeName are required' },
        { status: 400 }
      )
    }

    // Default email preference to 'personal' if not provided
    const resolvedPreference: 'personal' | 'ecclesia' = emailPreference === 'ecclesia' ? 'ecclesia' : 'personal'

    const viewerEmail = session.user.email
    const viewerRole = (session.user.role as string)?.toLowerCase()

    // Direct set — Admin/Owner bypass
    // Sends confirmation email to nominee instead of activating immediately
    if (directSet) {
      if (viewerRole !== ROLES.ADMIN && viewerRole !== ROLES.OWNER) {
        return NextResponse.json(
          { error: 'Only Admin or Owner can directly set a Recording Brother' },
          { status: 403 }
        )
      }

      // Check if ecclesia already has a Recording Brother
      const ecclesiaRecord = await getEcclesiaByName(ecclesia)
      if (ecclesiaRecord?.recordingBrotherEmail) {
        return NextResponse.json(
          { error: 'This ecclesia already has a Recording Brother' },
          { status: 409 }
        )
      }

      // Look up the nominee to get their personId
      const nominee = await personRepository.getByEmail(nomineeEmail.toLowerCase().trim())
      if (!nominee) {
        return NextResponse.json(
          { error: 'Nominee not found in the system' },
          { status: 404 }
        )
      }

      // Send confirmation email to nominee
      await sendRBConfirmationEmail({
        recipientEmail: nomineeEmail.trim(),
        recipientName: nomineeName.trim(),
        ecclesiaName: ecclesia.trim(),
        emailPreference: resolvedPreference,
        rbEcclesiaEmail: rbEcclesiaEmail?.trim(),
        nominatorName: (session.user as any).name || viewerEmail,
        personId: nominee.personId,
      })

      return NextResponse.json({ success: true, directSet: true, awaitingConfirmation: true })
    }

    // Standard nomination flow
    // Verify viewer is a member of this ecclesia
    let viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    if (!viewerPerson || viewerPerson.ecclesia !== ecclesia) {
      return NextResponse.json(
        { error: 'You must be a member of this ecclesia to nominate' },
        { status: 403 }
      )
    }

    // Check if ecclesia already has a Recording Brother via EcclesiaRecord
    const ecclesiaRecord = await getEcclesiaByName(ecclesia)
    const hasRB = !!ecclesiaRecord?.recordingBrotherEmail
    if (hasRB) {
      return NextResponse.json(
        { error: 'This ecclesia already has a Recording Brother' },
        { status: 409 }
      )
    }

    // Verify nominee is a member of this ecclesia
    const nominee = await personRepository.getByEmail(nomineeEmail.toLowerCase())
    if (!nominee || nominee.ecclesia !== ecclesia) {
      return NextResponse.json(
        { error: 'The nominee must be a member of this ecclesia' },
        { status: 400 }
      )
    }

    const nomination = await rbNominationRepository.create({
      ecclesia: ecclesia.trim(),
      nomineeEmail: nomineeEmail.trim(),
      nomineeName: nomineeName.trim(),
      nominatedBy: viewerEmail,
      nominatedByName: viewerPerson.displayName || viewerEmail,
      emailPreference: resolvedPreference,
      rbEcclesiaEmail: rbEcclesiaEmail?.trim(),
    })

    return NextResponse.json({ success: true, nomination })
  } catch (error) {
    console.error('Create RB nomination error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
