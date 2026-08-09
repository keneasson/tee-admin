import { describe, it, expect } from 'vitest'
import {
  postReducer,
  createEmptyPost,
  validateForPublish,
} from '@my/ui/src/post-editor/post-reducer'
import type { Block, PersonBlock, Post, TextBlock, TimeBlock } from '@my/app/types/post'

/**
 * Reducer-level tests for the PostEditor's pure state transitions
 * (Consolidated CMS Phase 2a). The editor is a controlled component; all its
 * behaviour flows through `postReducer`, so these cover add / remove / reorder /
 * patch-block + patch-post + the create-case factory + publish validation
 * without rendering.
 */

const text = (id: string, body = ''): TextBlock => ({ id, kind: 'text', body, containsPii: false })
const time = (id: string): TimeBlock => ({ id, kind: 'time' })

function draft(blocks: Block[] = []): Post {
  return { ...createEmptyPost('tee', 'author@x.com'), blocks }
}

describe('createEmptyPost', () => {
  it('produces an empty, unsaved draft (id === "") ready for the SAME editor as edit', () => {
    const p = createEmptyPost('tee', 'author@x.com')
    expect(p.id).toBe('')
    expect(p.tenant).toBe('tee')
    expect(p.authorId).toBe('author@x.com')
    expect(p.status).toBe('draft')
    expect(p.visibility).toBe('public')
    expect(p.sharingScope).toBe('own')
    expect(p.occasion).toEqual(['general'])
    expect(p.blocks).toEqual([])
    expect(typeof p.createdAt).toBe('string')
  })
})

describe('validateForPublish', () => {
  it('requires a title and at least one block', () => {
    expect(validateForPublish(draft())).toEqual([
      'A title is required',
      'Add at least one block',
    ])
  })
  it('passes with a title + a block', () => {
    const p: Post = { ...draft([text('a', 'hello')]), title: 'Hi' }
    expect(validateForPublish(p)).toEqual([])
  })
  it('treats whitespace-only titles as empty', () => {
    const p: Post = { ...draft([text('a')]), title: '   ' }
    expect(validateForPublish(p)).toContain('A title is required')
  })
})

describe('postReducer', () => {
  it('patch-post merges header fields immutably', () => {
    const p = draft()
    const next = postReducer(p, { type: 'patch-post', patch: { title: 'New', visibility: 'members' } })
    expect(next.title).toBe('New')
    expect(next.visibility).toBe('members')
    expect(p.title).toBe('') // original untouched
    expect(next).not.toBe(p)
  })

  it('add-block appends the provided block', () => {
    const next = postReducer(draft(), { type: 'add-block', block: text('a') })
    expect(next.blocks.map((b) => b.id)).toEqual(['a'])
  })

  it('remove-block drops by id', () => {
    const next = postReducer(draft([text('a'), text('b')]), { type: 'remove-block', id: 'a' })
    expect(next.blocks.map((b) => b.id)).toEqual(['b'])
  })

  it('move-block up/down reorders; no-ops at the edges', () => {
    const p = draft([text('a'), text('b'), text('c')])
    const down = postReducer(p, { type: 'move-block', id: 'a', direction: 'down' })
    expect(down.blocks.map((b) => b.id)).toEqual(['b', 'a', 'c'])

    const up = postReducer(p, { type: 'move-block', id: 'c', direction: 'up' })
    expect(up.blocks.map((b) => b.id)).toEqual(['a', 'c', 'b'])

    const noop = postReducer(p, { type: 'move-block', id: 'a', direction: 'up' })
    expect(noop.blocks.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(noop).toBe(p) // edge move returns the same reference

    const unknown = postReducer(p, { type: 'move-block', id: 'zzz', direction: 'down' })
    expect(unknown).toBe(p)
  })

  it('patch-block merges into the matching block only, preserving kind + id', () => {
    const p = draft([text('a', 'old'), time('b')])
    const next = postReducer(p, {
      type: 'patch-block',
      id: 'a',
      patch: { body: 'new', containsPii: true } as Partial<Block>,
    })
    const a = next.blocks[0] as TextBlock
    expect(a).toMatchObject({ id: 'a', kind: 'text', body: 'new', containsPii: true })
    expect(next.blocks[1]).toEqual(time('b')) // other block untouched
    expect((p.blocks[0] as TextBlock).body).toBe('old') // original untouched
  })

  it('patch-block with a full replacement block (editor onChange contract) replaces fields', () => {
    const p = draft([text('a', 'old')])
    const replacement: TextBlock = { id: 'a', kind: 'text', body: 'replaced', containsPii: false }
    const next = postReducer(p, { type: 'patch-block', id: 'a', patch: replacement })
    expect(next.blocks[0]).toEqual(replacement)
  })

  it('patch-block on a PersonBlock preserves each person entry\'s stable id (Phase 2c)', () => {
    const person: PersonBlock = {
      id: 'pb1',
      kind: 'person',
      role: 'candidate',
      people: [{ id: 'ppl-1', firstName: 'Josh' }],
    }
    const p = draft([person])
    const patched = postReducer(p, {
      type: 'patch-block',
      id: 'pb1',
      patch: { people: [{ id: 'ppl-1', firstName: 'Josh', lastName: 'A' }] } as Partial<Block>,
    })
    const result = patched.blocks[0] as PersonBlock
    expect(result.people[0].id).toBe('ppl-1') // id is stable across an edit
    expect(result.people[0].lastName).toBe('A')

    // Removing then re-adding a person via a fresh id, as the editor's
    // add/remove flow does, still round-trips cleanly through the reducer.
    const withSecondPerson = postReducer(patched, {
      type: 'patch-block',
      id: 'pb1',
      patch: {
        people: [
          { id: 'ppl-1', firstName: 'Josh', lastName: 'A' },
          { id: 'ppl-2', firstName: 'New' },
        ],
      } as Partial<Block>,
    })
    expect((withSecondPerson.blocks[0] as PersonBlock).people.map((pp) => pp.id)).toEqual([
      'ppl-1',
      'ppl-2',
    ])
  })
})
