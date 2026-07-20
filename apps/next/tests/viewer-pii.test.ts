import { describe, it, expect } from 'vitest'
import {
  effectiveRole,
  canRevealFullName,
  canRevealPii,
  renderName,
  shapePersonName,
  shapeLocation,
  revealBio,
  roleAtLeast,
  ANONYMOUS_VIEWER,
  type Assurance,
  type Role,
  type Viewer,
  type LocationLike,
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

describe('canRevealPii — channel-aware (design §8.2)', () => {
  it('public-web follows the viewer tier', () => {
    expect(canRevealPii(ANONYMOUS_VIEWER, 'public-web')).toBe(false)
    expect(canRevealPii(viewer('recognized', 'member'), 'public-web')).toBe(false)
    expect(canRevealPii(viewer('authenticated', 'member'), 'public-web')).toBe(true)
  })
  it('newsletter-email always reveals — curated member audience', () => {
    expect(canRevealPii(ANONYMOUS_VIEWER, 'newsletter-email')).toBe(true)
    expect(canRevealPii(viewer('recognized', 'member'), 'newsletter-email')).toBe(true)
  })
  it('defaults to public-web when channel omitted', () => {
    expect(canRevealPii(viewer('recognized', 'member'))).toBe(false)
  })
})

describe('name/bio via the newsletter-email channel show full', () => {
  it('full name in the newsletter even for a recognized recipient', () => {
    const v = viewer('recognized', 'member')
    expect(renderName(peter, v, 'newsletter-email')).toBe('Peter Skariah')
    expect(shapePersonName(peter, v, 'newsletter-email')).toEqual({ firstName: 'Peter', lastName: 'Skariah' })
  })
  it('bio shown in newsletter, hidden on public web', () => {
    const v = viewer('recognized', 'member')
    expect(revealBio('An obituary', v, 'newsletter-email')).toBe('An obituary')
    expect(revealBio('An obituary', v, 'public-web')).toBeUndefined()
    expect(revealBio('An obituary', viewer('authenticated', 'member'), 'public-web')).toBe('An obituary')
  })
})

describe('shapeLocation — anon floor is venue + city (design §8.1)', () => {
  const hall: LocationLike = {
    venueName: 'Toronto East Hall', city: 'Toronto', province: 'ON',
    address: '123 Main St', postalCode: 'M1M 1M1', lat: 43.7, lng: -79.3,
  }
  it('anon gets venue + city + province only, no street/postal/geo', () => {
    expect(shapeLocation(hall, ANONYMOUS_VIEWER)).toEqual({
      venueName: 'Toronto East Hall', city: 'Toronto', province: 'ON',
    })
  })
  it('redacted shape NEVER carries address/postal/geo (no ship-then-hide)', () => {
    const shaped = shapeLocation(hall, ANONYMOUS_VIEWER)!
    expect(shaped).not.toHaveProperty('address')
    expect(shaped).not.toHaveProperty('postalCode')
    expect(shaped).not.toHaveProperty('lat')
    expect(shaped).not.toHaveProperty('lng')
  })
  it('authenticated member gets the full location', () => {
    expect(shapeLocation(hall, viewer('authenticated', 'member'))).toEqual(hall)
  })
  it('newsletter-email gets the full location even for a recognized recipient', () => {
    expect(shapeLocation(hall, viewer('recognized', 'member'), 'newsletter-email')).toEqual(hall)
  })
  it('a private residence is hidden entirely for anon, shown for member+', () => {
    const home: LocationLike = { venueName: 'The Smith residence', city: 'Toronto', address: '5 Elm St', privateResidence: true }
    expect(shapeLocation(home, ANONYMOUS_VIEWER)).toBeUndefined()
    expect(shapeLocation(home, viewer('authenticated', 'member'))).toEqual(home)
  })
})
