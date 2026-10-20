import type { ConsentCategory, MailingListRecord } from '@my/app/provider/dynamodb/types'
import { listDisplayName, shortOwnerName } from './owners'

/**
 * Self-serve list preferences (R5): every list offered to a person, grouped by
 * owner, each with its current state, plus the save logic.
 *
 * "Subscribed" is the registry: an opt_in row for this address, or, with no
 * row at all, the list's defaultOptIn when the list is offered to the person
 * (see default-opt-in.ts). Saving writes the registry only; no SES topic.
 */

/** Categories a person may manage themselves. Office/membership lists are conferred, not chosen. */
export const SELF_SERVE_CATEGORIES: ConsentCategory[] = ['reminders', 'newsletters']

export const isSelfServe = (l: Pick<MailingListRecord, 'category' | 'status'>) =>
  l.status === 'active' && SELF_SERVE_CATEGORIES.includes(l.category)

export interface ListPreference {
  listId: string
  name: string // derived display name, "Toronto East Newsletter"
  description: string
  subscribed: boolean
}

export interface ListPreferenceGroup {
  ownerType: MailingListRecord['ownerType']
  ownerId: string
  ownerName: string
  lists: ListPreference[]
}

export interface BuildPreferencesInput {
  /** Every list (active + archived). */
  allLists: MailingListRecord[]
  /** listIds offered to this person by the scope ladder. */
  offeredIds: Set<string>
  /** listId → this address's registry status on it, when a row exists. */
  registryStatus: Map<string, 'opt_in' | 'opt_out'>
  /** ownerType#ownerId → owner name. */
  ownerName: (list: MailingListRecord) => string
}

/** Pure: which lists to show and their state, grouped by owner. */
export function buildListPreferences(input: BuildPreferencesInput): ListPreferenceGroup[] {
  const shown = input.allLists.filter(
    (l) => isSelfServe(l) && (input.offeredIds.has(l.listId) || input.registryStatus.has(l.listId))
  )
  const groups = new Map<string, ListPreferenceGroup>()
  for (const l of shown) {
    const key = `${l.ownerType}#${l.ownerId}`
    const owner = input.ownerName(l)
    const group = groups.get(key) ?? {
      ownerType: l.ownerType,
      ownerId: l.ownerId,
      ownerName: shortOwnerName(owner),
      lists: [],
    }
    const row = input.registryStatus.get(l.listId)
    group.lists.push({
      listId: l.listId,
      name: listDisplayName(owner, l.name),
      description: l.description,
      subscribed: row ? row === 'opt_in' : l.defaultOptIn === true && input.offeredIds.has(l.listId),
    })
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, lists: g.lists.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
}

/**
 * Pure: validate a save request against the known lists. Unknown, archived or
 * non-self-serve list ids are dropped (never trusted from the client). When
 * `current` (listId → shown state) is given, lists whose state did not change
 * are dropped too, so a save never turns a defaultOptIn into a stored row.
 */
export function planListSave(
  requested: Record<string, unknown>,
  allLists: MailingListRecord[],
  current?: Map<string, boolean>
): { changes: Array<{ list: MailingListRecord; subscribed: boolean }> } {
  const byId = new Map(allLists.map((l) => [l.listId, l]))
  const changes: Array<{ list: MailingListRecord; subscribed: boolean }> = []
  for (const [listId, value] of Object.entries(requested ?? {})) {
    const list = byId.get(listId)
    if (!list || !isSelfServe(list) || typeof value !== 'boolean') continue
    if (current && current.get(listId) === value) continue
    changes.push({ list, subscribed: value })
  }
  return { changes }
}
