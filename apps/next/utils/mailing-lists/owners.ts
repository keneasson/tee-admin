import type { MailingListOwnerType, MailingListRecord } from '@my/app/provider/dynamodb/types'
import { slugifyEcclesia, ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index/keys'

/**
 * Mailing-list owners and display names (R5).
 *
 * A list stores its owner BY ID only. The name a reader sees, "Toronto East
 * Newsletter", is derived here at read time from the owner's CURRENT name plus
 * the list's own name, so it is never stored twice and a rename can't go stale.
 */

export interface ListOwner {
  ownerType: MailingListOwnerType
  ownerId: string
  name: string
}

/** "Toronto East Ecclesia" → "Toronto East" (the word adds nothing to a list name). */
export function shortOwnerName(name: string): string {
  return name.replace(/\s+ecclesia$/i, '').trim() || name
}

/** "<owner> <list>", e.g. "Toronto East" + "Newsletter" → "Toronto East Newsletter". */
export function listDisplayName(ownerName: string, listName: string): string {
  return `${shortOwnerName(ownerName)} ${listName}`.trim()
}

/** An organization's id: the slug of its name (organizations carry no id field yet). */
export function organizationIdOf(org: { name: string }): string {
  return slugifyEcclesia(org.name)
}

/** Fallback when an owner record can't be found: "toronto-east-ecclesia" → "Toronto East Ecclesia". */
export function humanizeId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

const ownerKey = (ownerType: MailingListOwnerType, ownerId: string) => `${ownerType}#${ownerId}`

/** Every ecclesia and organization that can own a list (cached server reads). */
export async function listOwners(): Promise<ListOwner[]> {
  const [{ listEcclesiasCached }, { getAllOrganizations }] = await Promise.all([
    import('../dynamodb/locations'),
    import('../dynamodb/organizations'),
  ])
  const [ecclesias, orgs] = await Promise.all([listEcclesiasCached(), getAllOrganizations()])
  return [
    ...ecclesias.map((e) => ({ ownerType: 'ecclesia' as const, ownerId: ecclesiaIdOf(e), name: e.name })),
    ...orgs.map((o) => ({ ownerType: 'organization' as const, ownerId: organizationIdOf(o), name: o.name })),
  ].sort((a, b) => a.name.localeCompare(b.name))
}

/** ownerType#ownerId → current owner name, for a batch of lists. */
export async function ownerNamesFor(
  lists: Array<Pick<MailingListRecord, 'ownerType' | 'ownerId'>>,
  owners?: ListOwner[]
): Promise<Map<string, string>> {
  const all = owners ?? (lists.length > 0 ? await listOwners() : [])
  const byKey = new Map(all.map((o) => [ownerKey(o.ownerType, o.ownerId), o.name]))
  const out = new Map<string, string>()
  for (const l of lists) {
    const key = ownerKey(l.ownerType, l.ownerId)
    out.set(key, byKey.get(key) ?? humanizeId(l.ownerId))
  }
  return out
}

export function ownerNameOf(
  names: Map<string, string>,
  list: Pick<MailingListRecord, 'ownerType' | 'ownerId'>
): string {
  return names.get(ownerKey(list.ownerType, list.ownerId)) ?? humanizeId(list.ownerId)
}
