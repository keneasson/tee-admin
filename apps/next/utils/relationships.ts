import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonRecord, RelationshipRecord, RelationshipType } from '@my/app/provider/dynamodb/types'
import { personForSessionEmail } from './session-person'

/**
 * Shared helpers for the relationship routes. Relationships are keyed by
 * personId; an email only ever enters at the API boundary and is resolved to a
 * person here, once.
 */

/** The signed-in person: any address they hold resolves them (sign-in rule). */
export async function resolveSessionPerson(sessionEmail: string): Promise<PersonRecord | null> {
  const email = sessionEmail.toLowerCase().trim()
  const person = await personForSessionEmail(email)
  if (person) return person
  return (await personRepository.getAllPersonsByEmail(email))[0] || null
}

/** A related person by id (preferred) or by an address they hold. */
export async function resolvePersonId(input: {
  personId?: string | null
  email?: string | null
}): Promise<string | null> {
  if (input.personId) {
    const person = await personRepository.getById(input.personId)
    return person?.personId ?? null
  }
  if (input.email) {
    const person = await personRepository.getByEmail(input.email.toLowerCase().trim())
    return person?.personId ?? null
  }
  return null
}

export interface RelativeView {
  personId: string
  name?: string
  relationshipType: RelationshipType
  status: RelationshipRecord['status']
  createdAt: string
}

/** Name each related person from their PersonRecord. Never exposes an email. */
export async function describeRelatives(rels: RelationshipRecord[]): Promise<RelativeView[]> {
  return Promise.all(
    rels.map(async (rel) => {
      let name: string | undefined
      try {
        const person = await personRepository.getById(rel.targetPersonId)
        if (person) {
          name = person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || undefined
        }
      } catch {
        // Name is decoration; the relationship still shows.
      }
      return {
        personId: rel.targetPersonId,
        name,
        relationshipType: rel.relationshipType,
        status: rel.status,
        createdAt: rel.createdAt,
      }
    })
  )
}
