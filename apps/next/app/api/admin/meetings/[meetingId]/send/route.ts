import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'
import { render } from '@react-email/render'
import { createElement } from 'react'
import MeetingEmail from 'email-builder/emails/MeetingEmail'
import { emailSend } from '@/utils/email/email-send'
import { meetingRecordToEmailProps } from '@/utils/email/meeting-email-helpers'
import { canAuthorForEcclesia } from '@/utils/ecclesia-permissions'

export const config = {
  maxDuration: 60,
}

/**
 * POST /api/admin/meetings/[meetingId]/send - Send meeting email
 * Query param: test=true to send to test list only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { meetingId } = await params
    const { searchParams } = new URL(request.url)
    const isTest = searchParams.get('test') === 'true'

    const meeting = await meetingRepository.getById(meetingId)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Ecclesia-scoped authorization against the meeting's owner.
    if (meeting.ownerType === 'ecclesia') {
      const canSend = await canAuthorForEcclesia(session.user.email, userRole, meeting.ownerName)
      if (!canSend) {
        return NextResponse.json(
          { error: `You do not have permission to manage content for ${meeting.ownerName}.` },
          { status: 403 }
        )
      }
    } else if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Map MeetingRecord to MeetingEmail props
    const emailProps = meetingRecordToEmailProps(meeting)

    // Render meeting email template (using createElement to avoid JSX in .ts file)
    const emailElement = createElement(MeetingEmail as any, emailProps)
    const emailHtml = await render(emailElement)
    const emailText = await render(emailElement, { plainText: true })

    // Resolve audience to contact list
    let customList: string | undefined
    if (meeting.audience.type === 'ses_topic') {
      customList = meeting.audience.topic
    } else if (meeting.audience.type === 'ecclesia_members') {
      customList = 'members'
    }

    const result = await emailSend({
      reason: 'business-meeting',
      emailHtml,
      emailText,
      test: isTest,
      customList,
      customSubject: meeting.title,
      subReason: 'general',
      description: `Meeting: ${meeting.title}`,
      sentBy: session.user.email,
    })

    if (result instanceof Error) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    // Update meeting with last sent timestamp
    await meetingRepository.updateMeeting(meetingId, {
      lastSentAt: new Date().toISOString(),
      lastSentOccurrence: meeting.nextOccurrence || meeting.oneOffDate,
    })

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      sentCount: result.sends.length,
      skippedCount: result.skips.length,
    })
  } catch (error) {
    console.error('Error sending meeting email:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send meeting email' },
      { status: 500 }
    )
  }
}
