import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@react-email/render'
import Newsletter from 'email-builder/emails/Newsletter'
import type { Post } from '@my/app/types/post'

/**
 * Newsletter × Community Posts wiring (Consolidated CMS #131, Phase 4b-2).
 *
 * Proves the flag-gated inclusion AT THE TEMPLATE LEVEL — the guarantee the
 * community's primary email channel depends on:
 *   - `posts` present → a "Community Posts" section appears (the additive cutover);
 *   - `posts` empty / absent → NO section, and (byte-identical proof) the rendered
 *     HTML is EXACTLY what the same template produces with no `posts` prop at all.
 * The caller (`getNewsletterNativePosts`) passes a non-empty `posts` ONLY when the
 * CONSOLIDATED_CMS flag is on, so "flag OFF" ≡ "posts empty" ≡ byte-identical.
 *
 * Renders the real `<Newsletter>` (server-safe: no `'use client'` / Tamagui in its
 * module graph) with the template's built-in mock schedule/events/readings, so no
 * DynamoDB/Google mocking is needed.
 */

const communityPost: Post = {
  id: 'post-1',
  tenant: 'Toronto East',
  authorId: 'a',
  title: 'Community Picnic Announcement',
  occasion: ['general'],
  visibility: 'members',
  sharingScope: 'own',
  lifecycle: { publishDate: '2026-07-01T00:00:00.000Z', startsAt: '2026-08-15T18:00:00.000Z' },
  blocks: [{ id: 't', kind: 'time', label: 'Picnic', startsAt: '2026-08-15T18:00:00.000Z' }],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  status: 'ready',
}

describe('Newsletter — Community Posts section (flag-gated via `posts`)', () => {
  it('includes the section + post title when posts are passed', async () => {
    const html = await render(<Newsletter posts={[communityPost]} />)
    expect(html).toContain('Community Posts')
    expect(html).toContain('Community Picnic Announcement')
  })

  it('omits the section entirely when posts is empty', async () => {
    const html = await render(<Newsletter posts={[]} />)
    expect(html).not.toContain('Community Posts')
    expect(html).not.toContain('Community Picnic Announcement')
  })

  it('flag OFF is BYTE-IDENTICAL: posts=[] equals the no-posts-prop render', async () => {
    const withEmptyPosts = await render(<Newsletter posts={[]} />)
    const withoutProp = await render(<Newsletter />)
    expect(withEmptyPosts).toBe(withoutProp)
    expect(withoutProp).not.toContain('Community Posts')
  })
})
