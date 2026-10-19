import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'
import { invalidatePeopleCache } from '../../people/cache'
import { describeRelatives, resolvePersonId, resolveSessionPerson } from '../../../../utils/relationships'

const validRelationshipTypes: RelationshipType[] = [
  'spouse',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'extended_family',
  'household_member',
]

// Relationships are keyed by personId (PERSON#<id> / REL#<targetId>#<type>), so
// a change of primary email never loses anyone's family.

/**
 * GET /api/user/relationships - Get all family relationships for current user
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const me = await resolveSessionPerson(session.user.email)
    if (!me) {
      return NextResponse.json({ success: true, relationships: [] })
    }

    const familyMembers = await relationshipRepository.getFamilyMembers(me.personId)

    return NextResponse.json({
      success: true,
      relationships: await describeRelatives(familyMembers),
    })
  } catch (error) {
    console.error('Get relationships error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/relationships - Create a new family relationship
 *
 * Accepts one of:
 * - { targetPersonId, relationshipType } - Link an existing person
 * - { targetEmail, relationshipType } - Link the person who holds that address
 * - { firstName, lastName, email?, relationshipType } - Create new person if needed
 */
/**
 * Copy the household address and phone from an existing person onto a newly
 * created one.
 *
 * A couple shares a home, so entering the address and the landline twice is
 * duplicate work that also creates two copies to keep in sync — which is how
 * they drift apart. "Same address" implies the shared home phone: that is what
 * a household phone IS, and the record already carries `isHousehold`.
 *
 * Copied values are marked household, and best-effort: failing to copy an
 * address must never lose the person, which is the outcome that actually hurt.
 */
