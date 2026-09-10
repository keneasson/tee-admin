import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * `profile.canEdit` was ASSIGNED further down the route than it was READ.
 *
 * The contacts are mapped around line 240-290; `canEdit` was not set until the
 * owner/admin and recorder/rep blocks around line 320. At mapping time it was
 * therefore always `undefined`, so `emailId`, `phoneId` and `addressId` were
 * silently omitted from EVERY response — and every control that needs a record
 * id to act on could never render, for anyone:
 *
 *   - "Set as login email" (#191, where this was first caught),
 *   - "Verify" on a pending address or phone change (#234).
 *
 * Both features were built, merged, and could not work. Unit tests passed
 * because they exercised the pieces in isolation and never the ORDER.
 *
 * This asserts the ordering directly, because that is the actual defect: a
 * value must be computed before anything reads it.
 */
const SOURCE = readFileSync('app/api/people/[email]/route.ts', 'utf8')
const lines = SOURCE.split('\n')
const lineOf = (needle: string) => lines.findIndex((l) => l.includes(needle)) + 1

describe('canEdit is computed before it is read', () => {
  it('is defined before the contact records are mapped', () => {
    const computed = lineOf('const viewerCanEdit =')
    expect(computed).toBeGreaterThan(0)

    for (const consumer of ['{ emailId:', '{ phoneId:', '{ addressId:']) {
      const readAt = lineOf(consumer)
      expect(readAt).toBeGreaterThan(0)
      expect(computed).toBeLessThan(readAt)
    }
  })

  it('the contact gates use the computed value, not the late assignment', () => {
    // `profile.canEdit` is assigned AFTER the mapping, so reading it there is
    // the bug. Nothing in the mapping may depend on it.
    expect(SOURCE).not.toContain('...(profile.canEdit ? { emailId')
    expect(SOURCE).not.toContain('...(profile.canEdit ? { phoneId')
    expect(SOURCE).not.toContain('...(profile.canEdit ? { addressId')
  })

  it('the exposed flag and the internal gate cannot disagree', () => {
    // Both assignments derive from the single computed value rather than
    // recomputing the rule, so they cannot drift apart.
    const assignments = lines.filter((l) => l.includes('profile.canEdit ='))
    expect(assignments.length).toBeGreaterThan(0)
    for (const a of assignments) expect(a).toContain('viewerCanEdit')
  })
})
