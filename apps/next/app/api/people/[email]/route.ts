import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { ContactRequestType } from '@my/app/provider/dynamodb/types'
import { getEcclesiaByName } from '../../../../utils/dynamodb/locations'
import { invalidatePeopleCache } from '../cache'

interface MemberProfile {
  email: string
  name?: string
  firstName?: string
  lastName?: string
  ecclesia?: string
  ecclesiaInfo?: {
    city: string
    province: string
    country: string
    venue?: string
    address?: string
  }
  isInterEcclesia?: boolean
  isPrivate?: boolean
  isDeceased?: boolean
  canEdit?: boolean
  availableContactMethods?: ContactRequestType[]
  role?: string
  canSetRole?: boolean
  allowedRoles?: string[]
  emails?: Array<{
    email: string
    emailType: string
  }>
  phones?: Array<{
    type: string
    number: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  addresses?: Array<{
    type: string
    label?: string
    street1: string
    street2?: string
    city: string
    province: string
    postalCode: string
    country: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  family?: Array<{
    email: string
    name?: string
    relationshipType: string
  }>
  permissions: {
    canViewName: boolean
    canViewPhone: boolean
    canViewAddress: boolean
    canViewEmail: boolean
    canViewFamily: boolean
    canRequestContact: boolean
  }
}

/**
 * GET /api/people/[email] - Get a member's profile with privacy-aware data
 * Sources from PersonRecords (tee-admin PERSON# items)
 * Looks up by any email via GSI1, returns full profile with privacy filtering.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { email: targetEmail } = await params
    const decodedEmail = decodeURIComponent(targetEmail).trim().toLowerCase()
    const viewerEmail = session.user.email
    const viewerRole = (session.user as any).role as string || ROLES.GUEST
    const isOwnProfile = viewerEmail.toLowerCase() === decodedEmail

    // Look up target person via GSI1 (O(1) by any email)
    const targetPerson = await personRepository.getByEmail(decodedEmail)

    if (!targetPerson) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Look up viewer's ecclesia for privacy checks
    const viewerPerson = isOwnProfile ? targetPerson : await personRepository.getByEmail(viewerEmail)
    const viewerEcclesia = viewerPerson?.ecclesia
    const targetEcclesia = targetPerson.ecclesia

    // Get privacy-aware permissions
    const permissions = await privacyRepository.getVisibleFields(
      viewerEmail,
      targetPerson.primaryEmail,
      viewerEcclesia,
      targetEcclesia,
      viewerRole
    )

    const displayName = targetPerson.displayName
      || [targetPerson.firstName, targetPerson.lastName].filter(Boolean).join(' ')
      || targetPerson.primaryEmail

    // Check if fully private (no fields visible at all)
    const isFullyPrivate = !isOwnProfile &&
      !permissions.canViewName &&
      !permissions.canViewPhone &&
      !permissions.canViewAddress &&
      !permissions.canViewEmail &&
      !permissions.canViewFamily

    const isDeceased = targetPerson.role === ROLES.DECEASED

    // Build profile — name and ecclesia are directory-level public info,
    // not gated by privacy (they're already visible in listings and the URL)
    const profile: MemberProfile = {
      email: targetPerson.primaryEmail,
      name: displayName,
      ecclesia: targetPerson.ecclesia,
      isPrivate: isFullyPrivate,
      isDeceased,
      permissions,
    }

    // Include enriched ecclesia data when available
    const isInterEcclesia = !isOwnProfile && !!viewerEcclesia && !!targetEcclesia && viewerEcclesia !== targetEcclesia
    if (isInterEcclesia) {
      profile.isInterEcclesia = true
    }
    if (targetEcclesia) {
      const ecclesiaData = await getEcclesiaByName(targetEcclesia)
      if (ecclesiaData) {
        profile.ecclesiaInfo = {
          city: ecclesiaData.city,
          province: ecclesiaData.province,
          country: ecclesiaData.country,
          venue: ecclesiaData.venue,
          address: ecclesiaData.address,
        }
      }
    }

    // Fetch phones from PERSON# partition (single source of truth)
    const personPhones = await personRepository.getPhones(targetPerson.personId)
    const hasPhones = personPhones.length > 0

    // Determine available contact methods for contact request UI
    if (!isOwnProfile && permissions.canRequestContact) {
      const methods: ContactRequestType[] = []
      if (hasPhones) {
        methods.push('phone')
        methods.push('text')
      }
      methods.push('email')
      profile.availableContactMethods = methods
    }

    // Emails (privacy gated)
    if (permissions.canViewEmail) {
      const emailRecords = await personRepository.getEmails(targetPerson.personId)
      profile.emails = emailRecords.map(e => ({
        email: e.email,
        emailType: e.emailType,
      }))
    }

    // Phones (privacy gated)
    if (permissions.canViewPhone && personPhones.length > 0) {
      profile.phones = personPhones.map(p => ({
        type: p.type,
        number: p.number,
        isPrimary: p.isPrimary,
        isHousehold: p.isHousehold,
      }))
    }

    // Addresses (privacy gated)
    if (permissions.canViewAddress) {
      const addressRecords = await personRepository.getAddresses(targetPerson.personId)
      profile.addresses = addressRecords.map(a => ({
        type: a.type,
        label: a.label,
        street1: a.street1,
        street2: a.street2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        isPrimary: a.isPrimary,
        isHousehold: a.isHousehold,
      }))
    }

    // Family members (privacy gated)
    if (permissions.canViewFamily) {
      // TODO: Wire up relationship repository when available
      profile.family = []
    }

    // Admin data for Owner/Admin viewers
    if (viewerRole === ROLES.OWNER || viewerRole === ROLES.ADMIN) {
      profile.firstName = targetPerson.firstName
      profile.lastName = targetPerson.lastName
      profile.canEdit = !isOwnProfile

      profile.role = targetPerson.role || ROLES.GUEST
      profile.canSetRole = !isOwnProfile
      if (viewerRole === ROLES.OWNER) {
        profile.allowedRoles = [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
      } else {
        profile.allowedRoles = [ROLES.ADMIN, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
      }
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error('Get member profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/people/[email] - Admin direct edit for name & ecclesia
 * Only Owner/Admin can use this endpoint.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const viewerRole = (session.user as any).role as string || ROLES.GUEST
    if (viewerRole !== ROLES.OWNER && viewerRole !== ROLES.ADMIN) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { email: targetEmail } = await params
    const decodedEmail = decodeURIComponent(targetEmail).trim().toLowerCase()

    // Don't allow editing own profile via this endpoint
    if (session.user.email.toLowerCase() === decodedEmail) {
      return NextResponse.json(
        { error: 'Use the profile page to edit your own profile' },
        { status: 400 }
      )
    }

    const targetPerson = await personRepository.getByEmail(decodedEmail)
    if (!targetPerson) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, ecclesia } = body as {
      firstName?: string
      lastName?: string
      ecclesia?: string
    }

    // Build updates object with only provided fields
    const updates: Record<string, string> = {}
    if (firstName !== undefined) updates.firstName = firstName.trim()
    if (lastName !== undefined) updates.lastName = lastName.trim()
    if (ecclesia !== undefined) updates.ecclesia = ecclesia.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // updatePerson auto-recalculates displayName, GSI2, GSI3 keys
    const updated = await personRepository.updatePerson(targetPerson.personId, updates)

    // Invalidate the people list cache so the change is visible immediately
    invalidatePeopleCache()

    return NextResponse.json({
      success: true,
      profile: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        name: updated.displayName,
        ecclesia: updated.ecclesia,
      },
    })
  } catch (error) {
    console.error('Admin edit profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
