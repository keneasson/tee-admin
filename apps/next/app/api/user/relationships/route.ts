import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'

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

    const familyMembers = await relationshipRepository.getFamilyMembers(session.user.email)

    // Look up names for each family member
    const relationshipsWithNames = await Promise.all(
      familyMembers.map(async (rel) => {
        let name: string | undefined
        let personId: string | undefined
        try {
          const person = await personRepository.getByEmail(rel.targetEmail)
          if (person) {
            name = person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim()
            personId = person.personId
          }
        } catch {
          // If lookup fails, just use email
        }
        return {
          email: rel.targetEmail,
          name,
          personId,
          relationshipType: rel.relationshipType,
          status: rel.status,
          createdAt: rel.createdAt,
        }
      })
    )

    return NextResponse.json({
      success: true,
      relationships: relationshipsWithNames,
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
 * Accepts either:
 * - { targetEmail, relationshipType } - Link to existing person by email
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
    const { firstName, lastName, email, targetEmail, relationshipType, sameAddressAs } = body

    // Validate relationship type
    if (!relationshipType || !validRelationshipTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Determine the target email - either provided directly or we need to find/create person
    let familyMemberEmail: string

    if (targetEmail) {
      // Legacy path: direct email provided
      familyMemberEmail = targetEmail
    } else if (firstName) {
      // New path: name provided, find or create person
      if (email) {
        // An email can belong to MORE THAN ONE PERSON — a married couple sharing
        // one household address is the normal case, and `getAllPersonsByEmail`
        // exists precisely for that. The old code called the single-owner
        // `getByEmail`, found whoever happened to own the address, and linked to
        // THEM while silently discarding the name that was typed. Adding
        // "Brian" against his wife's shared address therefore made Georgina her
        // own spouse — and, historically, the same email-as-identity assumption
        // is what overwrote Brian's record when Georgina was added.
        const sharing = await personRepository.getAllPersonsByEmail(email)
        const wanted = `${firstName} ${lastName || ''}`.trim().toLowerCase()
        const match = sharing.find(
          (p) => `${p.firstName} ${p.lastName || ''}`.trim().toLowerCase() === wanted
        )

        if (match) {
          // The named person really is the one who holds this address.
          familyMemberEmail = match.primaryEmail
        } else {
          // Nobody by that NAME holds this address. Whether or not somebody else
          // does, this is a NEW person who happens to share it. Give them their
          // own identity rather than borrowing someone else's.
          const userPerson = await personRepository.getByEmail(session.user.email)

          // Relationships are keyed by email (RelationshipRecord PK/SK), so two
          // people sharing one address cannot both be addressed by it. The
          // person gets a distinct key address — the same mechanism already used
          // for family members with no email — and the SHARED address is added
          // as a secondary so it still reaches them.
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

          familyMemberEmail = keyEmail
        }
      } else {
        // No email - create person without email (use generated placeholder)
        const userPerson = await personRepository.getByEmail(session.user.email)
        const placeholderEmail = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@family.local`

        const createdNoEmail = await personRepository.create({
          email: placeholderEmail,
          firstName,
          lastName: lastName || '',
          ecclesia: userPerson?.ecclesia || 'Toronto East',
          memberStatus: getMemberStatusFromRelationship(relationshipType),
        })
        await copyHouseholdContacts(createdNoEmail.personId, sameAddressAs)
        familyMemberEmail = placeholderEmail
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: provide either targetEmail or firstName' },
        { status: 400 }
      )
    }

    // Can't create relationship with yourself
    if (familyMemberEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot create relationship with yourself' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const exists = await relationshipRepository.hasRelationship(
      session.user.email,
      familyMemberEmail,
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
      session.user.email,
      familyMemberEmail,
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
    const targetEmail = searchParams.get('targetEmail')
    const relationshipType = searchParams.get('relationshipType') as RelationshipType

    if (!targetEmail || !relationshipType) {
      return NextResponse.json(
        { error: 'Missing required parameters: targetEmail, relationshipType' },
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

    // Check if relationship exists
    const exists = await relationshipRepository.hasRelationship(
      session.user.email,
      targetEmail,
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
      session.user.email,
      targetEmail,
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
