import { describe, it, expect } from 'vitest'
import {
  OBITUARY_TEMPLATE,
  TEMPLATES,
  applyTemplate,
} from '@my/app/features/post-editor/templates'
import type { Block } from '@my/app/types/post'

/**
 * Templates are a pure scaffold generator: `applyTemplate` turns a template + a
 * set of enabled section keys into a flat, ordered `Block[]` of empty-but-labelled
 * placeholders. These tests pin the shape/order and the "scaffold, not lock"
 * contract (every emitted block is an unfilled placeholder). No React/Tamagui.
 */

const kinds = (blocks: Block[]) => blocks.map((b) => b.kind)

/** Mirrors BlockWidget.isBlockEmpty for the kinds a template emits. */
function isPlaceholder(b: Block): boolean {
  switch (b.kind) {
    case 'location':
      return !b.venueName && !b.address && !b.city
    case 'time':
      return !b.startsAt
    case 'person':
      return b.people.length === 0
    case 'flyer':
      return !b.document.fileUrl.trim()
    case 'text':
      // Prompt/heading text is intentionally seeded (annotation), not a placeholder.
      return false
    default:
      return true
  }
}

describe('applyTemplate — obituary', () => {
  it('is registered', () => {
    expect(TEMPLATES.map((t) => t.id)).toContain('obituary')
  })

  it('core spine has portrait, deceased person, and a narrative prompt', () => {
    const blocks = applyTemplate(OBITUARY_TEMPLATE, [])
    expect(kinds(blocks)).toEqual(['flyer', 'person', 'text'])
    const person = blocks[1]
    expect(person.kind === 'person' && person.role).toBe('deceased')
  })

  it('default sections (visitation + memorial) append in template order', () => {
    const defaults = OBITUARY_TEMPLATE.sections.filter((s) => s.defaultOn).map((s) => s.key)
    expect(defaults).toEqual(['visitation', 'memorial'])

    const blocks = applyTemplate(OBITUARY_TEMPLATE, defaults)
    // core(3) + 2 sections × [heading, time, location, prompt] = 3 + 8
    expect(kinds(blocks)).toEqual([
      'flyer', 'person', 'text',
      'text', 'time', 'location', 'text',
      'text', 'time', 'location', 'text',
    ])
  })

  it('each service section contributes exactly one time + one location', () => {
    const one = applyTemplate(OBITUARY_TEMPLATE, ['graveside'])
    expect(one.filter((b) => b.kind === 'time')).toHaveLength(1)
    expect(one.filter((b) => b.kind === 'location')).toHaveLength(1)
    const loc = one.find((b) => b.kind === 'location')
    expect(loc?.kind === 'location' && loc.label).toBe('Graveside Service')
  })

  it('toggling all sections on yields all four, in declared order', () => {
    const all = OBITUARY_TEMPLATE.sections.map((s) => s.key)
    const blocks = applyTemplate(OBITUARY_TEMPLATE, all)
    const timeLabels = blocks.filter((b) => b.kind === 'time').map((b) => (b.kind === 'time' ? b.label : ''))
    expect(timeLabels).toEqual([
      'Visitation',
      'Memorial Service',
      'Celebration of Life',
      'Graveside Service',
    ])
  })

  it('every structured block is an unfilled placeholder (scaffold, not data)', () => {
    const all = OBITUARY_TEMPLATE.sections.map((s) => s.key)
    const structured = applyTemplate(OBITUARY_TEMPLATE, all).filter((b) => b.kind !== 'text')
    expect(structured.every(isPlaceholder)).toBe(true)
  })

  it('unknown section keys are ignored', () => {
    const blocks = applyTemplate(OBITUARY_TEMPLATE, ['nope', 'visitation'])
    expect(blocks.filter((b) => b.kind === 'time')).toHaveLength(1)
  })
})
