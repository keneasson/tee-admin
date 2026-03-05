import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { draftMemberRepository } from '@my/app/provider/dynamodb/repositories/draft-member-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * GET /api/people/drafts — List pending drafts
 *
 * Permissions:
 *   Admin/Owner → see all pending drafts (optionally filtered by ?ecclesia=X)
 *   Recorder/Rep → see pending drafts for own ecclesia only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const viewerRole = (session.user.role as string)?.toLowerCase()
    const isAdminOrOwner = viewerRole === ROLES.ADMIN || viewerRole === ROLES.OWNER
    const viewerIsRB = !!(session.user as any).isRecordingBrother
    const isRecorderOrRep = viewerIsRB || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP

    if (!isAdminOrOwner && !isRecorderOrRep) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const ecclesiaFilter = searchParams.get('ecclesia')

    // Look up viewer's ecclesia
    const viewerEmail = session.user.email
    let viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    const viewerEcclesia = viewerPerson?.ecclesia

    let drafts
    if (isAdminOrOwner) {
      if (ecclesiaFilter) {
        drafts = await draftMemberRepository.getPendingByEcclesia(ecclesiaFilter)
      } else {
        drafts = await draftMemberRepository.getPending()
      }
    } else {
      // Recorder/Rep — only their own ecclesia
      if (!viewerEcclesia) {
        return NextResponse.json({ drafts: [] })
      }
      drafts = await draftMemberRepository.getPendingByEcclesia(viewerEcclesia)
    }

    return NextResponse.json({ success: true, drafts })
  } catch (error) {
    console.error('Get drafts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
