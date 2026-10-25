import { listPeopleCards } from '@my/app/provider/dynamodb/people-index'
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
 * Everyone in the directory, for the people and guest lists: ONE Query of
 * the person CARDs (gsi4 `PEOPLE#ALL`), which already carry each person's
 * phone digits.
 */
export async function loadDirectoryPeople(opts: { withPhones?: boolean } = {}): Promise<{
  people: DirectoryPerson[]
  source: 'index'
}> {
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
