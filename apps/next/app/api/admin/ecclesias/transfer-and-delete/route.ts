import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { rbNominationRepository } from '@my/app/provider/dynamodb/repositories/rb-nomination-repository'
import { getEcclesiaByName, deleteEcclesia } from '@/utils/dynamodb/locations'
import { invalidatePeopleCache } from '@/app/api/people/cache'
import { invalidateMemberCountsCache } from '../cache'

/**
 * POST /api/admin/ecclesias/transfer-and-delete
 *
 * Transfers all members from sourceEcclesia to targetEcclesia,
 * withdraws open RB nominations for the source, then deletes
 * the source EcclesiaRecord.
 *
 * Body: { sourceEcclesia: string, targetEcclesia: string }
 * Returns: { success, transferred, message }
 *
 * Idempotent on retry — re-querying GSI2 returns only
 * remaining un-transferred members.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const viewerRole = (session.user as any).role as string || ROLES.GUEST
    if (viewerRole !== ROLES.ADMIN && viewerRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin or Owner role required' }, { status: 403 })
    }

    const body = await request.json()
    const { sourceEcclesia, targetEcclesia } = body as {
      sourceEcclesia?: string
      targetEcclesia?: string
    }

    if (!sourceEcclesia || !targetEcclesia) {
      return NextResponse.json(
        { error: 'sourceEcclesia and targetEcclesia are required' },
        { status: 400 }
      )
    }

    if (sourceEcclesia === targetEcclesia) {
      return NextResponse.json(
        { error: 'Source and target ecclesia must be different' },
        { status: 400 }
      )
    }

    // Validate both ecclesias exist
    const [sourceRecord, targetRecord] = await Promise.all([
      getEcclesiaByName(sourceEcclesia),
      getEcclesiaByName(targetEcclesia),
    ])

    if (!sourceRecord) {
      return NextResponse.json(
        { error: `Source ecclesia "${sourceEcclesia}" not found` },
        { status: 404 }
      )
    }
    if (!targetRecord) {
      return NextResponse.json(
        { error: `Target ecclesia "${targetEcclesia}" not found` },
        { status: 404 }
      )
    }

    // 1. Collect all members from source ecclesia (paginated GSI2 query)
    const allMembers: Array<{ personId: string }> = []
    let lastKey: Record<string, any> | undefined

    do {
      const page = await personRepository.listByEcclesia(sourceEcclesia, {
        lastEvaluatedKey: lastKey,
      })
      for (const member of page.items) {
        allMembers.push({ personId: member.personId })
      }
      lastKey = page.lastEvaluatedKey
    } while (lastKey)

    // 2. Transfer each member to target ecclesia
    let transferred = 0
    for (const member of allMembers) {
      try {
        await personRepository.updatePerson(member.personId, {
          ecclesia: targetEcclesia,
        })
        transferred++
      } catch (err) {
        console.error(`Failed to transfer person ${member.personId}:`, err)
        // If any member fails, stop and report partial progress
        invalidatePeopleCache()
        invalidateMemberCountsCache()
        return NextResponse.json(
          {
            success: false,
            error: `Transfer partially failed. ${transferred} of ${allMembers.length} members transferred. Source ecclesia was NOT deleted. You can retry safely.`,
            transferred,
            total: allMembers.length,
          },
          { status: 500 }
        )
      }
    }

    // 3. Withdraw open RB nominations for source ecclesia
    try {
      const openNominations = await rbNominationRepository.getOpenByEcclesia(sourceEcclesia)
      for (const nomination of openNominations) {
        await rbNominationRepository.withdraw(sourceEcclesia, nomination.nominationId)
      }
    } catch (err) {
      // Non-fatal: log but continue with deletion
      console.error('Error withdrawing nominations:', err)
    }

    // 4. Delete the source ecclesia
    await deleteEcclesia(sourceEcclesia)

    // 5. Invalidate caches
    invalidatePeopleCache()
    invalidateMemberCountsCache()

    return NextResponse.json({
      success: true,
      transferred,
      message: `Transferred ${transferred} member${transferred !== 1 ? 's' : ''} to "${targetEcclesia}" and deleted "${sourceEcclesia}".`,
    })
  } catch (error) {
    console.error('Error in transfer-and-delete:', error)
    return NextResponse.json(
      { success: false, error: 'Transfer and delete failed' },
      { status: 500 }
    )
  }
}
