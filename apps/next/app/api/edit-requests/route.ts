import { NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/render'
import React from 'react'
import { auth } from '../../../utils/auth'
import { editRequestRepository } from '@my/app/provider/dynamodb/repositories/edit-request-repository'
import { sendEmail } from '../../../utils/email/sesClient'
import EditRequestEmail from '../../../../email-builder/emails/EditRequest'
import type { EditRequestField } from '@my/app/provider/dynamodb/types'

const validFields: EditRequestField[] = ['email', 'phone', 'address', 'name']

const fieldLabels: Record<EditRequestField, string> = {
  name: 'Name',
  email: 'Email Address',
  phone: 'Phone Number',
  address: 'Address',
}

/**
 * GET /api/edit-requests - Get edit requests for current user
 * Query params:
 *   - sent=true: Get requests sent BY the user (to edit others' profiles)
 *   - Default: Get requests received (others want to edit YOUR profile)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const getSent = searchParams.get('sent') === 'true'

    if (getSent) {
      // Get requests I've sent to others
      const requests = await editRequestRepository.getSentRequests(session.user.email)
      return NextResponse.json({
        success: true,
        requests: requests.map(req => ({
          requestId: req.requestId,
          targetEmail: req.targetEmail,
          field: req.field,
          currentValue: req.currentValue,
          suggestedValue: req.suggestedValue,
          message: req.message,
          status: req.status,
          createdAt: req.createdAt,
          respondedAt: req.respondedAt,
        })),
      })
    }

    // Get requests others have made to edit my profile
    const result = await editRequestRepository.getEditRequestsForUser(session.user.email)
    const pendingCount = await editRequestRepository.getPendingCount(session.user.email)

    return NextResponse.json({
      success: true,
      requests: result.items.map(req => ({
        requestId: req.requestId,
        requesterEmail: req.requesterEmail,
        requesterName: req.requesterName,
        field: req.field,
        currentValue: req.currentValue,
        suggestedValue: req.suggestedValue,
        message: req.message,
        status: req.status,
        createdAt: req.createdAt,
        respondedAt: req.respondedAt,
      })),
      pendingCount,
    })
  } catch (error) {
    console.error('Get edit requests error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/edit-requests - Create a new edit request
 * Request body:
 *   - targetEmail: string (required)
 *   - field: EditRequestField (required)
 *   - suggestedValue: string (required)
 *   - currentValue?: string (optional)
 *   - message?: string (optional)
 */
/** Internal sentinel: the notification was intentionally coalesced, not failed. */
class SkipNotification extends Error {}

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
    const { targetEmail, field, suggestedValue, currentValue, message } = body

    // Validate required fields
    if (!targetEmail || !field || !suggestedValue) {
      return NextResponse.json(
        { error: 'Missing required fields: targetEmail, field, suggestedValue' },
        { status: 400 }
      )
    }

    // Validate field type
    if (!validFields.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${validFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Can't suggest edits to your own profile
    if (targetEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot suggest edits to your own profile. Just edit it directly!' },
        { status: 400 }
      )
    }

    // Check for existing pending request for same field
    const hasPending = await editRequestRepository.hasPendingRequestForField(
      session.user.email,
      targetEmail,
      field
    )
    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending edit request for this field' },
        { status: 409 }
      )
    }

    // Get requester's name from session
    const requesterName = session.user.name || undefined

    // Create the request
    const editRequest = await editRequestRepository.createRequest(
      session.user.email,
      requesterName,
      targetEmail,
      field,
      suggestedValue,
      currentValue,
      message
    )

    // COALESCE the notification.
    //
    // Each field is its own dialog and its own request, so changing an address
    // and a phone number produced TWO emails to the same person minutes apart.
    // For an elderly member that is not a minor annoyance — it reads as two
    // separate alarming events.
    //
    // If this requester already has a pending request against this person that
    // was notified within the window, the earlier email already told them to
    // review their pending changes, so a second one adds nothing. The link in
    // it goes to the full list, which now includes this change too.
    const COALESCE_WINDOW_MS = 15 * 60 * 1000
    let alreadyNotified = false
    try {
      const pending = await editRequestRepository.getPendingRequests(targetEmail)
      const cutoff = Date.now() - COALESCE_WINDOW_MS
      alreadyNotified = pending.some(
        (req) =>
          req.requestId !== editRequest.requestId &&
          req.requesterEmail === session.user!.email &&
          Date.parse(req.createdAt) >= cutoff
      )
    } catch (lookupError) {
      // If the lookup fails, fall through and send — a duplicate notification
      // is a far better failure than a silent one.
      console.error('Coalescing lookup failed; sending notification:', lookupError)
    }

    // Send email notification to target user
    try {
      if (alreadyNotified) {
        console.info(
          `Coalesced: '${field}' change for ${targetEmail} joins a notification already sent by ${session.user.email}`
        )
        throw new SkipNotification()
      }
      const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
      const approveUrl = `${baseUrl}/api/edit-requests/approve?token=${editRequest.approvalToken}&action=approve`
      const rejectUrl = `${baseUrl}/api/edit-requests/approve?token=${editRequest.approvalToken}&action=reject`
      const viewAllUrl = `${baseUrl}/profile?tab=edit-requests`

      // Get target user's name (use email if not available)
      const targetName = targetEmail.split('@')[0] // Simple fallback

      const emailComponent = React.createElement(EditRequestEmail, {
        targetName,
        requesterName: requesterName || session.user.email,
        requesterEmail: session.user.email,
        field: field as 'name' | 'email' | 'phone' | 'address',
        currentValue,
        suggestedValue,
        message,
        approveUrl,
        rejectUrl,
        viewAllUrl,
      })
      const emailHtml = await render(emailComponent)

      const fieldLabel = fieldLabels[field as EditRequestField]
      await sendEmail({
        to: targetEmail,
        subject: `${requesterName || 'Someone'} suggested an edit to your ${fieldLabel.toLowerCase()}`,
        body: emailHtml,
      })
    } catch (emailError) {
      if (!(emailError instanceof SkipNotification)) {
        // Log but don't fail the request - the edit request was still created
        console.error('Failed to send edit request notification email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      requestId: editRequest.requestId,
      message: 'Edit suggestion sent. The profile owner will be notified.',
    })
  } catch (error) {
    console.error('Create edit request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
