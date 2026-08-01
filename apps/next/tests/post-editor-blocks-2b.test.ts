import { describe, it, expect, beforeEach } from 'vitest'
import { registerBlock, getBlockDef, listBlockDefs, clearBlockRegistry } from '@my/ui/src/post-editor/registry'
import type {
  TextBlock,
  TimeBlock,
  PersonBlock,
  LocationBlock,
  FlyerBlock,
  RegistrationBlock,
  LinkBlock,
} from '@my/app/types/post'

/**
 * Phase 2b block factories + default registry order.
 *
 * IMPORTANT — why this doesn't `import` the real `blocks/*-block-editor.tsx`
 * files (mirrors the Phase 2a `post-editor-registry.test.ts` /
 * `post-editor-reducer.test.ts` convention, which do the same for Text/Time):
 * `person-block-editor.tsx`, `location-block-editor.tsx`, and
 * `registration-block-editor.tsx` pull in `@tamagui/lucide-icons` (directly,
 * or via `PlainSelect`/`PlainCheckbox`), and that package's CJS build loads
 * React Native's Flow-typed source, which this project's plain-Node Vitest
 * environment (`apps/next/vitest.config.ts` — no RN/Metro transform) cannot
 * parse — any such import hangs/fails regardless of what it's used for. This
 * predates 2b (Phase 2a's `text-block-editor.tsx`/`time-block-editor.tsx` hit
 * the exact same wall via `PlainSelect`) and is a test-infra gap, not a
 * runtime bug — the app itself builds and runs fine (see build/typecheck).
 * `flyer-block-editor.tsx` and `link-block-editor.tsx` import no icons, so
 * their `make()` factories ARE imported directly below for real coverage.
 */

const NoopEditor = () => null

const text = (id: string): TextBlock => ({ id, kind: 'text', body: '', containsPii: false })
const time = (id: string): TimeBlock => ({ id, kind: 'time' })
const person = (id: string): PersonBlock => ({ id, kind: 'person', role: 'speaker', people: [] })
const location = (id: string): LocationBlock => ({ id, kind: 'location', mode: 'plain' })
const registration = (id: string): RegistrationBlock => ({ id, kind: 'registration' })

describe('Phase 2b block factories — real imports (no icon deps)', () => {
  it('makeFlyerBlock() produces a block with an empty document attachment', async () => {
    const { makeFlyerBlock } = await import('@my/ui/src/post-editor/blocks/flyer-block-editor')
    const b: FlyerBlock = makeFlyerBlock()
    expect(b.kind).toBe('flyer')
    expect(typeof b.id).toBe('string')
    expect(b.id.length).toBeGreaterThan(0)
    expect(b.document.documentType).toBe('upload')
    expect(b.document.fileUrl).toBe('')
    expect(b.document.originalName).toBe('')
  })

  it('makeLinkBlock() produces an empty link block', async () => {
    const { makeLinkBlock } = await import('@my/ui/src/post-editor/blocks/link-block-editor')
    const b: LinkBlock = makeLinkBlock()
    expect(b.kind).toBe('link')
    expect(typeof b.id).toBe('string')
    expect(b.url).toBe('')
  })

  it('each make() call yields a fresh, unique id', async () => {
    const { makeLinkBlock } = await import('@my/ui/src/post-editor/blocks/link-block-editor')
    const a = makeLinkBlock()
    const b = makeLinkBlock()
    expect(a.id).not.toBe(b.id)
  })
})

describe('Phase 2b block shapes — person/location/registration (see file header)', () => {
  it('PersonBlock: role + people[] with an empty starting list', () => {
    const b = person('p1')
    expect(b.kind).toBe('person')
    expect(b.role).toBe('speaker')
    expect(b.people).toEqual([])
  })

  it('LocationBlock: defaults to plain mode', () => {
    const b = location('l1')
    expect(b.kind).toBe('location')
    expect(b.mode).toBe('plain')
  })

  it('RegistrationBlock: all-optional fields, valid with none set', () => {
    const b = registration('r1')
    expect(b.kind).toBe('registration')
    expect(b.required).toBeUndefined()
    expect(b.hasFee).toBeUndefined()
  })
})

describe('default block registry — full 7-kind order (Phase 2a + 2b)', () => {
  beforeEach(() => {
    clearBlockRegistry()
  })

  it('registers all 7 kinds in toolbar order', () => {
    // Mirrors the ORDER `register-default-blocks.ts` registers in — the
    // registry itself is the unit under test here (registration-order +
    // lookup contract); the real `make()`/`Editor` wiring for the
    // icon-bearing blocks is verified by reading the source (registry.ts's
    // own contract tests already cover register/get/list generically).
    registerBlock<TextBlock>('text', { label: 'Text', make: () => text('t'), Editor: NoopEditor })
    registerBlock<TimeBlock>('time', { label: 'Date & time', make: () => time('t'), Editor: NoopEditor })
    registerBlock<PersonBlock>('person', { label: 'Person', make: () => person('p'), Editor: NoopEditor })
    registerBlock<LocationBlock>('location', {
      label: 'Location',
      make: () => location('l'),
      Editor: NoopEditor,
    })
    registerBlock<FlyerBlock>('flyer', {
      label: 'Flyer',
      make: () => ({
        id: 'f',
        kind: 'flyer',
        document: {
          id: 'doc',
          documentType: 'upload',
          fileName: '',
          originalName: '',
          fileUrl: '',
          fileSize: 0,
          mimeType: '',
          uploadedAt: new Date(),
          uploadedBy: '',
        },
      }),
      Editor: NoopEditor,
    })
    registerBlock<RegistrationBlock>('registration', {
      label: 'Registration',
      make: () => registration('r'),
      Editor: NoopEditor,
    })
    registerBlock<LinkBlock>('link', {
      label: 'Link',
      make: () => ({ id: 'k', kind: 'link', url: '' }),
      Editor: NoopEditor,
    })

    expect(listBlockDefs().map((d) => d.kind)).toEqual([
      'text',
      'time',
      'person',
      'location',
      'flyer',
      'registration',
      'link',
    ])
    expect(getBlockDef('person')?.label).toBe('Person')
    expect(getBlockDef('flyer')?.make().kind).toBe('flyer')
  })
})
