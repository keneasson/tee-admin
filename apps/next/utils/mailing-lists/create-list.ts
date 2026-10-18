import { isValidContinent, isValidRegion } from '@my/app/config/regions'
import { slugifyEcclesia } from '@my/app/provider/dynamodb/people-index/keys'
import type {
  ConsentCategory,
  MailingListOwnerType,
  MailingListRecord,
  MailingListScope,
} from '@my/app/provider/dynamodb/types'
import type { ListOwner } from './owners'

/**
 * Validate an admin's "new list" form (R5). Pure. Lists made here are
 * self-serve (reminders / newsletters): office and membership lists are
 * conferred, so they are not created from this form.
 */

export interface NewListInput {
  ownerType: MailingListOwnerType
  ownerId: string
  name: string
  description: string
  category: ConsentCategory
  scope: MailingListScope
  scopeValue: string
  defaultOptIn: boolean
}

export type NewListValidation = { ok: true; value: NewListInput } | { ok: false; error: string }

export function validateNewList(
  raw: any,
  owners: ListOwner[],
  existing: Array<Pick<MailingListRecord, 'ownerType' | 'ownerId' | 'name' | 'status'>>
): NewListValidation {
  const ownerType = raw?.ownerType
  if (ownerType !== 'ecclesia' && ownerType !== 'organization') {
    return { ok: false, error: 'Choose an ecclesia or an organization as the owner.' }
  }
  const ownerId = typeof raw?.ownerId === 'string' ? raw.ownerId : ''
  if (!owners.some((o) => o.ownerType === ownerType && o.ownerId === ownerId)) {
    return { ok: false, error: 'That owner was not found.' }
  }
  const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'The list name must be 2–80 characters.' }
  }
  const description = typeof raw?.description === 'string' ? raw.description.trim() : ''
  if (description.length > 300) return { ok: false, error: 'The description must be 300 characters or fewer.' }

  const category = raw?.category
  if (category !== 'reminders' && category !== 'newsletters') {
    return { ok: false, error: 'Choose "newsletters" or "reminders".' }
  }

  const scope = raw?.scope as MailingListScope
  let scopeValue = ''
  switch (scope) {
    case 'ecclesia':
      if (ownerType !== 'ecclesia') {
        return { ok: false, error: 'Only an ecclesia can offer a list to its own members.' }
      }
      scopeValue = ownerId
      break
    case 'region':
      if (!isValidRegion(String(raw?.scopeValue))) return { ok: false, error: 'Choose a region.' }
      scopeValue = String(raw.scopeValue)
      break
    case 'continent':
      if (!isValidContinent(String(raw?.scopeValue))) return { ok: false, error: 'Choose a continent.' }
      scopeValue = String(raw.scopeValue)
      break
    case 'global':
      scopeValue = ''
      break
    default:
      return { ok: false, error: 'Choose who the list is offered to.' }
  }

  const dup = existing.some(
    (l) =>
      l.status === 'active' &&
      l.ownerType === ownerType &&
      l.ownerId === ownerId &&
      l.name.trim().toLowerCase() === name.toLowerCase()
  )
  if (dup) return { ok: false, error: 'This owner already has an active list with that name.' }

  return {
    ok: true,
    value: {
      ownerType,
      ownerId,
      name,
      description,
      category,
      scope,
      scopeValue,
      defaultOptIn: raw?.defaultOptIn === true,
    },
  }
}

/** The list's slug key, from its own name. */
export const listKeyOf = (name: string) => slugifyEcclesia(name)
