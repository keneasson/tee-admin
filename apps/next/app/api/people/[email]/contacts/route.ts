import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
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

        // Send verification email to the NEW email address
        try {
          const token = randomBytes(32).toString('hex')
          const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

          // Store verification token on the USER# email record (legacy system)
          // so the existing /api/user/emails/verify?token=xxx callback can find it
          await userRepository.addEmail(targetPerson.primaryEmail, {
            emailId: record.emailId,
            email: email.toLowerCase().trim(),
            verified: false,
            order: existingEmails.length,
            verificationToken: token,
            verificationTokenExpiry: expiry,
            verificationSentAt: new Date().toISOString(),
          })

          await sendAdminAddedEmailVerification({
            newEmail: email.toLowerCase().trim(),
            personName,
            verificationToken: token,
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
        const record = await personRepository.addPhone(targetPerson.personId, {
          type: phoneType,
          number: number.trim(),
        })
        return NextResponse.json({ success: true, record: { phoneId: record.phoneId, type: record.type, number: record.number } })
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
        const record = await personRepository.addAddress(targetPerson.personId, {
          type: addressType,
          street1: street1.trim(),
          street2: street2?.trim(),
          city: city.trim(),
          province: province.trim(),
          postalCode: postalCode.trim(),
          country: country?.trim() || 'Canada',
        })
        return NextResponse.json({ success: true, record: { addressId: record.addressId, type: record.type, street1: record.street1, city: record.city } })
      }

      case 'relationship': {
        const { targetEmail, relationshipType } = body as { targetEmail: string; relationshipType: RelationshipType }
        if (!targetEmail || !targetEmail.includes('@')) {
          return NextResponse.json({ error: 'Valid target email is required' }, { status: 400 })
        }
        const validRelTypes: RelationshipType[] = ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'extended_family', 'household_member']
        if (!validRelTypes.includes(relationshipType)) {
          return NextResponse.json({ error: 'Invalid relationship type' }, { status: 400 })
        }
        await relationshipRepository.createRelationship(
          targetPerson.primaryEmail,
          targetEmail.toLowerCase().trim(),
          relationshipType
        )
        return NextResponse.json({ success: true })
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
