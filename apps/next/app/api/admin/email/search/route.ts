import { NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { listPeopleCards, peopleIndexReady } from '@my/app/provider/dynamodb/people-index'
import { buildEmailListsOverview } from '@my/app/utils/email-lists-overview'
import { listAllSesContacts, listSesTopics, listSuppressedAddresses } from '@/utils/email/ses-snapshot'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/email/search — the Email Lists overview (#276).
 *
 * People come ONLY from PersonRecords: one person CARD per person (one gsi4
 * Query), each listing every address that person holds, so a shared
 * household address appears on each person who holds it. SES contacts,
 * topic preferences and the suppression list are read (List calls only) and
 * compared against them; every disagreement is returned as a finding.
 *
 * Owner/admin only. Writes nothing — not to DynamoDB, not to SES.
 */
export async function GET() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user || !['admin', 'owner'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await peopleIndexReady())) {
    return NextResponse.json(
      { error: 'The people index has not been built yet (scripts/rebuild-people-projections.ts).' },
      { status: 503 }
    )
  }

  try {
    const [cards, sesContacts, suppressed, topics] = await Promise.all([
      listPeopleCards(),
      listAllSesContacts(),
      listSuppressedAddresses(),
      listSesTopics(),
    ])
    const overview = buildEmailListsOverview({ cards, sesContacts, suppressed, topics })
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Email Lists overview failed:', error)
    return NextResponse.json({ error: 'Failed to load Email Lists' }, { status: 500 })
  }
}
