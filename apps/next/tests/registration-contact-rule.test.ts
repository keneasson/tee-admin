import { describe, it, expect } from 'vitest'
import {
  registrationContactError,
  contactDisplayName,
} from '@my/app/features/post-editor/resolvers/registration-resolve'
import { validateForPublish } from '@my/ui/src/post-editor/post-reducer'
import type { Post } from '@my/app/types/post'

// #254: a contact must always have a safe fallback, so a bare email can't publish.
describe('registrationContactError', () => {
  it('blocks an email or phone with no contact first name (the Shelburne shape)', () => {
    expect(registrationContactError({ contactEmail: 'jessica@example.com' })).toMatch(/first name/)
    expect(registrationContactError({ contactPhone: '416', contactPerson: { firstName: '  ' } })).toMatch(/first name/)
  })
  it('passes with a first name, or with no contact detail at all', () => {
    expect(registrationContactError({ contactEmail: 'j@x.y', contactPerson: { firstName: 'Jessica' } })).toBeNull()
    expect(registrationContactError({})).toBeNull()
  })
  it('contactDisplayName renders full or floor', () => {
    expect(contactDisplayName({ firstName: 'Jessica', lastName: 'Easson' })).toBe('Jessica Easson')
    expect(contactDisplayName({ firstName: 'Jessica' })).toBe('Jessica')
    expect(contactDisplayName(undefined)).toBe('')
  })
})

describe('validateForPublish — registration contact', () => {
  const post = (reg: object): Post =>
    ({ id: 'p', title: 'Reception', visibility: 'public', status: 'draft', blocks: [{ id: 'r', kind: 'registration', ...reg }] }) as unknown as Post
  it('refuses to publish a nameless contact', () => {
    expect(validateForPublish(post({ contactEmail: 'jessica@example.com' })).join()).toMatch(/first name/)
  })
  it('publishes once the contact is named', () => {
    expect(validateForPublish(post({ contactEmail: 'j@x.y', contactPerson: { firstName: 'Jessica' } }))).toEqual([])
  })
})
