import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { invalidatePeopleCache } from '../../cache'
import { sendEmailChangeNotification, sendAdminAddedEmailVerification } from '../../../../../utils/email/send-email-change-notification'
import type { AddressType, PhoneType, RelationshipType } from '@my/app/provider/dynamodb/types'

/**
 * Resolve the target person from the URL param (UUID or email).
 * Mirrors the pattern used in the parent route.ts PATCH handler.
 */
async function resolveTarget(paramValue: string) {
  const decoded = decodeURIComponent(paramValue).trim()
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)

  if (isUUID) {
    return personRepository.getById(decoded)
  }

  const email = decoded.toLowerCase()
  let person = await personRepository.getByEmail(email)
  if (!person) {
    const persons = await personRepository.getAllPersonsByEmail(email)
    person = persons[0] || null
  }
  return person
}

/**
 * Verify the caller has admin-level permission to edit the target person.
 * Returns { allowed: true, viewerRole } on success, or a NextResponse error.
 */
/**
 * Copy the household address and the home phone from one person to another.
 *
 * A couple shares a home, so entering the address and the landline twice is
 * duplicate work that also creates two copies to drift apart. Only the HOME
 * number travels — a mobile belongs to a person, not a household.
 *
 * Best-effort: failing to copy an address must never lose the person, which is
 * the outcome that actually hurts.
 */
