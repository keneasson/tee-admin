import { NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { listPeopleCards, peopleIndexReady } from '@my/app/provider/dynamodb/people-index'
import { buildEmailListsOverview } from '@my/app/utils/email-lists-overview'
import { getSubscriptionSource } from '@/utils/email/subscription-source'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/email/search — the Email Lists overview (#276).
 *
 * People come ONLY from PersonRecords: one person CARD per person (one gsi4
 * Query), each listing every address that person holds, so a shared
 * household address appears on each person who holds it. Subscriptions come
 * from the mailing-list registry (R5). SES contacts and the suppression list
 * are read (List calls only) and compared against them; every disagreement is
 * returned as a finding.
 *
 * Owner only: it lists every address and every SES disagreement, including
 * addresses no member holds. Writes nothing — not to DynamoDB, not to SES.
 */
export async function GET() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!(await peopleIndexReady())) {
    return NextResponse.json(
      { error: 'The people index has not been built yet (scripts/rebuild-people-projections.ts).' },
      { status: 503 }
    )
  }

  try {
    const [cards, subs] = await Promise.all([listPeopleCards(), getSubscriptionSource().load()])
    const overview = buildEmailListsOverview({
      cards,
      sesContacts: subs.subscribers,
      suppressed: subs.suppressed,
      topics: subs.topics,
      subscriptionSource: subs.source,
      subscriptions: subs.subscriptions,
      safetyNetTopics: subs.safetyNetTopics,
    })
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Email Lists overview failed:', error)
    return NextResponse.json({ error: 'Failed to load Email Lists' }, { status: 500 })
  }
}
