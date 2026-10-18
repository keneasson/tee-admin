import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { listPeopleCards, peopleIndexReady } from '@my/app/provider/dynamodb/people-index'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/** The person fields the directory lists need. */
export type DirectoryPerson = Pick<
  PersonRecord,
  'personId' | 'primaryEmail' | 'firstName' | 'lastName' | 'displayName' | 'ecclesia' | 'role' | 'createdAt'
> & {
  /** Digits-only phone numbers (search material). */
  phones?: string[]
}

/**
 * Everyone in the directory, for the people and guest lists.
 *
 * Once the people index is built this is ONE Query of the person CARDs
 * (gsi4 `PEOPLE#ALL`), which already carry each person's phone digits.
 * Before that — or if the index read fails — it falls back to the legacy
 * pair of full-table Scans (PROFILEs, then every PHONE#).
 */
export async function loadDirectoryPeople(opts: { withPhones?: boolean } = {}): Promise<{
  people: DirectoryPerson[]
  source: 'index' | 'scan'
}> {
  try {
    if (await peopleIndexReady()) {
      const cards = await listPeopleCards()
      return {
        source: 'index',
        people: cards.map((c) => ({
          personId: c.personId,
          primaryEmail: c.primaryEmail,
          firstName: c.firstName,
          lastName: c.lastName,
          displayName: c.displayName,
          ecclesia: c.ecclesia,
          role: c.role as PersonRecord['role'],
          createdAt: c.createdAt || '',
          phones: opts.withPhones && c.phoneDigits?.length ? c.phoneDigits : undefined,
        })),
      }
    }
  } catch (error) {
    console.error('people-index: card read failed; using legacy scan', error)
  }

  const persons: PersonRecord[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const result = await personRepository.listAll({ lastEvaluatedKey: lastKey })
    persons.push(...result.items)
    lastKey = result.lastEvaluatedKey
  } while (lastKey)

  let phonesByPerson = new Map<string, string[]>()
  if (opts.withPhones) {
    try {
      phonesByPerson = await personRepository.getAllPhonesByPerson()
    } catch (phoneError) {
      // Search by name and email still works; only phone matching is lost.
      console.error('Failed to load phones for search:', phoneError)
    }
  }

  return {
    source: 'scan',
    people: persons.map((p) => ({
      personId: p.personId,
      primaryEmail: p.primaryEmail,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName,
      ecclesia: p.ecclesia,
      role: p.role,
      createdAt: p.createdAt,
      phones: phonesByPerson.get(p.personId),
    })),
  }
}
