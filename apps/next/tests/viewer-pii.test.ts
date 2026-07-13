import { describe, it, expect } from 'vitest'
import {
  effectiveRole,
  canRevealFullName,
  renderName,
  shapePersonName,
  roleAtLeast,
  ANONYMOUS_VIEWER,
  type Assurance,
  type Role,
  type Viewer,
} from '@my/app/utils/viewer-pii'

const peter = { firstName: 'Peter', lastName: 'Skariah', ecclesia: 'Toronto East' }
const viewer = (assurance: Assurance, role: Role, tenant: string | null = 'Toronto East'): Viewer => ({
  assurance,
  role,
  tenant,
  email: 'x@y.z',
})

describe('effectiveRole — a token/recognized viewer is capped at member', () => {
  it('caps above-member roles to member when not authenticated', () => {
    expect(effectiveRole('owner', 'recognized')).toBe('member')
    expect(effectiveRole('admin', 'recognized')).toBe('member')
    expect(effectiveRole('rep', 'recognized')).toBe('member')
    expect(effectiveRole('recorder', 'recognized')).toBe('member')
    expect(effectiveRole('member', 'recognized')).toBe('member')
  })
  it('leaves below-member roles unchanged', () => {
    expect(effectiveRole('guest', 'recognized')).toBe('guest')
    expect(effectiveRole(undefined, 'recognized')).toBe('guest')
  })
  it('keeps the real role once authenticated', () => {
    expect(effectiveRole('owner', 'authenticated')).toBe('owner')
    expect(effectiveRole('admin', 'authenticated')).toBe('admin')
    expect(effectiveRole('rep', 'authenticated')).toBe('rep')
  })
  it('anonymous also caps (defensive)', () => {
    expect(effectiveRole('admin', 'anonymous')).toBe('member')
  })
})

describe('roleAtLeast', () => {
  it('member-or-greater', () => {
    expect(roleAtLeast('member', 'member')).toBe(true)
    expect(roleAtLeast('admin', 'member')).toBe(true)
    expect(roleAtLeast('guest', 'member')).toBe(false)
    expect(roleAtLeast(undefined, 'member')).toBe(false)
  })
})

describe('canRevealFullName — verified member-or-greater only', () => {
  it('hides for anonymous', () => {
    expect(canRevealFullName(ANONYMOUS_VIEWER)).toBe(false)
  })
  it('hides for a recognized (unverified) member — forward-safety', () => {
    expect(canRevealFullName(viewer('recognized', 'member'))).toBe(false)
  })
  it('hides for an authenticated guest (signed in, not a member)', () => {
    expect(canRevealFullName(viewer('authenticated', 'guest'))).toBe(false)
  })
  it('reveals for an authenticated member', () => {
    expect(canRevealFullName(viewer('authenticated', 'member'))).toBe(true)
  })
  it('reveals for an authenticated admin/owner', () => {
    expect(canRevealFullName(viewer('authenticated', 'admin'))).toBe(true)
    expect(canRevealFullName(viewer('authenticated', 'owner'))).toBe(true)
  })
})

describe('renderName / shapePersonName — server-side redaction', () => {
  it('first name only for anonymous', () => {
    expect(renderName(peter, ANONYMOUS_VIEWER)).toBe('Peter')
    expect(shapePersonName(peter, ANONYMOUS_VIEWER)).toEqual({ firstName: 'Peter' })
  })
  it('first name only for a recognized member', () => {
    const v = viewer('recognized', 'member')
    expect(renderName(peter, v)).toBe('Peter')
    expect(shapePersonName(peter, v)).toEqual({ firstName: 'Peter' })
  })
  it('NEVER carries lastName in a redacted shape (no ship-then-hide)', () => {
    expect(shapePersonName(peter, viewer('recognized', 'member'))).not.toHaveProperty('lastName')
    expect(shapePersonName(peter, ANONYMOUS_VIEWER)).not.toHaveProperty('lastName')
  })
  it('full name for an authenticated member', () => {
    const v = viewer('authenticated', 'member')
    expect(renderName(peter, v)).toBe('Peter Skariah')
    expect(shapePersonName(peter, v)).toEqual({ firstName: 'Peter', lastName: 'Skariah' })
  })
  it('two Peters stay indistinguishable in the public view (no initial)', () => {
    const peter2 = { firstName: 'Peter', lastName: 'Thomas' }
    expect(renderName(peter, ANONYMOUS_VIEWER)).toBe(renderName(peter2, ANONYMOUS_VIEWER))
  })
})
