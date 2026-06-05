import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { pendingEmailNoteRepository } from '@my/app/provider/dynamodb/repositories/pending-email-note-repository'
import type { EmailReasonType } from '@my/app/types'

const ALLOWED_REASONS: EmailReasonType[] = [
  'newsletter',
  'recap',
  'bible-class',
  'sunday-school',
]

const MAX_NOTE_LENGTH = 500

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userRole = session.user.role
  if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  let body: { reason?: string; note?: string; clear?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { reason, note, clear } = body
  if (!reason || !ALLOWED_REASONS.includes(reason as EmailReasonType)) {
    return NextResponse.json(
      { error: `reason must be one of: ${ALLOWED_REASONS.join(', ')}` },
      { status: 400 }
    )
  }

  const typedReason = reason as EmailReasonType

  if (clear) {
    await pendingEmailNoteRepository.clearNote(typedReason)
    return NextResponse.json({ ok: true, cleared: true, reason: typedReason })
  }

  const trimmed = (note ?? '').trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 })
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `note exceeds ${MAX_NOTE_LENGTH} characters` },
      { status: 400 }
    )
  }

  await pendingEmailNoteRepository.saveNote(typedReason, trimmed, session.user.email)

  return NextResponse.json({ ok: true, reason: typedReason, note: trimmed })
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userRole = session.user.role
  if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const reason = request.nextUrl.searchParams.get('reason') as EmailReasonType | null
  if (!reason || !ALLOWED_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `reason must be one of: ${ALLOWED_REASONS.join(', ')}` },
      { status: 400 }
    )
  }

  const item = await pendingEmailNoteRepository.getNoteItem(reason)
  return NextResponse.json({
    reason,
    note: item?.note ?? null,
    createdAt: item?.createdAt ?? null,
    createdBy: item?.createdBy ?? null,
  })
}