async function copyHouseholdContacts(newPersonId: string, sourcePersonId: string) {
  try {
    const [addresses, phones] = await Promise.all([
      personRepository.getAddresses(sourcePersonId),
      personRepository.getPhones(sourcePersonId),
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

async function checkPermission(session: any, targetPerson: any) {
  const viewerEmail = session.user.email
  const viewerRole = (session.user as any).role as string || ROLES.GUEST
  const viewerIsRB = !!(session.user as any).isRecordingBrother
  const canEditRoles = [ROLES.OWNER, ROLES.ADMIN, ROLES.RECORDER, ROLES.REP]

  if (!canEditRoles.includes(viewerRole) && !viewerIsRB) {
    return { allowed: false as const, response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }

  if (viewerEmail.toLowerCase() === targetPerson.primaryEmail.toLowerCase()) {
    return { allowed: false as const, response: NextResponse.json({ error: 'Use the profile page to edit your own contact info' }, { status: 400 }) }
  }

  // Recorder/Rep/RB: same-ecclesia only
  let viewerPerson = null
  if (viewerIsRB || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP) {
    viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson || viewerPerson.ecclesia !== targetPerson.ecclesia) {
      return { allowed: false as const, response: NextResponse.json({ error: 'You can only edit members of your own ecclesia' }, { status: 403 }) }
    }
  }

  // Resolve viewer name for email notifications
  if (!viewerPerson) {
    viewerPerson = await personRepository.getByEmail(viewerEmail)
  }
  const viewerName = viewerPerson?.displayName
    || [viewerPerson?.firstName, viewerPerson?.lastName].filter(Boolean).join(' ')
    || 'An administrator'

  return { allowed: true as const, viewerRole, viewerName }
}

/**
 * POST /api/people/[email]/contacts - Add contact info (email, phone, address, relationship)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { email: paramValue } = await params
    const targetPerson = await resolveTarget(paramValue)
    if (!targetPerson) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const permResult = await checkPermission(session, targetPerson)
    if (!permResult.allowed) {
      return permResult.response
    }

    const body = await request.json()
    const { type } = body as { type: string }

    switch (type) {
      case 'email': {
        const { email, emailType = 'secondary' } = body as { email: string; emailType?: 'primary' | 'secondary' | 'archived' }
        if (!email || !email.includes('@')) {
          return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })
        }
        const existingEmails = await personRepository.getEmails(targetPerson.personId)
        const record = await personRepository.addEmail(targetPerson.personId, {
          email: email.toLowerCase().trim(),
          emailType,
          order: existingEmails.length,
          verified: false,
          sesSubscribed: false,
          sesStatus: 'active',
        })
        invalidatePeopleCache()

        // Resolve target person's display name for email templates
        const personName = targetPerson.displayName
          || [targetPerson.firstName, targetPerson.lastName].filter(Boolean).join(' ')
          || 'Member'

        // Send verification email to the NEW email address. Mint a single-use
        // token in the unified TokenRepository so the /api/user/emails/verify?token
        // callback resolves it (O(1) GSI4) and marks the PersonRecord EMAIL# row
        // verified — no legacy USER# token write.
        try {
          const token = await tokenRepository.createEmailVerification(
            targetPerson.personId,
            email.toLowerCase().trim()
          )

          await sendAdminAddedEmailVerification({
            newEmail: email.toLowerCase().trim(),
            personName,
            verificationToken: token.tokenValue,
            addedByName: permResult.viewerName,
          })
        } catch (verifyError) {
          console.error('Failed to send verification to new email:', verifyError)
          // Don't fail the add — the email was added successfully, verification can be retried
        }

        // Send change notification to ALL existing email addresses
        for (const existingEmail of existingEmails) {
          try {
            await sendEmailChangeNotification({
              oldEmail: existingEmail.email,
              newEmail: email.toLowerCase().trim(),
              personName,
              changedByName: permResult.viewerName,
            })
          } catch (notifyError) {
            console.error(`Failed to send change notification to ${existingEmail.email}:`, notifyError)
            // Best-effort — don't fail the request
          }
        }

        return NextResponse.json({ success: true, record: { email: record.email, emailType: record.emailType, emailId: record.emailId } })
      }

      case 'phone': {
        const { phoneType, number } = body as { phoneType: PhoneType; number: string }
        if (!number || number.trim().length < 7) {
          return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 })
        }
        const validPhoneTypes: PhoneType[] = ['mobile', 'home', 'work', 'other']
        if (!validPhoneTypes.includes(phoneType)) {
          return NextResponse.json({ error: 'Phone type must be mobile, home, work, or other' }, { status: 400 })
        }
        // PROPOSE, like addresses: a changed number that nobody confirmed is
        // shown next to the one it would replace, not silently swapped in.
        const existingPhones = await personRepository.getPhones(targetPerson.personId)
        const supersedesPhone = (body as { supersedesId?: string }).supersedesId
          || existingPhones.find((ph) => ph.isPrimary && ph.verified !== false)?.phoneId

        const record = await personRepository.proposePhone(
          targetPerson.personId,
          { type: phoneType, number: number.trim() },
          session.user.email,
          supersedesPhone
        )
        return NextResponse.json({
          success: true,
          pending: true,
          record: {
            phoneId: record.phoneId,
            type: record.type,
            number: record.number,
            verified: false,
            supersedesId: record.supersedesId,
          },
        })
      }

      case 'address': {
        const { addressType, street1, street2, city, province, postalCode, country } = body as {
          addressType: AddressType; street1: string; street2?: string; city: string; province: string; postalCode: string; country?: string
        }
        if (!street1 || !city || !province || !postalCode) {
          return NextResponse.json({ error: 'Street, city, province, and postal code are required' }, { status: 400 })
        }
        const validAddressTypes: AddressType[] = ['home', 'residence', 'work', 'mailing', 'other']
        if (!validAddressTypes.includes(addressType)) {
          return NextResponse.json({ error: 'Address type must be home, residence, work, mailing, or other' }, { status: 400 })
        }
        // PROPOSE, do not overwrite. The existing address stays primary and
        // visible until somebody entitled to confirm it does — otherwise a
        // change is invisible and people drive to the old house.
        const existingAddresses = await personRepository.getAddresses(targetPerson.personId)
        const supersedes = (body as { supersedesId?: string }).supersedesId
          || existingAddresses.find((a) => a.isPrimary && a.verified !== false)?.addressId

        const record = await personRepository.proposeAddress(targetPerson.personId, {
          type: addressType,
          street1: street1.trim(),
          street2: street2?.trim(),
          city: city.trim(),
          province: province.trim(),
          postalCode: postalCode.trim(),
          country: country?.trim() || 'Canada',
        }, session.user.email, supersedes)
        return NextResponse.json({
          success: true,
          pending: true,
          record: {
            addressId: record.addressId,
            type: record.type,
            street1: record.street1,
            city: record.city,
            verified: false,
            supersedesId: record.supersedesId,
          },
        })
      }

      case 'relationship': {
        const { targetEmail, relationshipType, firstName, lastName, sameAddress } = body as {
          targetEmail?: string
          relationshipType: RelationshipType
          firstName?: string
          lastName?: string
          sameAddress?: boolean
        }

        const validRelTypes: RelationshipType[] = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'extended_family', 'household_member']
        if (!validRelTypes.includes(relationshipType)) {
          return NextResponse.json({ error: 'Invalid relationship type' }, { status: 400 })
        }

        // Linking an EXISTING person.
        if (targetEmail) {
          if (!targetEmail.includes('@')) {
            return NextResponse.json({ error: 'Valid target email is required' }, { status: 400 })
          }
          await relationshipRepository.createRelationship(
            targetPerson.primaryEmail,
            targetEmail.toLowerCase().trim(),
            relationshipType
          )
          return NextResponse.json({ success: true })
        }

        // Creating somebody NEW and linking them.
        //
        // This has to live here rather than on /api/user/relationships, which is
        // the signed-in user's OWN family and hardcodes `session.user.email` as
        // the source. Posting there from a profile page linked the new person to
        // whoever was signed in instead of to the person being viewed — which is
        // how Brian Rose ended up as the spouse of the admin who added him.
        if (!firstName?.trim()) {
          return NextResponse.json(
            { error: 'Provide either targetEmail (an existing person) or firstName (a new one)' },
            { status: 400 }
          )
        }

        // Relationships are keyed by email, so somebody with no address of their
        // own — or who shares one — needs a distinct key address. Same mechanism
        // already used for family members without email.
        const keyEmail = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@family.local`
        const createdPerson = await personRepository.create({
          email: keyEmail,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || '',
          ecclesia: targetPerson.ecclesia || 'Toronto East',
          memberStatus: targetPerson.memberStatus,
        })

        if (sameAddress) {
          await copyHouseholdContacts(createdPerson.personId, targetPerson.personId)
        }

        await relationshipRepository.createRelationship(
          targetPerson.primaryEmail,
          keyEmail,
          relationshipType
        )

        // Without this the new person is invisible to search for 5 minutes, so
        // the next person to look adds them again (#238).
        invalidatePeopleCache()

        return NextResponse.json({
          success: true,
          created: { personId: createdPerson.personId, name: `${firstName} ${lastName || ''}`.trim() },
        })
      }

      default:
        return NextResponse.json({ error: 'Type must be email, phone, address, or relationship' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin add contact info error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/people/[email]/contacts - Remove contact info
 * Query params: type=email&id=xxx | type=phone&id=xxx | type=address&id=xxx | type=relationship&targetEmail=xxx&relationshipType=spouse
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { email: paramValue } = await params
    const targetPerson = await resolveTarget(paramValue)
    if (!targetPerson) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const permResult = await checkPermission(session, targetPerson)
    if (!permResult.allowed) {
      return permResult.response
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id')

    switch (type) {
      case 'email': {
        if (!id) return NextResponse.json({ error: 'Email id is required' }, { status: 400 })
        await personRepository.removeEmail(targetPerson.personId, id)
        invalidatePeopleCache()
        return NextResponse.json({ success: true })
      }

      case 'phone': {
        if (!id) return NextResponse.json({ error: 'Phone id is required' }, { status: 400 })
        await personRepository.deletePhone(targetPerson.personId, id)
        return NextResponse.json({ success: true })
      }

      case 'address': {
        if (!id) return NextResponse.json({ error: 'Address id is required' }, { status: 400 })
        await personRepository.deleteAddress(targetPerson.personId, id)
        return NextResponse.json({ success: true })
      }

      case 'relationship': {
        const targetEmail = url.searchParams.get('targetEmail')
        const relType = url.searchParams.get('relationshipType') as RelationshipType
        if (!targetEmail || !relType) {
          return NextResponse.json({ error: 'targetEmail and relationshipType are required' }, { status: 400 })
        }
        await relationshipRepository.removeRelationship(
          targetPerson.primaryEmail,
          targetEmail,
          relType
        )
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Type must be email, phone, address, or relationship' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin delete contact info error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH — confirm a proposed contact change.
 *
 * Body: `{ type: 'address' | 'phone', id: string }`
 *
 * Gated by the SAME `checkPermission` used for editing, which already allows
 * owner, admin, Recording Brother and Rep — the people who would actually know
 * whether an address is right. Confirming promotes the proposal to primary and
 * removes the value it replaced.
 *
 * This exists because the only approval path was an emailed token aimed at the
 * profile owner. For a 92-year-old member that is the wrong mechanism: the
 * people who can confirm her address are her Recording Brother and her Rep, in
 * the app, not her clicking a link in an email.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await params
    const targetPerson = await personRepository.getByEmail(decodeURIComponent(email))
    if (!targetPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const permResult = await checkPermission(session, targetPerson)
    if (!permResult.allowed) {
      return permResult.response
    }

    const body = await request.json()
    const { type, id } = body as { type?: string; id?: string }
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    switch (type) {
      case 'address': {
        const record = await personRepository.verifyAddress(
          targetPerson.personId,
          id,
          session.user.email
        )
        // The value is settled by someone with authority, so the community
        // confirmations about it are spent. Leaving them would keep a stale
        // progress count on a confirmed value and let a recycled id inherit
        // somebody else's votes.
        await personRepository.clearContactVotes(targetPerson.personId, 'address', id)
        return NextResponse.json({ success: true, verified: true, record })
      }
      case 'phone': {
        const record = await personRepository.verifyPhone(
          targetPerson.personId,
          id,
          session.user.email
        )
        await personRepository.clearContactVotes(targetPerson.personId, 'phone', id)
        return NextResponse.json({ success: true, verified: true, record })
      }
      default:
        return NextResponse.json(
          { error: "type must be 'address' or 'phone'" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error verifying contact change:', error)
    return NextResponse.json({ error: 'Failed to verify change' }, { status: 500 })
  }
}
