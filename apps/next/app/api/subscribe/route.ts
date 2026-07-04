import { NextRequest, NextResponse } from 'next/server'
import { GetContactCommand, UpdateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from '@/utils/email/sesClient'
import { inputTemplate } from '@/utils/email/contact-lists'
import { verifyEcclesiaToken } from '@/utils/email/ecclesia-token'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/** Serving-tenant brand, so the page reads as a clear entrypoint into tee-admin.com OR echadhub.org. */
function tenantBrand(request: NextRequest) {
  const t = getTenantFromHeaders(request.headers) ?? resolveTenantFromEnv()
  return { id: t.id, publicName: t.publicName, senderDomain: t.senderDomain }
}

async function firstNameForEmail(email: string): Promise<string | null> {
  try {
    const person = await personRepository.getByEmailForAuth(email)
    return person?.firstName || null
  } catch {
    return null
  }
}

/**
 * Self-serve subscription management (Issue #75).
 *
 * SECURITY: only the PUBLIC, self-manageable topics are exposed here. Office /
 * membership topics (`interEcclesia` = conferred by the Recording-Brother
 * office; `members` = TEE membership; `testList`) are NEVER shown or changed by
 * this endpoint — they're set by role/membership, not self-serve. This is the
 * fix for the SES hosted page exposing every topic.
 */
const PUBLIC_TOPICS = ['newsletter', 'memorial', 'bibleClass', 'sundaySchool'] as const
const PUBLIC_TOPIC_LABELS: Record<string, string> = {
  newsletter: 'Newsletter',
  memorial: 'Memorial (Sunday service reminder)',
  bibleClass: 'Bible Class',
  sundaySchool: 'Sunday School',
}

async function emailForToken(token: string | null): Promise<string | null> {
  if (!token) return null
  const res = await verifyEcclesiaToken(token)
  return res.valid && res.email ? res.email.toLowerCase() : null
}

/** GET /api/subscribe?token=… → current opt-in state for the public topics. */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  const email = await emailForToken(token)
  if (!email) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  try {
    const contact = await getSesClient().send(
      new GetContactCommand({ ...inputTemplate, EmailAddress: email })
    )
    const prefs = new Map(
      (contact.TopicPreferences ?? []).map((p) => [p.TopicName, p.SubscriptionStatus])
    )
    const subscriptions = PUBLIC_TOPICS.map((t) => ({
      topic: t,
      label: PUBLIC_TOPIC_LABELS[t],
      subscribed: prefs.get(t) === SubscriptionStatus.OPT_IN,
    }))
    return NextResponse.json({
      email,
      name: await firstNameForEmail(email),
      subscriptions,
      unsubscribedAll: !!contact.UnsubscribeAll,
      tenant: tenantBrand(request),
    })
  } catch (error: any) {
    if (error?.name === 'NotFoundException') {
      // Not yet a contact — show everything as not-subscribed.
      return NextResponse.json({
        email,
        name: await firstNameForEmail(email),
        subscriptions: PUBLIC_TOPICS.map((t) => ({ topic: t, label: PUBLIC_TOPIC_LABELS[t], subscribed: false })),
        unsubscribedAll: false,
        tenant: tenantBrand(request),
      })
    }
    console.error('subscribe GET failed:', error)
    return NextResponse.json({ error: 'Could not load your preferences' }, { status: 500 })
  }
}

/**
 * POST /api/subscribe { token, subscriptions: { newsletter?: boolean, … } }
 * Updates ONLY the public topics; preserves every other topic exactly.
 */
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const email = await emailForToken(body?.token ?? null)
  if (!email) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  const requested: Record<string, boolean> = body?.subscriptions ?? {}

  try {
    const client = getSesClient()
    let existing: GetContactCommand extends never ? never : Awaited<ReturnType<typeof client.send>> | null = null
    try {
      existing = await client.send(new GetContactCommand({ ...inputTemplate, EmailAddress: email })) as any
    } catch (e: any) {
      if (e?.name !== 'NotFoundException') throw e
    }

    // Start from existing prefs so non-public topics are preserved verbatim.
    const current = new Map<string, SubscriptionStatus>(
      ((existing as any)?.TopicPreferences ?? []).map((p: any) => [p.TopicName, p.SubscriptionStatus])
    )
    for (const t of PUBLIC_TOPICS) {
      if (t in requested) {
        current.set(t, requested[t] ? SubscriptionStatus.OPT_IN : SubscriptionStatus.OPT_OUT)
      }
    }
    const TopicPreferences = Array.from(current.entries()).map(([TopicName, SubscriptionStatus]) => ({
      TopicName,
      SubscriptionStatus,
    }))

    await client.send(
      new UpdateContactCommand({ ...inputTemplate, EmailAddress: email, TopicPreferences })
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('subscribe POST failed:', error)
    return NextResponse.json({ error: 'Could not save your preferences' }, { status: 500 })
  }
}
