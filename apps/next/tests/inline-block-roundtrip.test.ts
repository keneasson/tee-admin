import { describe, it, expect } from 'vitest'
import {
  docToBlocks,
  blocksToDocState,
} from '@my/app/features/post-editor/doc-serialization'
import {
  markerFor,
  segmentBody,
  stripMarkers,
  findMarkers,
  flattenMarkers,
} from '@my/app/features/post-editor/inline-markers'
import type { Block, TextBlock, TimeBlock } from '@my/app/types/post'

/**
 * Design §2.2 (revised): a typed value keeps its place in the author's own
 * words. Converting "11:00 AM" into a Time must NOT tear the phrase out onto a
 * line of its own — the sentence keeps flowing, and the author stays free to
 * write the one extra detail ("doors 1:30, tea after") around it, because the
 * words around the value are prose, not a template's fixed slots.
 *
 * Layout is DERIVED, never a field: a marker among words flows inline; a block
 * nothing references keeps its own top-level slot, exactly as before markers
 * existed.
 */
const time: TimeBlock = {
  id: 't1',
  kind: 'time',
  timezone: 'America/Toronto',
  display: '11:00 AM',
}

describe('inline markers — a value inside the author’s sentence', () => {
  it('round-trips a sentence with an embedded value, sentence intact', () => {
    const prose: TextBlock = {
      id: 'p1',
      kind: 'text',
      body: `First class starts at ${markerFor(time)} in the hall.`,
      containsPii: false,
    }

    const back = docToBlocks(blocksToDocState([prose, time]))

    const text = back.find((b): b is TextBlock => b.kind === 'text')!
    // ONE text block — not shattered into "starts at" + time + "in the hall".
    expect(back.filter((b) => b.kind === 'text')).toHaveLength(1)
    expect(text.body).toBe(`First class starts at ${markerFor(time)} in the hall.`)

    // The typed block still lands in blocks[] for email/newsletter extraction.
    const t = back.find((b) => b.kind === 'time') as TimeBlock
    expect(t.display).toBe('11:00 AM')
  })

  it('keeps the author’s extra detail around the value (the whole point)', () => {
    const prose: TextBlock = {
      id: 'p1',
      kind: 'text',
      body: `When: ${markerFor(time)} (doors 1:30, tea after)`,
      containsPii: false,
    }

    const back = docToBlocks(blocksToDocState([prose, time]))
    const text = back.find((b): b is TextBlock => b.kind === 'text')!

    expect(text.body).toContain('(doors 1:30, tea after)')
    expect(text.body).toContain('When:')
  })

  it('a block nothing references keeps its own slot — pre-marker posts unchanged', () => {
    const prose: TextBlock = { id: 'p1', kind: 'text', body: 'Plain prose.', containsPii: false }

    const back = docToBlocks(blocksToDocState([prose, time]))

    expect(back.map((b) => b.kind)).toEqual(['text', 'time'])
    expect((back[0] as TextBlock).body).toBe('Plain prose.')
    expect(findMarkers((back[0] as TextBlock).body)).toHaveLength(0)
  })

  it('never loses a referenced block whose host prose was deleted', () => {
    const orphanRef: TextBlock = {
      id: 'p1',
      kind: 'text',
      body: markerFor(time), // marker only; block still must survive
      containsPii: false,
    }
    const back = docToBlocks(blocksToDocState([orphanRef, time]))
    expect(back.some((b) => b.id === 't1' || b.kind === 'time')).toBe(true)
  })

  it('a marker naming a missing block collapses — never leaks {{…}}', () => {
    const dangling: TextBlock = {
      id: 'p1',
      kind: 'text',
      body: 'Starts at {{time:gone}} sharp.',
      containsPii: false,
    }
    const back = docToBlocks(blocksToDocState([dangling]))
    const text = back.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.body).not.toContain('{{')
    expect(text.body).toContain('Starts at')
    expect(text.body).toContain('sharp.')
  })
})

describe('marker helpers', () => {
  it('segments a body into text and block runs', () => {
    const segs = segmentBody(`On ${markerFor(time)} we meet.`)
    expect(segs.map((s) => s.type)).toEqual(['text', 'block', 'text'])
    expect(segs[0]).toEqual({ type: 'text', text: 'On ' })
    expect(segs[2]).toEqual({ type: 'text', text: ' we meet.' })
  })

  it('strips markers to readable prose for plain-text consumers', () => {
    expect(stripMarkers(`When: ${markerFor(time)} (doors 1:30)`)).toBe('When: (doors 1:30)')
  })
})

describe('published output — no duplication, no leaked markers', () => {
  it('flattens a marker to its value for plain-text consumers', () => {
    const blocks = new Map<string, Block>([['t1', time]])
    const out = flattenMarkers(
      `First class starts at ${markerFor(time)} in the hall.`,
      (b) => (b.kind === 'time' ? (b as TimeBlock).display! : ''),
      blocks
    )
    expect(out).toBe('First class starts at 11:00 AM in the hall.')
    expect(out).not.toContain('{{')
  })

  it('a redacted-away block leaves clean prose, not a hole in the sentence', () => {
    // Redaction drops the block; the marker must not survive as literal text.
    const out = flattenMarkers(
      `Contact ${markerFor({ id: 'p9', kind: 'person' })} for details.`,
      () => '',
      new Map()
    )
    expect(out).not.toContain('{{')
    expect(out).toBe('Contact for details.')
  })
})
