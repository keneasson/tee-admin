import { describe, it, expect } from 'vitest'
import {
  makeLocationBlock,
  makeSeededLocationBlock,
  ecclesiaToLocationBlock,
  plainLocationBlock,
  externalPlaceToLocationBlock,
  isLocationResolved,
  pickUniqueMatch,
  canEditEcclesiaClient,
  type EcclesiaSuggestion,
} from '../features/post-doc-editor/widgets/location-resolve'
import { makeToolBlock, makeSeededToolBlock } from '../features/post-doc-editor/tool-blocks'
import {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedTopNode,
} from '../features/post-doc-editor/doc-serialization'
import type { LocationBlock, TextBlock } from '@my/app/types/post'

/**
 * Pure logic for the PROGRESSIVE Location resolver + the paste-and-distil
 * convert-selection seed (Consolidated CMS Phase 2R-1b). Kept dependency-light
 * (no React / Tamagui / Lexical / next-auth) so it runs in a plain node vitest —
 * the block-mapping decisions are where correctness actually lives; the stateful
 * shell just wires fetches to them. The "search API" is represented here as
 * fixture result arrays (the mock).
 */

const text = (id: string, body: string): TextBlock => ({ id, kind: 'text', body, containsPii: false })

describe('convert-selection seeding (makeSeededToolBlock / makeSeededLocationBlock)', () => {
  it('seeds a Location block with the selected text as the resolver query (venueName)', () => {
    const seeded = makeSeededToolBlock('location', 'Toronto East Ecclesial Hall') as LocationBlock
    expect(seeded.kind).toBe('location')
    expect(seeded.mode).toBe('plain')
    expect(seeded.venueName).toBe('Toronto East Ecclesial Hall')
    expect(seeded.id).toBeTruthy()
  })

  it('trims the seed and gives each call a fresh id; unwired tools throw (2R-2)', () => {
    const a = makeSeededLocationBlock('  East Hall  ')
    expect(a.venueName).toBe('East Hall')
    expect(makeSeededLocationBlock('x').id).not.toBe(a.id)
    expect(() => makeSeededToolBlock('person', 'anything')).toThrow()
  })

  it('empty-caret insert still yields a BLANK Location block (no seed)', () => {
    const blank = makeToolBlock('location') as LocationBlock
    expect(blank.mode).toBe('plain')
    expect(blank.venueName).toBeUndefined()
    const blank2 = makeLocationBlock()
    expect(blank2.venueName).toBeUndefined()
  })

  it('a converted selection produces a valid LocationBlock IN DOCUMENT ORDER', () => {
    // Document is prose | prose; "convert" drops a seeded location between them.
    const children = blocksToDocState([text('a', 'Before'), text('b', 'After')]).root.children
    const inserted = insertBlockNodeAt(children, 1, makeSeededToolBlock('location', 'East Hall'))
    const round = docToBlocks({ root: { children: inserted as SerializedTopNode[] } })
    expect(round.map((b) => b.kind)).toEqual(['text', 'location', 'text'])
    expect((round[1] as LocationBlock).venueName).toBe('East Hall')
  })
})

describe('ecclesia resolution: a picked directory ecclesia → mode:"ecclesia" block', () => {
  // Fixture standing in for the /api/ecclesia/search response (the mocked API).
  const searchResults: EcclesiaSuggestion[] = [
    { name: 'Toronto East', city: 'Toronto', province: 'ON', country: 'CA', venue: 'Toronto East Ecclesial Hall' },
  ]

  it('maps the picked ecclesia onto the block as mode:"ecclesia" with the ref + venue', () => {
    const base = makeSeededLocationBlock('Toronto East', 'blk1')
    const resolved = ecclesiaToLocationBlock(searchResults[0], base)
    expect(resolved.id).toBe('blk1') // identity preserved
    expect(resolved.mode).toBe('ecclesia')
    expect(resolved.ecclesiaRef).toBe('Toronto East')
    expect(resolved.venueName).toBe('Toronto East Ecclesial Hall')
    expect(resolved.city).toBe('Toronto')
    expect(resolved.province).toBe('ON')
  })

  it('preserves progressive-disclosure extras (label/directions) across resolution', () => {
    const base: LocationBlock = {
      id: 'b',
      kind: 'location',
      mode: 'plain',
      label: 'Study Weekend',
      directions: 'Enter via the north door',
    }
    const resolved = ecclesiaToLocationBlock(searchResults[0], base)
    expect(resolved.label).toBe('Study Weekend')
    expect(resolved.directions).toBe('Enter via the north door')
  })

  it('a resolved ecclesia block round-trips through the doc serialization unchanged', () => {
    const resolved = ecclesiaToLocationBlock(searchResults[0], makeSeededLocationBlock('Toronto East', 'l1'))
    const round = docToBlocks(blocksToDocState([resolved]))
    expect(round).toHaveLength(1)
    expect(round[0]).toEqual(resolved)
  })
})

