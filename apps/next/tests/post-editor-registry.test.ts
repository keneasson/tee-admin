import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerBlock,
  getBlockDef,
  listBlockDefs,
  clearBlockRegistry,
} from '@my/ui/src/post-editor/registry'
import type { TextBlock, TimeBlock } from '@my/app/types/post'

/**
 * Block registry contract (Consolidated CMS Phase 2a). The registry is the
 * editor's extensibility seam — register / get / list, in registration order.
 * A no-op component stands in for a real Editor so the test stays free of any
 * Tamagui/React rendering.
 */

const NoopEditor = () => null

beforeEach(() => {
  clearBlockRegistry()
})

describe('block registry', () => {
  it('register → get returns the same definition (with kind filled in)', () => {
    registerBlock<TextBlock>('text', {
      label: 'Text',
      make: () => ({ id: 'x', kind: 'text', body: '', containsPii: false }),
      Editor: NoopEditor,
    })

    const def = getBlockDef('text')
    expect(def).toBeDefined()
    expect(def!.kind).toBe('text')
    expect(def!.label).toBe('Text')
    expect(def!.make().kind).toBe('text')
  })

  it('make() yields a fresh block each call (unique ids when a generator is used)', () => {
    let n = 0
    registerBlock<TimeBlock>('time', {
      label: 'Date & time',
      make: () => ({ id: `t${n++}`, kind: 'time' }),
      Editor: NoopEditor,
    })
    const a = getBlockDef('time')!.make()
    const b = getBlockDef('time')!.make()
    expect(a.id).not.toBe(b.id)
  })

  it('listBlockDefs returns all defs in registration order', () => {
    registerBlock<TextBlock>('text', {
      label: 'Text',
      make: () => ({ id: 'x', kind: 'text', body: '', containsPii: false }),
      Editor: NoopEditor,
    })
    registerBlock<TimeBlock>('time', {
      label: 'Date & time',
      make: () => ({ id: 'y', kind: 'time' }),
      Editor: NoopEditor,
    })
    expect(listBlockDefs().map((d) => d.kind)).toEqual(['text', 'time'])
  })

  it('re-registering the same kind overrides the definition', () => {
    registerBlock<TextBlock>('text', {
      label: 'First',
      make: () => ({ id: 'x', kind: 'text', body: '', containsPii: false }),
      Editor: NoopEditor,
    })
    registerBlock<TextBlock>('text', {
      label: 'Second',
      make: () => ({ id: 'x', kind: 'text', body: '', containsPii: false }),
      Editor: NoopEditor,
    })
    expect(getBlockDef('text')!.label).toBe('Second')
    expect(listBlockDefs()).toHaveLength(1)
  })

  it('getBlockDef returns undefined for an unregistered kind', () => {
    expect(getBlockDef('person')).toBeUndefined()
  })
})
