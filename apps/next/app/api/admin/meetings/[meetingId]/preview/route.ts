import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'
import { render } from '@react-email/render'
import { createElement } from 'react'
import MeetingEmail from 'email-builder/emails/MeetingEmail'
import { meetingRecordToEmailProps } from '@/utils/email/meeting-email-helpers'

/**
 * GET /api/admin/meetings/[meetingId]/preview - Preview meeting email as HTML
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { meetingId } = await params
    const meeting = await meetingRepository.getById(meetingId)

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Map MeetingRecord to MeetingEmail props
    const emailProps = meetingRecordToEmailProps(meeting)

    // Render meeting email template (using createElement to avoid JSX in .ts file)
    const emailElement = createElement(MeetingEmail as any, emailProps)
    const emailHtml = await render(emailElement)

    return new NextResponse(emailHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error previewing meeting email:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to preview meeting email' },
      { status: 500 }
    )
  }
}
