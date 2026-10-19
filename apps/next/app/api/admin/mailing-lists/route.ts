import { NextRequest, NextResponse } from 'next/server'
import { requireAssurance } from '@/utils/auth-trust'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { getContinentOptions, getRegionOptions } from '@my/app/config/regions'
import { listOwners, ownerNamesFor, ownerNameOf, listDisplayName } from '@/utils/mailing-lists/owners'
import { validateNewList, listKeyOf } from '@/utils/mailing-lists/create-list'

/**
 * GET  /api/admin/mailing-lists → every list (display name derived from its
 *      owner), subscriber counts, and the owner/region/continent choices.
 * POST /api/admin/mailing-lists → create a list for an ecclesia or organization.
 *
 * Owner/admin only, fresh sign-in, and 404 while MAILING_LIST_REGISTRY is off
 * for the caller. Creating a list sends nothing and touches no SES topic.
 */
async function gate() {
  const g = await requireAssurance('authenticated')
  if (!g.ok) return { response: g.response }
  const role = (g.ctx.session?.user as any)?.role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  const on = await checkFeatureFlagFromDB(FEATURE_FLAGS.MAILING_LIST_REGISTRY, g.ctx.session as any)
  if (!on) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { response: null }
}

export async function GET() {
  const { response } = await gate()
  if (response) return response
  try {
    const [lists, owners] = await Promise.all([mailingListRepository.listAllLists(), listOwners()])
    const names = await ownerNamesFor(lists, owners)
    const counts = await Promise.all(lists.map((l) => mailingListRepository.listSubscribers(l.listId)))
    return NextResponse.json({
      lists: lists
        .map((l, i) => ({
          listId: l.listId,
          displayName: listDisplayName(ownerNameOf(names, l), l.name),
          ownerType: l.ownerType,
          ownerId: l.ownerId,
          ownerName: ownerNameOf(names, l),
          name: l.name,
          description: l.description,
          category: l.category,
          scope: l.scope,
          scopeValue: l.scopeValue,
          defaultOptIn: l.defaultOptIn,
          status: l.status,
          sesTopic: l.sesTopic ?? null,
          sendFromRegistry: l.sendFromRegistry === true,
          subscribers: counts[i].length,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      owners,
      regions: getRegionOptions(),
      continents: getContinentOptions(),
    })
  } catch (error) {
    console.error('admin mailing-lists GET failed:', error)
    return NextResponse.json({ error: 'Could not load lists' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { response } = await gate()
  if (response) return response
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  try {
    const [owners, existing] = await Promise.all([listOwners(), mailingListRepository.listAllLists()])
    const v = validateNewList(body, owners, existing)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const created = await mailingListRepository.createList({ ...v.value, key: listKeyOf(v.value.name) })
    return NextResponse.json({ listId: created.listId }, { status: 201 })
  } catch (error) {
    console.error('admin mailing-lists POST failed:', error)
    return NextResponse.json({ error: 'Could not create the list' }, { status: 500 })
  }
}
