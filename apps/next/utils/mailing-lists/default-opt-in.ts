import type { MailingListRecord, PersonRecord } from '@my/app/provider/dynamodb/types'
import { getContinent, getDefaultRegion, isValidRegion, type Region } from '@my/app/config/regions'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index/keys'

/**
 * A list's `defaultOptIn` (R5).
 *
 * THE RULE: a person ELIGIBLE for a list whose `defaultOptIn` is true, who has
 * NO subscription row on that list, is treated as subscribed (source
 * 'default'). It is applied when the list is read (a send, the preferences
 * page), never written ahead of time, so it reaches people who join later
 * without a backfill. It never overrides a choice:
 *  - any row the person has on the list (opt_in or opt_out, on any of their
 *    addresses) decides instead;
 *  - an address someone opted out of on this list (a shared household
 *    address) is never mailed by default.
 * Leaving a defaultOptIn list writes an explicit opt_out row.
 *
 * ELIGIBLE = the list is offered to the person by the same scope ladder the
 * preferences page uses: their ecclesia (ecclesia scope), their ecclesia's
 * region or continent, or anyone with an ecclesia (global). The default goes
 * to the person's primary address only. Deceased people are never eligible.
 */

export interface ScopeEcclesia {
  name: string
  ecclesiaId?: string
  region?: string
  country?: string
  province?: string
}

function regionOf(e: ScopeEcclesia): Region | null {
  if (e.region && isValidRegion(e.region)) return e.region as Region
  if (!e.country) return null
  return getDefaultRegion(e.country, e.province)
}

/** Pure: the ecclesias whose people a list is offered to. */
export function ecclesiasInScope<E extends ScopeEcclesia>(
  list: Pick<MailingListRecord, 'scope' | 'scopeValue'>,
  ecclesias: E[]
): E[] {
  switch (list.scope) {
    case 'ecclesia':
      return ecclesias.filter((e) => ecclesiaIdOf(e) === list.scopeValue)
    case 'region':
      return ecclesias.filter((e) => regionOf(e) === list.scopeValue)
    case 'continent':
      return ecclesias.filter((e) => {
        const r = regionOf(e)
        return !!r && getContinent(r) === list.scopeValue
      })
    case 'global':
      return ecclesias
    default:
      return []
  }
}

/** Pure: is this person ever a default recipient? */
export function isDefaultEligiblePerson(p: Pick<PersonRecord, 'role' | 'primaryEmail'>): boolean {
  return p.role !== 'deceased' && !!p.primaryEmail
}

export interface EligiblePerson {
  personId: string
  email: string
}

export interface EligibleDeps {
  listEcclesias: () => Promise<ScopeEcclesia[]>
  /** Every person whose PROFILE names this ecclesia (all pages). */
  peopleOfEcclesia: (ecclesiaName: string) => Promise<Array<Pick<PersonRecord, 'personId' | 'primaryEmail' | 'role'>>>
}

/** Everyone a defaultOptIn list would reach by default, with their primary address (lower case). */
export async function eligiblePeopleForList(
  list: Pick<MailingListRecord, 'scope' | 'scopeValue'>,
  deps?: EligibleDeps
): Promise<EligiblePerson[]> {
  const d = deps ?? (await defaultEligibleDeps())
  const ecclesias = ecclesiasInScope(list, await d.listEcclesias())
  const byPerson = new Map<string, EligiblePerson>()
  for (const e of ecclesias) {
    for (const p of await d.peopleOfEcclesia(e.name)) {
      if (!isDefaultEligiblePerson(p)) continue
      byPerson.set(p.personId, { personId: p.personId, email: p.primaryEmail.trim().toLowerCase() })
    }
  }
  return [...byPerson.values()]
}

async function defaultEligibleDeps(): Promise<EligibleDeps> {
  const [{ listEcclesiasCached }, { personRepository }] = await Promise.all([
    import('../dynamodb/locations'),
    import('@my/app/provider/dynamodb/repositories/person-repository'),
  ])
  return {
    listEcclesias: () => listEcclesiasCached(),
    peopleOfEcclesia: async (name) => {
      const out: PersonRecord[] = []
      let lastEvaluatedKey: Record<string, any> | undefined
      do {
        const page = await personRepository.listByEcclesia(name, { lastEvaluatedKey })
        out.push(...page.items.filter((p) => p.skey === 'PROFILE'))
        lastEvaluatedKey = page.lastEvaluatedKey
      } while (lastEvaluatedKey)
      return out
    },
  }
}
