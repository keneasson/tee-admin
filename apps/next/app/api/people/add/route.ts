import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { draftMemberRepository } from '@my/app/provider/dynamodb/repositories/draft-member-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { invalidatePeopleCache } from '../cache'

/**
 * POST /api/people/add — Create a new member (direct or draft)
 *
 * Permission logic:
 *   Admin/Owner → direct add (any ecclesia)
 *   Recorder/Rep + same ecclesia → direct add
 *   Otherwise → create draft (needs approval)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, ecclesia, role: requestedRole } = body

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !ecclesia?.trim()) {
      return NextResponse.json(
        { error: 'firstName, lastName, email, and ecclesia are required' },
        { status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Duplicate check
    const existing = await personRepository.getByEmail(email.toLowerCase())
    if (existing) {
      return NextResponse.json(
        { error: 'A person with this email already exists' },
        { status: 409 }
      )
    }

    const viewerEmail = session.user.email
    const viewerRole = (session.user.role as string)?.toLowerCase()

    // Look up viewer's ecclesia
    let viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    const viewerEcclesia = viewerPerson?.ecclesia
    const viewerName = viewerPerson?.displayName || viewerEmail

    // Determine if direct add or draft
    const isAdminOrOwner = viewerRole === ROLES.ADMIN || viewerRole === ROLES.OWNER
    const isRecordingBrother = !!(session.user as any).isRecordingBrother
    const isRecorderOrRep = isRecordingBrother || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP
    const isSameEcclesia = viewerEcclesia === ecclesia
    const canDirectAdd = isAdminOrOwner || (isRecorderOrRep && isSameEcclesia)

    // Determine role: use requested role if provided and valid, otherwise default based on ecclesia
    const ALLOWED_ROLES = ['member', 'guest', 'suspicious']
    const effectiveRole = requestedRole && ALLOWED_ROLES.includes(requestedRole)
      ? requestedRole
      : (ecclesia?.trim() ? 'member' : 'guest')
    const effectiveMemberStatus = effectiveRole === 'member' ? 'member' : 'visitor'

    if (canDirectAdd) {
      // Direct add — create real PersonRecord
      const person = await personRepository.create({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ecclesia: ecclesia.trim(),
        memberStatus: effectiveMemberStatus,
        role: effectiveRole,
      })

      invalidatePeopleCache()

      return NextResponse.json({
        success: true,
        mode: 'direct',
        member: {
          id: person.personId,
          email: person.primaryEmail,
          name: person.displayName,
          ecclesia: person.ecclesia,
        },
      })
    } else {
      // Create draft
      const draft = await draftMemberRepository.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        ecclesia: ecclesia.trim(),
        createdBy: viewerEmail,
        createdByName: viewerName,
      })

      return NextResponse.json({
        success: true,
        mode: 'draft',
        draft: {
          draftId: draft.draftId,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          ecclesia: draft.ecclesia,
          status: draft.status,
        },
      })
    }
  } catch (error) {
    console.error('Add member error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
