import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@react-email/render'
import { PostEmailView } from 'email-builder/components/PostEmailView'
import { redactPost } from '@my/app/utils/redact-post'
import { markerFor, findMarkers } from '@my/app/features/post-editor/inline-markers'
import type { Post, PersonBlock, TextBlock, TimeBlock } from '@my/app/types/post'
import type { Viewer } from '@my/app/utils/viewer-pii'

/**
 * The published half of the §2.2 inline revision (#225).
 *
 * Two things must hold once a value lives inside a sentence:
 *   1. EMAIL renders the value in the prose, and never renders it twice — the
 *      block is in `blocks[]` AND placed by a marker, so a naive `blocks.map`
 *      would publish it once inline and once as a standalone panel.
 *   2. REDACTION that drops a block must drop its marker too, or a withheld name
 *      ships to the list as a literal `{{person:p1}}`.
 */
const time: TimeBlock = {
  id: 't1',
  kind: 'time',
  timezone: 'America/Toronto',
  display: '11:00 AM',
}

const person: PersonBlock = {
  id: 'p1',
  kind: 'person',
  role: 'contact',
  visibility: 'members', // members-only: anon must not see this name
  people: [{ id: 'x', firstName: 'Gordon', lastName: 'Easson' }],
}

const postWith = (body: string, blocks: Post['blocks']): Post =>
  ({
    id: 'post1',
    tenant: 'Toronto East Ecclesia',
    authorId: 'a',
    title: 'Study Weekend',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    status: 'ready',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    blocks: [{ id: 'txt', kind: 'text', body, containsPii: false } as TextBlock, ...blocks],
  }) as unknown as Post

describe('email render — inline values in the sentence', () => {
  it('renders the value inside the prose', async () => {
    const post = postWith(`First class starts at ${markerFor(time)} in the hall.`, [time])
    const html = await render(<PostEmailView post={post} />)

    expect(html).toContain('First class starts at 11:00 AM in the hall.')
    expect(html).not.toContain('{{')
  })

  it('does NOT also render it as a standalone panel (no double publish)', async () => {
    const post = postWith(`Starts at ${markerFor(time)}.`, [time])
    const html = await render(<PostEmailView post={post} />)

    // "11:00 AM" appears once — in the sentence, not again in its own block.
    expect(html.split('11:00 AM').length - 1).toBe(1)
  })

  it('still renders an unreferenced block standalone (pre-marker posts)', async () => {
    const post = postWith('Plain prose with no markers.', [time])
    const html = await render(<PostEmailView post={post} />)

    expect(html).toContain('Plain prose with no markers.')
    expect(html).toContain('11:00 AM')
  })
})

describe('redaction — a dropped block takes its marker with it', () => {
  const anon: Viewer = { assurance: 'anonymous', role: 'guest', tenant: null, email: null }
  const member: Viewer = {
    assurance: 'authenticated',
    role: 'member',
    tenant: 'Toronto East Ecclesia',
    email: 'm@x.z',
  }

  it('anon: the members-only name is withheld AND its marker is gone', () => {
    const post = postWith(`Contact ${markerFor(person)} for details.`, [person])
    const redacted = redactPost(post, anon)!

    const text = redacted.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.body).not.toContain('{{')
    expect(text.body).not.toContain('person:p1')
    expect(findMarkers(text.body)).toHaveLength(0)
    expect(redacted.blocks.some((b) => b.kind === 'person')).toBe(false)
  })

  it('member: the block survives, so its marker is left in place', () => {
    const post = postWith(`Contact ${markerFor(person)} for details.`, [person])
    const redacted = redactPost(post, member)!

    const text = redacted.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(findMarkers(text.body)).toHaveLength(1)
    expect(redacted.blocks.some((b) => b.kind === 'person')).toBe(true)
  })

  it('anon never receives the withheld name in the rendered email', async () => {
    const post = postWith(`Contact ${markerFor(person)} for details.`, [person])
    const html = await render(<PostEmailView post={redactPost(post, anon)!} />)

    expect(html).not.toContain('Easson')
    expect(html).not.toContain('{{')
  })
})
