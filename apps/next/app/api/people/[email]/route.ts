import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { connectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { ContactRequestType } from '@my/app/provider/dynamodb/types'
import { getEcclesiaByName } from '../../../../utils/dynamodb/locations'
import { invalidatePeopleCache } from '../cache'

interface MemberProfile {
  email: string
  personId?: string
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
    recordingBrotherEmail?: string
    recordingBrotherName?: string
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
    emailId?: string
  }>
  phones?: Array<{
    phoneId?: string
    type: string
    number: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  addresses?: Array<{
    addressId?: string
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
    personId?: string
    relationshipType: string
  }>
  privacy?: {
    showName: string
    showEmail: string
    showPhone: string
    showAddress: string
    showFamily: string
  }
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'self'
  needsConnection?: boolean
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

    // Require at least member role
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json(
        { error: 'Member access required' },
        { status: 403 }
      )
    }

    const { email: paramValue } = await params
    const decodedParam = decodeURIComponent(paramValue).trim()
    const viewerEmail = session.user.email
    const viewerRole = (session.user as any).role as string || ROLES.GUEST
    const viewerIsRecordingBrother = !!(session.user as any).isRecordingBrother

    // Detect if param is a UUID (personId) or an email
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedParam)

    let targetPerson
    if (isUUID) {
      targetPerson = await personRepository.getById(decodedParam)
    } else {
      // Legacy email-based lookup (backward compat)
      const decodedEmail = decodedParam.toLowerCase()
      targetPerson = await personRepository.getByEmail(decodedEmail)
      if (!targetPerson) {
        const persons = await personRepository.getAllPersonsByEmail(decodedEmail)
        targetPerson = persons[0] || null
      }
    }

    if (!targetPerson) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    const isOwnProfile = viewerEmail.toLowerCase() === targetPerson.primaryEmail.toLowerCase()

    // Look up viewer's ecclesia for privacy checks (try primary, then secondary email)
    let viewerPerson = isOwnProfile ? targetPerson : await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson && !isOwnProfile) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
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

    // Include inter-ecclesia flag
    const isInterEcclesia = !isOwnProfile && !!viewerEcclesia && !!targetEcclesia && viewerEcclesia !== targetEcclesia
    if (isInterEcclesia) {
      profile.isInterEcclesia = true
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
        ...(profile.canEdit ? { emailId: e.emailId } : {}),
      }))
    }

    // Phones (privacy gated)
    if (permissions.canViewPhone && personPhones.length > 0) {
      profile.phones = personPhones.map(p => ({
        type: p.type,
        number: p.number,
        isPrimary: p.isPrimary,
        isHousehold: p.isHousehold,
        ...(profile.canEdit ? { phoneId: p.phoneId } : {}),
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
        ...(profile.canEdit ? { addressId: a.addressId } : {}),
      }))
    }

    // Family members (privacy gated)
    if (permissions.canViewFamily) {
      const familyRecords = await relationshipRepository.getFamilyMembers(targetPerson.primaryEmail)
      // Resolve names from person records — never expose raw emails
      const familyWithNames = await Promise.all(
        familyRecords.map(async (rel) => {
          let name: string | undefined
          let personId: string | undefined
          try {
            const person = await personRepository.getByEmail(rel.targetEmail)
            if (person) {
              name = person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || undefined
              personId = person.personId
            }
          } catch { /* person not found */ }
          return {
            email: rel.targetEmail,
            name,
            personId,
            relationshipType: rel.relationshipType,
          }
        })
      )
      profile.family = familyWithNames
    }

    // Admin data for Owner/Admin viewers
    if (viewerRole === ROLES.OWNER || viewerRole === ROLES.ADMIN) {
      profile.firstName = targetPerson.firstName
      profile.lastName = targetPerson.lastName
      profile.canEdit = !isOwnProfile
      if (!isOwnProfile) {
        profile.personId = targetPerson.personId
      }

      profile.role = targetPerson.role || ROLES.GUEST
      profile.canSetRole = !isOwnProfile
      if (viewerRole === ROLES.OWNER) {
        profile.allowedRoles = [ROLES.OWNER, ROLES.ADMIN, ROLES.RECORDER, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
      } else {
        profile.allowedRoles = [ROLES.ADMIN, ROLES.RECORDER, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
      }
    }

    // Recorder/Rep/RB data — same-ecclesia members only
    const isRecorderOrRepRole = viewerIsRecordingBrother || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP
    if (isRecorderOrRepRole && !isOwnProfile) {
      const isSameEcclesia = viewerEcclesia && targetEcclesia && viewerEcclesia === targetEcclesia
      if (isSameEcclesia) {
        profile.firstName = targetPerson.firstName
        profile.lastName = targetPerson.lastName
        profile.canEdit = true
        profile.personId = targetPerson.personId
        profile.role = targetPerson.role || ROLES.GUEST
        profile.canSetRole = true
        if (viewerIsRecordingBrother || viewerRole === ROLES.RECORDER) {
          profile.allowedRoles = [ROLES.RECORDER, ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
        } else {
          profile.allowedRoles = [ROLES.REP, ROLES.MEMBER, ROLES.GUEST, ROLES.DECEASED]
        }
      }
    }

    // Include raw privacy settings for admin/recorder/rep/RB viewers
    // so the detail page can show privacy indicator dots next to each section
    const isPrivilegedViewer = viewerRole === ROLES.OWNER || viewerRole === ROLES.ADMIN ||
      viewerIsRecordingBrother || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP
    if (isPrivilegedViewer && !isOwnProfile) {
      const isSameEcclesiaForPrivacy = viewerEcclesia && targetEcclesia && viewerEcclesia === targetEcclesia
      // Owner/Admin see all; Recorder/Rep only see same-ecclesia
      if (viewerRole === ROLES.OWNER || viewerRole === ROLES.ADMIN || isSameEcclesiaForPrivacy) {
        const privacySettings = await privacyRepository.getPrivacySettings(targetPerson.primaryEmail)
        profile.privacy = {
          showName: privacySettings.showName || 'private',
          showEmail: privacySettings.showEmail || 'private',
          showPhone: privacySettings.showPhone || 'private',
          showAddress: privacySettings.showAddress || 'private',
          showFamily: privacySettings.showFamily || 'private',
        }
      }
    }

    // Connection status and needsConnection for Connect button
    if (isOwnProfile) {
      profile.connectionStatus = 'self'
      profile.needsConnection = false
    } else {
      const connStatus = await connectionRepository.getConnectionStatus(viewerEmail, targetPerson.primaryEmail)
      profile.connectionStatus = connStatus === 'blocked' ? 'none' : connStatus

      // needsConnection = true when Connect button should show
      if (connStatus === 'none') {
        const targetPrivacy = await privacyRepository.getPrivacySettings(targetPerson.primaryEmail)
        profile.needsConnection = targetPrivacy.allowConnectionRequests !== false
      } else {
        profile.needsConnection = false
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
    const viewerIsRB = !!(session.user as any).isRecordingBrother
    const canEditRoles = [ROLES.OWNER, ROLES.ADMIN, ROLES.RECORDER, ROLES.REP]
    if (!canEditRoles.includes(viewerRole) && !viewerIsRB) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { email: paramValue } = await params
    const decodedParam = decodeURIComponent(paramValue).trim()
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedParam)

    let targetPerson
    if (isUUID) {
      targetPerson = await personRepository.getById(decodedParam)
    } else {
      const decodedEmail = decodedParam.toLowerCase()
      targetPerson = await personRepository.getByEmail(decodedEmail)
      if (!targetPerson) {
        const persons = await personRepository.getAllPersonsByEmail(decodedEmail)
        targetPerson = persons[0] || null
      }
    }

    if (!targetPerson) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Don't allow editing own profile via this endpoint
    if (session.user.email.toLowerCase() === targetPerson.primaryEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'Use the profile page to edit your own profile' },
        { status: 400 }
      )
    }

    // Recorder/Rep/RB: enforce same-ecclesia restriction
    if (viewerIsRB || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP) {
      const viewerPerson = await personRepository.getByEmail(session.user.email)
      if (!viewerPerson || viewerPerson.ecclesia !== targetPerson.ecclesia) {
        return NextResponse.json(
          { error: 'You can only edit members of your own ecclesia' },
          { status: 403 }
        )
      }
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
