/**
 * A post's smart references (plan §0 R6, ADR-0006 §7) — PURE helpers.
 *
 * A registration contact that names a person (`contactPerson.personId`) is a
 * REFERENCE: the post stores the person, not a copy of their email or phone.
 *   - On write, {@link storeReferences} drops the copied email/phone from such
 *     a block, so the person's record stays the only source.
 *   - On read, `resolvePostReferences` (smart-refs-service) fills them back in
 *     for the viewer, through the same per-tier, per-privacy shaping as
 *     `POST /api/smart-refs`, then `redactPost` runs as before.
 * A contact with no personId (typed by hand, or written before references)
 * keeps its stored snapshot and reads exactly as it always has.
 */
import type { Block, Post, RegistrationBlock } from '../types/post'
import type { SmartPerson } from '../types/smart-refs'

const isRegistration = (b: Block): b is RegistrationBlock => b.kind === 'registration'

/** The person a registration block references, if it references one. */
export function registrationContactRef(block: Block): string | null {
  return isRegistration(block) && block.contactPerson?.personId ? block.contactPerson.personId : null
}

/**
 * The shape a post is STORED in: a referenced registration contact carries no
 * copied email/phone, and nothing read-time-only (`contactWithheld*`) is ever
 * persisted. Other blocks are returned unchanged (same object).
 */
export function storeReferences<T extends Block>(blocks: T[]): T[] {
  return blocks.map((block) => {
    if (!isRegistration(block)) return block
    const hasReadOnly = block.contactWithheld !== undefined || block.contactWithheldReason !== undefined
    if (!block.contactPerson?.personId && !hasReadOnly) return block
    const {
      contactWithheld: _w,
      contactWithheldReason: _r,
      ...rest
    } = block as RegistrationBlock
    if (!block.contactPerson?.personId) return rest as T
    const { contactEmail: _e, contactPhone: _p, ...referenced } = rest
    return referenced as T
  })
}

/** Every person id a post's registration contacts reference, de-duplicated. */
export function postContactRefs(post: Pick<Post, 'blocks'>): string[] {
  return [...new Set(post.blocks.map(registrationContactRef).filter((id): id is string => !!id))]
}

/**
 * Fill each referenced registration contact from its resolved person (already
 * shaped for the viewer). A reference that did not resolve keeps what the block
 * stored (the first-name floor). Pure; returns a new post.
 */
export function applyContactRefs(post: Post, people: Map<string, SmartPerson>): Post {
  return {
    ...post,
    blocks: post.blocks.map((block) => {
      const id = registrationContactRef(block)
      const person = id ? people.get(id) : undefined
      if (!id || !person) return block
      const reg = block as RegistrationBlock
      const { contactEmail: _e, contactPhone: _p, contactWithheld: _w, contactWithheldReason: _r, ...rest } = reg
      const out: RegistrationBlock = {
        ...rest,
        contactPerson: {
          firstName: person.firstName || reg.contactPerson?.firstName || '',
          ...(person.lastName ? { lastName: person.lastName } : {}),
          personId: id,
        },
      }
      if (person.email) out.contactEmail = person.email
      if (person.phone) out.contactPhone = person.phone
      const contactWithheld = person.withheld.filter((w) => w.field === 'email' || w.field === 'phone')
      if (contactWithheld.length > 0) {
        out.contactWithheld = true
        // `sign-in` wins: signing in is the action that could reveal the most.
        out.contactWithheldReason = contactWithheld.some((w) => w.reason === 'sign-in') ? 'sign-in' : 'scope'
      }
      return out
    }),
  }
}
