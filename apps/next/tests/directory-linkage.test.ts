import { describe, it, expect } from 'vitest'
import { suggestionToPerson, plainNameToPerson } from '@my/app/features/post-editor/resolvers/person-resolve'
import { redactPost } from '@my/app/utils/redact-post'
import type { Post, PersonBlock } from '@my/app/types/post'
import type { Viewer } from '@my/app/utils/viewer-pii'

/**
 * LINKAGE to what already exists — not new fields.
 *
 *   Person  → the Contact List record, `/people/{personId}`; `/api/people`
 *             already returns that id and `directory/people/page.tsx` already
 *             routes on it. `suggestionToPerson` was dropping it.
 *   Ecclesia → the Ecclesial Directory, `/directory/ecclesias/{name}`;
 *             `LocationBlock.ecclesiaRef` already stores that exact name.
 *
 * The person display fields remain a SNAPSHOT — the post must still render if
 * the record changes, and redaction works on the copied values. `personId` is a
 * pointer ALONGSIDE the snapshot, not a replacement for it.
 */
const anon: Viewer = { assurance: 'anonymous', role: 'guest', tenant: null, email: null }
const member: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'Toronto East Ecclesia',
  email: 'm@x.z',
}

const postWithPerson = (block: PersonBlock): Post =>
  ({
    id: 'p1',
    tenant: 'Toronto East Ecclesia',
    authorId: 'a',
    title: 'T',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    blocks: [block],
  }) as unknown as Post

describe('person → Contact List linkage', () => {
  it('keeps the directory id when picked from the Contact List', () => {
    const person = suggestionToPerson({ id: 'uuid-123', name: 'Gordon Easson' })
    expect(person.personId).toBe('uuid-123')
    // still a snapshot
    expect(person.firstName).toBe('Gordon')
    expect(person.lastName).toBe('Easson')
  })

  it('a free-typed name has no linkage — a visiting speaker is not in the directory', () => {
    expect(plainNameToPerson('Visiting Brother').personId).toBeUndefined()
  })

  it('redaction strips the link below member tier', () => {
    const block: PersonBlock = {
      id: 'b1',
      kind: 'person',
      role: 'speaker',
      people: [{ id: 'x', personId: 'uuid-123', firstName: 'Gordon', lastName: 'Easson' }],
    }
    const forAnon = redactPost(postWithPerson(block), anon)!
    const anonPerson = (forAnon.blocks[0] as PersonBlock).people[0]
    expect(anonPerson.personId).toBeUndefined()
    expect(anonPerson.lastName).toBeUndefined()

    const forMember = redactPost(postWithPerson(block), member)!
    expect((forMember.blocks[0] as PersonBlock).people[0].personId).toBe('uuid-123')
  })
})
