import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { createElement } from 'react'
import PostAnnouncement from '../../email-builder/emails/PostAnnouncement'
import { redactPost } from '@my/app/utils/redact-post'
import type { Post } from '@my/app/types/post'
import type { Viewer } from '@my/app/utils/viewer-pii'

/**
 * Render + audience-resolution for the Consolidated CMS send bridge (§4-A/B).
 *
 * The announcement goes to the opted-in MEMBER audience, so it renders at member
 * tier via the `'newsletter-email'` channel — the narrow, audited full-PII door.
 * These tests prove the two halves that make one bridge:
 *   1. audience resolution — the member/newsletter-email redaction reveals full
 *      names + members-only blocks (and an 'admins'-only post is withheld);
 *   2. render — ANY occasion (here funeral) renders through the ONE
 *      PostAnnouncement shell with no per-type code, surfacing the revealed PII.
 */

const MEMBER_VIEWER: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'Toronto East Ecclesia',
  email: null,
}

function funeralPost(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    tenant: 'Toronto East Ecclesia',
    authorId: 'owner@tee-admin.com',
    title: 'Funeral of Brother John',
    occasion: ['funeral'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    status: 'ready',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    blocks: [
      {
        id: 'b-person',
        kind: 'person',
        role: 'deceased',
        people: [
          {
            id: 'per-1',
            firstName: 'John',
            lastName: 'Smith',
            bio: 'A faithful brother for fifty years.',
          },
        ],
      },
      {
        id: 'b-obit',
        kind: 'text',
        body: 'The obituary text, members only.',
        containsPii: true,
        visibility: 'members',
      },
    ],
    ...over,
  }
}

describe('post announcement — member/newsletter-email audience resolution', () => {
  it('reveals full name, bio, and the members-only block at member tier', () => {
    const redacted = redactPost(funeralPost(), MEMBER_VIEWER, { channel: 'newsletter-email' })
    expect(redacted).not.toBeNull()
    // Members-only obituary block survives.
    expect(redacted!.blocks.some((b) => b.id === 'b-obit')).toBe(true)
    const person = redacted!.blocks.find((b) => b.kind === 'person') as any
    expect(person.people[0].lastName).toBe('Smith')
    expect(person.people[0].bio).toContain('fifty years')
  })

  it('withholds a post whose own visibility excludes members', () => {
    const redacted = redactPost(funeralPost({ visibility: 'admins' }), MEMBER_VIEWER, {
      channel: 'newsletter-email',
    })
    expect(redacted).toBeNull()
  })
})

describe('post announcement — render (occasion-agnostic)', () => {
  it('renders a redacted funeral post through the ONE shell with revealed PII', async () => {
    const redacted = redactPost(funeralPost(), MEMBER_VIEWER, { channel: 'newsletter-email' })!
    const html = await render(
      createElement(PostAnnouncement as any, {
        post: redacted,
        subject: redacted.title,
        note: 'Please keep the family in your prayers.',
        identity: { name: 'Toronto East Christadelphians' },
      })
    )
    expect(html).toContain('Funeral of Brother John')
    expect(html).toContain('Smith') // full name revealed at member tier
    expect(html).toContain('fifty years') // bio revealed
    expect(html).toContain('The obituary text') // members-only block rendered
    expect(html).toContain('Please keep the family in your prayers.') // note box
  })

  it('produces a plain-text twin', async () => {
    const redacted = redactPost(funeralPost(), MEMBER_VIEWER, { channel: 'newsletter-email' })!
    const text = await render(
      createElement(PostAnnouncement as any, { post: redacted, subject: redacted.title }),
      { plainText: true }
    )
    expect(text).toContain('Funeral of Brother John')
    expect(text).toContain('Smith')
  })
})
