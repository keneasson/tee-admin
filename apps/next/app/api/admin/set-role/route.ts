import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { unsubscribeContact } from '../../../../utils/email/contact'
import { invalidatePeopleCache } from '../../people/cache'
import { invalidateGuestCache } from '../../people/guests/cache'

// Note: 'recorder' is deprecated as a role — RB is set via the nomination flow (isRecordingBrother boolean).
// Kept in VALID_ROLES for backwards compat with existing data but not in ALLOWED_ASSIGNMENTS for new assignments.
const VALID_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED] as const

// Roles that each caller level is allowed to assign
// Note: RECORDER removed — RB is a designation, not a role to be assigned
const ALLOWED_ASSIGNMENTS: Record<string, string[]> = {
  [ROLES.OWNER]: [ROLES.OWNER, ROLES.ADMIN, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED],
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED],
  [ROLES.REP]: [ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED],
}

// Roles that can call set-role (isRecordingBrother checked separately below)
const CALLER_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.RECORDER, ROLES.REP]

/**
 * PUT /api/admin/set-role - Change a user's role
 * Owner and Admin can change any user's role (with hierarchy limits).
 * Recorder and Rep can only change roles for members of their own ecclesia.
 * Admin cannot set role to 'owner'.
 * Recorder cannot set role to 'admin' or 'owner'.
 * Rep cannot set role to 'recorder', 'admin', or 'owner'.
 * Cannot remove the only owner.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const callerRole = (session.user as any).role as string
    const callerIsRB = !!(session.user as any).isRecordingBrother
    if (!CALLER_ROLES.includes(callerRole) && !callerIsRB) {
      return NextResponse.json(
        { error: 'Insufficient permissions to change roles' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, newRole } = body

    if (!email || !newRole) {
      return NextResponse.json(
        { error: 'Missing required fields: email, newRole' },
        { status: 400 }
      )
    }

    if (newRole === ROLES.RECORDER) {
      return NextResponse.json(
        { error: 'Recording Brother is now a designation, not a role. Use the RB nomination flow to set a Recording Brother.' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if the caller is allowed to assign this role
    // RB designation grants same permissions as legacy recorder role for role assignments
    const effectiveRole = callerIsRB && !ALLOWED_ASSIGNMENTS[callerRole] ? ROLES.REP : callerRole
    const allowed = ALLOWED_ASSIGNMENTS[effectiveRole]
    if (!allowed || !allowed.includes(newRole)) {
      return NextResponse.json(
        { error: `You cannot assign the role '${newRole}'` },
        { status: 403 }
      )
    }

    // Look up target person
    const targetPerson = await personRepository.getByEmail(email)
    if (!targetPerson) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Recorder/Rep/RB: enforce same-ecclesia restriction
    if (callerIsRB || callerRole === ROLES.RECORDER || callerRole === ROLES.REP) {
      const callerPerson = await personRepository.getByEmail(session.user.email)
      if (!callerPerson) {
        return NextResponse.json(
          { error: 'Caller not found' },
          { status: 403 }
        )
      }

      if (callerPerson.ecclesia !== targetPerson.ecclesia) {
        return NextResponse.json(
          { error: 'You can only change roles for members of your own ecclesia' },
          { status: 403 }
        )
      }
    }

    const previousRole = targetPerson.role || ROLES.GUEST

    // If same role, no-op
    if (previousRole === newRole) {
      return NextResponse.json({
        success: true,
        email,
        previousRole,
        newRole,
        message: 'Role unchanged',
      })
    }

    // Prevent demoting the only owner
    if (previousRole === ROLES.OWNER && newRole !== ROLES.OWNER) {
      const personOwners = await personRepository.scan({
        filterExpression: '#role = :ownerRole',
        expressionAttributeNames: { '#role': 'role' },
        expressionAttributeValues: { ':ownerRole': ROLES.OWNER },
      })
      const otherOwners = personOwners.items.filter(
        (p: any) => p.primaryEmail?.toLowerCase() !== email.toLowerCase()
      )
      if (otherOwners.length === 0) {
        return NextResponse.json(
          { error: 'Cannot remove the only Owner. Promote another user to Owner first.' },
          { status: 400 }
        )
      }
    }

    // Update PersonRecord
    await personRepository.updatePerson(targetPerson.personId, {
      role: newRole as 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased',
    })

    // Invalidate caches when role changes involve guests
    if (previousRole === ROLES.GUEST || newRole === ROLES.GUEST) {
      invalidateGuestCache()
      invalidatePeopleCache()
    }

    // When marking as deceased, unsubscribe their emails from SES —
    // but only if no living person still shares that email address.
    if (newRole === ROLES.DECEASED) {
      try {
        const emailRecords = await personRepository.getEmails(targetPerson.personId)
        const allEmails = [targetPerson.primaryEmail, ...emailRecords.map(e => e.email)]
        const uniqueEmails = [...new Set(allEmails.filter(Boolean))]

        const unsubscribed: string[] = []
        const skipped: string[] = []

        for (const addr of uniqueEmails) {
          // Check if any other living person shares this email
          const sharedPersons = await personRepository.getAllPersonsByEmail(addr)
          const livingSharer = sharedPersons.find(
            p => p.personId !== targetPerson.personId && p.role !== ROLES.DECEASED
          )

          if (livingSharer) {
            skipped.push(addr)
            console.log(`📧 Skipping unsubscribe for ${addr} — shared with living member ${livingSharer.displayName}`)
          } else {
            await unsubscribeContact(addr, 'deceased')
            unsubscribed.push(addr)
          }
        }

        console.log(`📧 Deceased user ${email}: unsubscribed ${unsubscribed.length}, skipped ${skipped.length} (shared with living members)`)
      } catch (sesError) {
        // Don't fail the role change if SES unsubscribe fails
        console.error('Failed to unsubscribe deceased user from SES:', sesError)
      }
    }

    return NextResponse.json({
      success: true,
      email,
      previousRole,
      newRole,
    })
  } catch (error) {
    console.error('Set role error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
