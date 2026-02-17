import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { unsubscribeContact } from '../../../../utils/email/contact'

const VALID_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED] as const

/**
 * PUT /api/admin/set-role - Change a user's role
 * Only Owner and Admin can call this.
 * Admin cannot set role to 'owner'.
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
    if (callerRole !== ROLES.OWNER && callerRole !== ROLES.ADMIN) {
      return NextResponse.json(
        { error: 'Only Owner or Admin can change roles' },
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

    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Admin cannot promote to owner
    if (callerRole === ROLES.ADMIN && newRole === ROLES.OWNER) {
      return NextResponse.json(
        { error: 'Only an Owner can promote someone to Owner' },
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
      role: newRole as 'owner' | 'admin' | 'member' | 'guest' | 'deceased',
    })

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
