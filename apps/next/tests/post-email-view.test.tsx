import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@react-email/render'
import { PostEmailView } from 'email-builder/components/PostEmailView'
import type { Post } from '@my/app/types/post'

/**
 * PostEmailView render smoke test (Consolidated CMS #131, Phase 4b-2).
 *
 * PostEmailView is the SERVER-SAFE email twin of the web `PostView`: a plain
 * react-email component with no `'use client'` import, no context/hooks, no
 * Tamagui — so it renders cleanly from a plain-Node context (the same context the
 * cron newsletter renders in). This exercises `render()` of PostEmailView alone
 * (avoiding the Tamagui/lucide vitest wall the web PostView hits) and asserts each
 * block kind reaches expected strings. Input is an ALREADY-REDACTED post at member
 * tier (full names/locations present), matching what the newsletter feeds it.
 */

// A member-tier (already-redacted) post exercising all 7 block kinds.
const post: Post = {
  id: 'post-1',
  tenant: 'Toronto East',
  authorId: 'a',
  title: 'Wedding Shower for Sarah',
  occasion: ['wedding', 'shower'],
  summary: 'Please join us to celebrate.',
  visibility: 'members',
  sharingScope: 'own',
  lifecycle: { publishDate: '2026-07-01T00:00:00.000Z', startsAt: '2026-08-15T18:00:00.000Z' },
  blocks: [
    { id: 'b-text', kind: 'text', body: 'A **joyful** occasion — https://example.com/rsvp', containsPii: false },
    {
      id: 'b-person',
      kind: 'person',
      role: 'bride',
      people: [
        {
          id: 'ppl-1',
          firstName: 'Sarah',
          lastName: 'Johnson',
          ecclesia: 'Toronto East',
          bio: 'A cherished member.',
          contact: '416-555-1212',
        },
      ],
    },
    {
      id: 'b-loc',
      kind: 'location',
      mode: 'geo',
      label: 'Reception',
      venueName: 'Fellowship Hall',
      address: '975 Cosburn Avenue',
      city: 'Toronto',
      province: 'ON',
      onlineMeeting: { platform: 'zoom', link: 'https://zoom.us/j/123' } as any,
    },
    { id: 'b-time', kind: 'time', label: 'Shower', startsAt: '2026-08-15T18:00:00.000Z', timezone: 'America/Toronto' },
    {
      id: 'b-flyer',
      kind: 'flyer',
      document: {
        id: 'd1',
        fileName: 'shower.jpg',
        originalName: 'Shower Flyer.jpg',
        fileUrl: 'https://example.com/shower.jpg',
        mimeType: 'image/jpeg',
      } as any,
    },
    {
      id: 'b-reg',
      kind: 'registration',
      required: true,
      deadline: '2026-08-10',
      registrationUrl: 'https://example.com/register',
      contactEmail: 'host@example.com',
    },
    { id: 'b-link', kind: 'link', url: 'https://example.com/more', label: 'More info' },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  status: 'ready',
}

describe('PostEmailView — block coverage', () => {
  it('renders the header (occasion, title, summary)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('Wedding Shower for Sarah')
    expect(html).toContain('Wedding') // occasion, title-cased
    expect(html).toContain('Please join us to celebrate.')
  })

  it('renders the text block with markdown-lite (bold + auto-link)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('joyful')
    expect(html).toContain('https://example.com/rsvp')
  })

  it('renders the person block with FULL name, bio and contact (member tier)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('Sarah Johnson')
    expect(html).toContain('A cherished member.')
    expect(html).toContain('416-555-1212')
  })

  it('renders the location block (venue, address, directions link, online meeting)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('Fellowship Hall')
    expect(html).toContain('975 Cosburn Avenue')
    expect(html).toContain('Get directions')
    expect(html).toContain('Join online')
  })

  it('renders the time block (formatted date)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('August') // formatted date line
  })

  it('renders the flyer block (image + link)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('https://example.com/shower.jpg')
    expect(html).toContain('Shower Flyer.jpg')
  })

  it('renders the registration block (deadline + register link)', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('Registration required')
    expect(html).toContain('2026-08-10')
    expect(html).toContain('https://example.com/register')
    expect(html).toContain('Register')
  })

  it('renders the link block', async () => {
    const html = await render(<PostEmailView post={post} />)
    expect(html).toContain('More info')
    expect(html).toContain('https://example.com/more')
  })
})
