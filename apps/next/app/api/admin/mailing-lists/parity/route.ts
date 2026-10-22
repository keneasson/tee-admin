import { NextRequest, NextResponse } from 'next/server'
import { requireAssurance } from '../../../../../utils/auth-trust'
import { runListParity } from '../../../../../utils/mailing-lists/parity'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'

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
 * AND owner/admin.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAssurance('authenticated')
  if (!gate.ok) return gate.response

  const role = (gate.ctx.session?.user as any)?.role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
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
    // Both sides use the same filters their send paths apply (see runListParity).
    const parity = await runListParity(list)
    return NextResponse.json(parity)
  } catch (error) {
    console.error('mailing-lists parity harness failed:', error)
    return NextResponse.json({ error: 'Failed to compute parity' }, { status: 500 })
  }
}
