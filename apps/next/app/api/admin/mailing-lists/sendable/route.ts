import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { listDisplayName, ownerNameOf, ownerNamesFor } from '@/utils/mailing-lists/owners'
import { resolveSendList, TEST_LIST_KEY } from '@/utils/mailing-lists/send-target'
import type { SimplifiedContactListType } from '@my/app/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/mailing-lists/sendable — the lists a send screen can target
 * (R5): every active registry list, by listId, named by owner + list
 * ("Toronto East Newsletter", "Cambridge Memorial Recap"), including lists with
 * no SES topic. Owner/admin only. Reads only; sends nothing.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  try {
    const tenant = getTenantFromHeaders(request.headers) ?? resolveTenantFromEnv()
    const lists = (await mailingListRepository.listAllLists()).filter((l) => l.status === 'active')
    const names = await ownerNamesFor(lists)
    let defaultListId: string | undefined
    try {
      defaultListId = (await resolveSendList({ reason: 'newsletter', tenant })).listId
    } catch {
      defaultListId = undefined // no newsletter list for this owner yet
    }
    const body: SimplifiedContactListType = {
      lists: lists
        .map((l) => ({
          key: l.listId,
          displayName: listDisplayName(ownerNameOf(names, l), l.name),
          defaultOptIn: l.defaultOptIn === true,
          listKey: l.key,
          isTest: l.key === TEST_LIST_KEY,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      ...(defaultListId ? { defaultListId } : {}),
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('sendable mailing lists failed:', error)
    return NextResponse.json({ error: 'Could not load lists' }, { status: 500 })
  }
}