async function copyHouseholdContacts(newPersonId: string, sourceEmail?: string) {
  if (!sourceEmail) return
  try {
    const source = await personRepository.getByEmail(sourceEmail)
    if (!source) return

    const [addresses, phones] = await Promise.all([
      personRepository.getAddresses(source.personId),
      personRepository.getPhones(source.personId),
    ])

    const primaryAddress = addresses.find((a) => a.isPrimary) || addresses[0]
    if (primaryAddress) {
      await personRepository.addAddress(newPersonId, {
        type: primaryAddress.type,
        street1: primaryAddress.street1,
        street2: primaryAddress.street2,
        city: primaryAddress.city,
        province: primaryAddress.province,
        postalCode: primaryAddress.postalCode,
        country: primaryAddress.country,
        isPrimary: true,
        isHousehold: true,
      })
    }

    // Only the HOME number travels with the address. A mobile belongs to a
    // person, not a household, and copying it would be wrong.
    const householdPhone =
      phones.find((ph) => ph.isHousehold) || phones.find((ph) => ph.type === 'home')
    if (householdPhone) {
      await personRepository.addPhone(newPersonId, {
        type: householdPhone.type,
        number: householdPhone.number,
        isPrimary: true,
        isHousehold: true,
      })
    }
  } catch (err) {
    console.error('Failed to copy household contacts:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, email, targetEmail, targetPersonId, relationshipType, sameAddressAs } = body

    // Validate relationship type
    if (!relationshipType || !validRelationshipTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const me = await resolveSessionPerson(session.user.email)
    if (!me) {
      return NextResponse.json({ error: 'No profile found for your account' }, { status: 404 })
    }

    // Determine the related person - picked, addressed, or found/created by name
    let familyMemberId: string

    if (targetPersonId || targetEmail) {
      const resolved = await resolvePersonId({ personId: targetPersonId, email: targetEmail })
      if (!resolved) {
        return NextResponse.json({ error: 'That person was not found' }, { status: 404 })
      }
      familyMemberId = resolved
    } else if (firstName) {
      // New path: name provided, find or create person
      if (email) {
        // An email can belong to MORE THAN ONE PERSON — a married couple sharing
        // one household address is the normal case, and `getAllPersonsByEmail`
        // exists precisely for that. The old code called the single-owner
        // `getByEmail`, found whoever happened to own the address, and linked to
        // THEM while silently discarding the name that was typed. Adding a
        // husband against his wife's shared address therefore made her her own
        // spouse — and the same email-as-identity assumption once overwrote one
        // spouse's record when the other was added.
        const sharing = await personRepository.getAllPersonsByEmail(email)
        const wanted = `${firstName} ${lastName || ''}`.trim().toLowerCase()
        const match = sharing.find(
          (p) => `${p.firstName} ${p.lastName || ''}`.trim().toLowerCase() === wanted
        )

        if (match) {
          // The named person really is the one who holds this address.
          familyMemberId = match.personId
        } else {
          // Nobody by that NAME holds this address. Whether or not somebody else
          // does, this is a NEW person who happens to share it. Give them their
          // own identity rather than borrowing someone else's.
          const userPerson = me

          // A shared address must not become a second person's PRIMARY: the
          // primary is the sign-in lookup, and two primaries on one address make
          // sign-in choose between people. The person gets a distinct
          // placeholder primary — the same mechanism used for family members
          // with no email — and the SHARED address is added as a secondary so
          // mail still reaches them.
          const keyEmail =
            sharing.length > 0
              ? `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@family.local`
              : email

          const created = await personRepository.create({
            email: keyEmail,
            firstName,
            lastName: lastName || '',
            ecclesia: userPerson?.ecclesia || 'Toronto East',
            memberStatus: getMemberStatusFromRelationship(relationshipType),
          })

          await copyHouseholdContacts(created.personId, sameAddressAs)
          // The member list is cached for 5 minutes. Without this, the person
          // just created is invisible to search — so the next person to look
          // adds them AGAIN, which is the exact duplicate this whole
          // search-first flow exists to prevent.
          invalidatePeopleCache()

          if (keyEmail !== email) {
            try {
              await personRepository.addEmail(created.personId, {
                email: email.toLowerCase(),
                emailType: 'secondary',
                order: 1,
                verified: false,
                sesSubscribed: false,
                sesStatus: 'active',
              })
            } catch (err) {
              // Non-fatal: the person exists and is linked; the shared address
              // can be attached by hand. Better than losing the person again.
              console.error('Failed to attach shared email to new person:', err)
            }
          }

          familyMemberId = created.personId
        }
      } else {
        // No email - create person without email (use generated placeholder)
        const userPerson = me
        const placeholderEmail = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@family.local`

        const createdNoEmail = await personRepository.create({
          email: placeholderEmail,
          firstName,
          lastName: lastName || '',
          ecclesia: userPerson?.ecclesia || 'Toronto East',
          memberStatus: getMemberStatusFromRelationship(relationshipType),
        })
        await copyHouseholdContacts(createdNoEmail.personId, sameAddressAs)
        invalidatePeopleCache()
        familyMemberId = createdNoEmail.personId
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: provide either targetEmail or firstName' },
        { status: 400 }
      )
    }

    // Can't create relationship with yourself
    if (familyMemberId === me.personId) {
      return NextResponse.json(
        { error: 'Cannot create relationship with yourself' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const exists = await relationshipRepository.hasRelationship(
      me.personId,
      familyMemberId,
      relationshipType
    )

    if (exists) {
      return NextResponse.json(
        { error: 'Relationship already exists' },
        { status: 409 }
      )
    }

    // Create bidirectional relationship
    await relationshipRepository.createRelationship(
      me.personId,
      familyMemberId,
      relationshipType
    )

    return NextResponse.json({
      success: true,
      message: 'Relationship created successfully',
    })
  } catch (error) {
    console.error('Create relationship error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Derive member status from relationship type
 */
function getMemberStatusFromRelationship(type: RelationshipType): 'member' | 'visitor' | 'friend' | 'former' {
  switch (type) {
    case 'child':
    case 'grandchild':
      return 'member' // Children are members of the ecclesia
    default:
      return 'member'
  }
}

/**
 * DELETE /api/user/relationships - Remove a family relationship
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetPersonIdParam = searchParams.get('targetPersonId')
    const targetEmail = searchParams.get('targetEmail')
    const relationshipType = searchParams.get('relationshipType') as RelationshipType

    if ((!targetPersonIdParam && !targetEmail) || !relationshipType) {
      return NextResponse.json(
        { error: 'Missing required parameters: targetPersonId, relationshipType' },
        { status: 400 }
      )
    }

    // Validate relationship type
    if (!validRelationshipTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const me = await resolveSessionPerson(session.user.email)
    const targetPersonId = await resolvePersonId({ personId: targetPersonIdParam, email: targetEmail })
    if (!me || !targetPersonId) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 })
    }

    // Check if relationship exists
    const exists = await relationshipRepository.hasRelationship(
      me.personId,
      targetPersonId,
      relationshipType
    )

    if (!exists) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      )
    }

    // Soft delete (marks as removed)
    await relationshipRepository.removeRelationship(
      me.personId,
      targetPersonId,
      relationshipType
    )

    return NextResponse.json({
      success: true,
      message: 'Relationship removed successfully',
    })
  } catch (error) {
    console.error('Delete relationship error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
