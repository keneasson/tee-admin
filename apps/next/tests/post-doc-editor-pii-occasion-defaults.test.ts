import { describe, it, expect } from 'vitest'
import {
  PII_BEARING_OCCASIONS,
  occasionIsPiiBearing,
  gatePiiProse,
  ungatePiiProse,
} from '../features/post-doc-editor/pii-occasion-defaults'
import type { Block, FlyerBlock, LocationBlock, TextBlock } from '@my/app/types/post'

/**
 * The PII gate that ships with the doc-editor wiring (Consolidated CMS keystone,
 * design §2): plain canvas prose emitted by `docToBlocks` is `containsPii:false`
 * with NO visibility override, so under a sensitive occasion it would serialize
 * PUBLIC. `gatePiiProse` forces such prose to members-only for persistence;
 * `ungatePiiProse` is its clean inverse for seeding the editor with bare prose.
 * These are pure (no Lexical / Tamagui) — exactly where the safety lives.
 */

const text = (body: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id: `t_${body.slice(0, 4)}`,
  kind: 'text',
  body,
  containsPii: false,
  ...over,
})

const location: LocationBlock = { id: 'l1', kind: 'location', mode: 'plain', city: 'Toronto' }
const flyer: FlyerBlock = {
  id: 'f1',
  kind: 'flyer',
  visibility: 'members',
  document: {
    id: 'd1',
    documentType: 'upload',
    fileName: 'x.png',
    originalName: 'x',
    fileUrl: '/x.png',
    fileSize: 0,
    mimeType: 'image/png',
    uploadedAt: new Date(0),
    uploadedBy: 'seed',
  },
}

describe('occasionIsPiiBearing', () => {
  it('is true for funeral / medical / baptism and false otherwise', () => {
    for (const tag of PII_BEARING_OCCASIONS) {
      expect(occasionIsPiiBearing([tag])).toBe(true)
    }
    expect(occasionIsPiiBearing(['general'])).toBe(false)
    expect(occasionIsPiiBearing(['news', 'announcement'])).toBe(false)
    expect(occasionIsPiiBearing(['general', 'funeral'])).toBe(true)
  })
})

describe('gatePiiProse — members-default under a sensitive occasion', () => {
  it('forces prose to containsPii:true + visibility:members under a PII occasion', () => {
    const out = gatePiiProse([text('An obituary.'), location], ['funeral'], false)
    const gated = out[0] as TextBlock
    expect(gated.containsPii).toBe(true)
    expect(gated.visibility).toBe('members')
    // Non-text blocks are untouched (their own visibility round-trips unchanged).
    expect(out[1]).toBe(location)
  })

  it('is a no-op when the occasion is not PII-bearing', () => {
    const blocks: Block[] = [text('Just news.'), location]
    expect(gatePiiProse(blocks, ['news'], false)).toEqual(blocks)
  })

  it('is a no-op when make-public is on (author opt-out)', () => {
    const blocks: Block[] = [text('An obituary.')]
    const out = gatePiiProse(blocks, ['funeral'], true)
    expect((out[0] as TextBlock).visibility).toBeUndefined()
    expect((out[0] as TextBlock).containsPii).toBe(false)
  })

  it('is idempotent', () => {
    const once = gatePiiProse([text('Obit.')], ['medical'], false)
    const twice = gatePiiProse(once, ['medical'], false)
    expect(twice).toEqual(once)
  })
})

describe('ungatePiiProse — inverse for seeding the editor with bare prose', () => {
  it('strips the auto-gate signature back to bare prose under a PII occasion', () => {
    const gated = gatePiiProse([text('Obit.')], ['funeral'], false)
    const back = ungatePiiProse(gated, ['funeral'])
    const bare = back[0] as TextBlock
    expect(bare.containsPii).toBe(false)
    expect(bare.visibility).toBeUndefined()
  })

  it('gate → ungate → gate is stable (round-trip)', () => {
    const raw: Block[] = [text('Obit.'), location]
    const gated = gatePiiProse(raw, ['funeral'], false)
    const seed = ungatePiiProse(gated, ['funeral'])
    const reGated = gatePiiProse(seed, ['funeral'], false)
    expect(reGated).toEqual(gated)
  })

  it('leaves a deliberate members text block alone under a NON-PII occasion', () => {
    const deliberate = text('Members note.', { containsPii: true, visibility: 'members' })
    const out = ungatePiiProse([deliberate], ['news'])
    expect(out[0]).toBe(deliberate)
  })

  it('never touches non-text blocks (per-block visibility preserved)', () => {
    const out = ungatePiiProse([flyer], ['funeral'])
    expect(out[0]).toBe(flyer)
    expect((out[0] as FlyerBlock).visibility).toBe('members')
  })
})