describe('pickUniqueMatch — the seed auto-resolution rule', () => {
  const results: EcclesiaSuggestion[] = [
    { name: 'Toronto East', city: 'Toronto' },
    { name: 'Toronto West', city: 'Toronto' },
  ]
  it('takes an exact (case-insensitive) name match', () => {
    expect(pickUniqueMatch('toronto east', results)?.name).toBe('Toronto East')
  })
  it('takes a sole result when there is exactly one', () => {
    expect(pickUniqueMatch('anything', [results[0]])?.name).toBe('Toronto East')
  })
  it('returns null when ambiguous (no exact match, multiple results)', () => {
    expect(pickUniqueMatch('toronto', results)).toBeNull()
  })
})

describe('isLocationResolved — chip vs. input view', () => {
  it('a bare seed (plain + venueName only) is NOT resolved → opens the input', () => {
    expect(isLocationResolved(makeSeededLocationBlock('East Hall'))).toBe(false)
  })
  it('a blank block is NOT resolved', () => {
    expect(isLocationResolved(makeLocationBlock())).toBe(false)
  })
  it('an ecclesia ref, a geo result, or a plain venue WITH geo context ARE resolved', () => {
    expect(isLocationResolved({ id: 'a', kind: 'location', mode: 'ecclesia', ecclesiaRef: 'X' })).toBe(true)
    expect(isLocationResolved({ id: 'b', kind: 'location', mode: 'geo', address: '1 Main St' })).toBe(true)
    expect(isLocationResolved({ id: 'c', kind: 'location', mode: 'plain', venueName: 'Hall', city: 'Toronto' })).toBe(true)
  })
})

describe('plain + external mappers', () => {
  it('plainLocationBlock clears any ecclesia ref and sets the typed venue name', () => {
    const prev: LocationBlock = { id: 'p', kind: 'location', mode: 'ecclesia', ecclesiaRef: 'X', venueName: 'X' }
    const plain = plainLocationBlock('Community Centre', prev)
    expect(plain.mode).toBe('plain')
    expect(plain.ecclesiaRef).toBeUndefined()
    expect(plain.venueName).toBe('Community Centre')
  })
  it('externalPlaceToLocationBlock builds a geo block from parsed place details', () => {
    const geo = externalPlaceToLocationBlock(
      { name: 'City Hall', streetAddress: '100 Queen St W', city: 'Toronto', province: 'ON', country: 'CA', lat: 43.6, lng: -79.3 },
      makeSeededLocationBlock('City Hall', 'g1')
    )
    expect(geo.mode).toBe('geo')
    expect(geo.address).toBe('100 Queen St W')
    expect(geo.lat).toBe(43.6)
    expect(geo.ecclesiaRef).toBeUndefined()
  })
})

describe('canEditEcclesiaClient — mirrors the server edit rule', () => {
  it('owner may edit any ecclesia', () => {
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'OWNER', ecclesia: 'Other' })).toBe(true)
  })
  it('same-ecclesia admin / rep / recorder may edit', () => {
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'ADMIN', ecclesia: 'TEE' })).toBe(true)
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'REP', ecclesia: 'TEE' })).toBe(true)
  })
  it('same-ecclesia recording brother (designation) may edit', () => {
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'MEMBER', ecclesia: 'TEE', isRecordingBrother: true })).toBe(true)
  })
  it('a different-ecclesia admin, a plain member, and a null ref may NOT', () => {
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'ADMIN', ecclesia: 'Other' })).toBe(false)
    expect(canEditEcclesiaClient({ ecclesiaRef: 'TEE', role: 'MEMBER', ecclesia: 'TEE' })).toBe(false)
    expect(canEditEcclesiaClient({ ecclesiaRef: undefined, role: 'OWNER', ecclesia: 'TEE' })).toBe(false)
  })
})
