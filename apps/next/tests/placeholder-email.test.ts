import { describe, it, expect } from 'vitest'
import {
  isPlaceholderEmail,
  displayableEmail,
  withoutPlaceholderEmails,
} from '@my/app/utils/placeholder-email'

/**
 * Relationships are keyed by email, so a person with no address of their own —
 * or who shares a household one — gets a generated key such as
 * `pending-1789001511101-dntj1@family.local`.
 *
 * That is plumbing. Showing it makes a record look broken and invites somebody
 * to try emailing an address that can never receive anything: `family.local` is
 * not a routable domain.
 */
describe('placeholder addresses are recognised', () => {
  it('spots a generated key address', () => {
    expect(isPlaceholderEmail('pending-1789001511101-dntj1@family.local')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isPlaceholderEmail('Pending-123-ABC@Family.Local')).toBe(true)
  })

  it('leaves real addresses alone', () => {
    expect(isPlaceholderEmail('bgrosewood@gmail.com')).toBe(false)
    expect(isPlaceholderEmail('someone@family.local.example.com')).toBe(false)
  })

  it('treats absent as not-a-placeholder rather than throwing', () => {
    expect(isPlaceholderEmail(undefined)).toBe(false)
    expect(isPlaceholderEmail(null)).toBe(false)
    expect(isPlaceholderEmail('')).toBe(false)
  })
})

describe('placeholders never reach a display surface', () => {
  it('displayableEmail hides a placeholder', () => {
    expect(displayableEmail('pending-1-x@family.local')).toBeUndefined()
    expect(displayableEmail('bgrosewood@gmail.com')).toBe('bgrosewood@gmail.com')
  })

  it('filters a list down to real addresses', () => {
    const kept = withoutPlaceholderEmails([
      { email: 'bgrosewood@gmail.com' },
      { email: 'pending-1-x@family.local' },
      { email: undefined },
    ])
    expect(kept).toHaveLength(2)
    expect(kept.some((k) => k.email?.includes('family.local'))).toBe(false)
  })
})
