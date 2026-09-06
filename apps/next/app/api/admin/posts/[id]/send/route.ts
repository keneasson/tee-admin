import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { EmailListTypes } from '@my/app/types'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { getPostAnnouncementContent } from '../../../../../../utils/email/get-post-announcement-content'
import { emailSend } from '../../../../../../utils/email/email-send'

export const config = {
  maxDuration: 60,
}

/**
 * POST /api/admin/posts/[id]/send — the Consolidated CMS send bridge (epic #131 §4-D).
 *
 * Sends ANY `ready` Post as an announcement email to a chosen audience, through
 * the ONE occasion-agnostic path (`getPostAnnouncementContent` → `PostAnnouncement`
 * → `emailSend` reason `'post-announcement'`). Funeral / baptism / wedding /
 * double-baptism / general are all sendable with NO per-type code.
 *
 * Gate (same three-way as the other admin/posts routes): authenticated →
 * owner/admin → `CONSOLIDATED_CMS` flag ON, else 404 (dark until enabled).
 *
 * Safety:
 *   - TEST BY DEFAULT — `test` is `true` unless the body explicitly sends
 *     `test: false`. `emailSend` hard-routes test sends to `testList`, and skips
 *     entirely when `EMAILS_ENABLED=false` (build/CI never send).
 *   - status MUST be 'ready' (422) — never sends a draft/archived post.
 *   - tenant isolation — the post's owning ecclesia must match the deployment's
 *     tenant (403 otherwise), closing the global-admin-only gap.
 *
 * Body: { test?: boolean (default true), list?: EmailListTypes key, note?: string }
 */

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth>>>

async function authorize(): Promise<
  { ok: true; session: AuthSession } | { ok: false; res: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.email) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = (session.user as any).role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
  if (!flagOn) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ok: true, session }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await authorize()
  if (!gate.ok) return gate.res
  const { session } = gate

  try {
    const { id } = await params

    let body: { test?: boolean; list?: string; note?: string } = {}
    try {
      body = await request.json()
    } catch {
      // Empty/absent body is fine — defaults apply (test send to newsletter list).
      body = {}
    }

    // TEST BY DEFAULT — only an explicit `test: false` opts into a live send.
    const isTest = body.test !== false

    // Validate the chosen audience against the known SES lists. Test sends are
    // hard-routed to testList inside emailSend regardless of this value.
    const requestedList = body.list
    if (requestedList && !(Object.values(EmailListTypes) as string[]).includes(requestedList)) {
      return NextResponse.json({ error: `Unknown audience '${requestedList}'.` }, { status: 400 })
    }
    const audienceKey = requestedList || EmailListTypes.newsletter

    const post = await postRepository.getPost(id)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Never send a draft/archived post.
    if (post.status !== 'ready') {
      return NextResponse.json(
        { error: `Post is not ready to send (status: ${post.status}).` },
        { status: 422 }
      )
    }

    // Tenant isolation — a deployment may only send its own tenant's posts.
    const tenant = getTenantFromHeaders(request.headers) || resolveTenantFromEnv()
    if (tenant.homeEcclesiaName && post.tenant !== tenant.homeEcclesiaName) {
      return NextResponse.json(
        { error: `This post belongs to ${post.tenant}, not ${tenant.homeEcclesiaName}.` },
        { status: 403 }
      )
    }

    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined

    const [html, text, subject] = await getPostAnnouncementContent(id, tenant, note)

    const result = await emailSend({
      reason: 'post-announcement',
      emailHtml: html,
      emailText: text,
      test: isTest,
      customList: audienceKey,
      customSubject: subject,
      subReason: 'general',
      description: `Post announcement: ${subject} → ${isTest ? 'testList' : audienceKey}`,
      sentBy: session.user?.email ?? undefined,
      tenant,
    })

    if (result instanceof Error) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      test: isTest,
      audience: isTest ? 'testList' : audienceKey,
      subject,
      campaignId: result.campaignId,
      sentCount: result.sends.length,
      skippedCount: result.skips.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error sending post announcement:', message)
    return NextResponse.json(
      { success: false, error: `Failed to send announcement: ${message}` },
      { status: 500 }
    )
  }
}
