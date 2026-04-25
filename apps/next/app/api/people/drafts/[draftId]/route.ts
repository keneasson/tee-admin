import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { draftMemberRepository } from '@my/app/provider/dynamodb/repositories/draft-member-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { invalidatePeopleCache } from '../../cache'

/**
 * PATCH /api/people/drafts/[draftId] — Approve or reject a draft
 *
 * Body: { action: 'approve'|'reject', ecclesia: string, note?: string }
 *
 * Permissions:
 *   Admin/Owner → any ecclesia
 *   Recorder/Rep → own ecclesia only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { draftId } = await params
    const body = await request.json()
    const { action, ecclesia, note } = body

    if (!action || !ecclesia) {
      return NextResponse.json(
        { error: 'action and ecclesia are required' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const viewerEmail = session.user.email
    const viewerRole = (session.user.role as string)?.toLowerCase()
    const isAdminOrOwner = viewerRole === ROLES.ADMIN || viewerRole === ROLES.OWNER
    const viewerIsRB = !!(session.user as any).isRecordingBrother
    const isRecorderOrRep = viewerIsRB || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP

    if (!isAdminOrOwner && !isRecorderOrRep) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Recorder/Rep can only approve for their own ecclesia
    if (!isAdminOrOwner) {
      let viewerPerson = await personRepository.getByEmail(viewerEmail)
      if (!viewerPerson) {
        const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
        viewerPerson = persons[0] || null
      }
      if (viewerPerson?.ecclesia !== ecclesia) {
        return NextResponse.json(
          { error: 'You can only review drafts for your own ecclesia' },
          { status: 403 }
        )
      }
    }

    if (action === 'approve') {
      const draft = await draftMemberRepository.approve(draftId, ecclesia, viewerEmail)
      invalidatePeopleCache()
      return NextResponse.json({ success: true, action: 'approved', draft })
    } else {
      const draft = await draftMemberRepository.reject(draftId, ecclesia, viewerEmail, note)
      return NextResponse.json({ success: true, action: 'rejected', draft })
    }
  } catch (error) {
    console.error('Draft action error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
