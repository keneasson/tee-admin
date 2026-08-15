import { NextRequest, NextResponse } from 'next/server'
import { requireAssurance } from '../../../../../utils/auth-trust'
import { getContacts } from '../../../../../utils/email/contact'
import { resolveListRecipients } from '../../../../../utils/email/resolve-list-recipients'
import { computeParityDiff } from '../../../../../utils/mailing-lists/parity'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * GET /api/admin/mailing-lists/parity?listId=…
 *
 * DIAGNOSTIC harness (Epic #55, mailing-lists Phase 2). For a list that still
 * carries a legacy `sesTopic`, resolve its recipients BOTH ways — the live SES
 * topic path vs the in-house resolver — and return a diff so we can prove the
 * in-house registry matches SES BEFORE anything cuts over to it (Phase 4).
 *
 * This route sends nothing and mutates nothing.
 *
 * NOTE: until the prod backfill populates the registry, the in-house side is
 * empty and every SES address appears in `inSesNotInHouse` — that is expected.
 *
 * Access: authenticated (fresh, cookie-bound — a forwardable token is NOT enough)
 * AND owner/admin. Flag-gated: 404 while MAILING_LIST_REGISTRY is off, so the
 * endpoint is invisible until the feature is deliberately enabled.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAssurance('authenticated')
  if (!gate.ok) return gate.response

  const role = (gate.ctx.session?.user as any)?.role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Flag gate — feature is dark until deliberately enabled.
  const flagOn = await checkFeatureFlagFromDB(
    FEATURE_FLAGS.MAILING_LIST_REGISTRY,
    gate.ctx.session as any
  )
  if (!flagOn) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const listId = request.nextUrl.searchParams.get('listId')
  if (!listId) {
    return NextResponse.json({ error: 'listId is required' }, { status: 400 })
  }

  const list = await mailingListRepository.getList(listId)
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }
  if (!list.sesTopic) {
    return NextResponse.json(
      {
        error:
          'List has no legacy sesTopic — parity is only meaningful for migrated lists with an SES bridge.',
      },
      { status: 400 }
    )
  }

  try {
    // --- SES side: page through every OPT_IN contact for the legacy topic,
    //     exactly as the live send path filters (getContacts).
    const sesEmails: string[] = []
    let nextPageToken: string | undefined
    do {
      const page = await getContacts({ listTopic: list.sesTopic, nextPageToken })
      for (const contact of page.Contacts ?? []) {
        if (contact.EmailAddress) sesEmails.push(contact.EmailAddress)
      }
      nextPageToken = page.NextToken
    } while (nextPageToken)

    // --- In-house side: the Phase 2 resolver (suppression + verification + dedupe).
    const inHouse = await resolveListRecipients(listId)
    const inHouseEmails = inHouse.recipients.map((r) => r.email)

    const diff = computeParityDiff(sesEmails, inHouseEmails)

    return NextResponse.json({
      listId,
      sesTopic: list.sesTopic,
      diff,
      resolverStats: inHouse.stats,
    })
  } catch (error) {
    console.error('mailing-lists parity harness failed:', error)
    return NextResponse.json({ error: 'Failed to compute parity' }, { status: 500 })
  }
}
