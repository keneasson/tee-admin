import type { Block, Post } from '@my/app/types/post'

/**
 * Pure state transitions for the {@link PostEditor}.
 *
 * The editor is a fully-controlled component (`value: Post`, `onChange`) — it
 * holds NO internal state. Every user action is expressed as a {@link PostAction}
 * and applied by {@link postReducer}, a pure function, so the editor's behaviour
 * is unit-testable without rendering (add / remove / reorder / patch a block, or
 * patch the post header). This is the "own store/reducer" the design calls for
 * (docs/UNIFIED_POST_MODEL_DESIGN.md §3.1) expressed as a reducer instead of a
 * hidden store, keeping the value/onChange contract the single boundary.
 *
 * Cross-platform: pure types + logic, no platform imports.
 */

export type PostAction =
  | { type: 'patch-post'; patch: Partial<Post> }
  /** Append a fully-formed block (created via a registry `make()`). */
  | { type: 'add-block'; block: Block }
  | { type: 'remove-block'; id: string }
  | { type: 'move-block'; id: string; direction: 'up' | 'down' }
  /** Merge a patch (or a full replacement block) into the block with `id`. */
  | { type: 'patch-block'; id: string; patch: Partial<Block> }

export function postReducer(post: Post, action: PostAction): Post {
  switch (action.type) {
    case 'patch-post':
      return { ...post, ...action.patch }

    case 'add-block':
      return { ...post, blocks: [...post.blocks, action.block] }

    case 'remove-block':
      return { ...post, blocks: post.blocks.filter((b) => b.id !== action.id) }

    case 'move-block': {
      const i = post.blocks.findIndex((b) => b.id === action.id)
      if (i < 0) return post
      const j = action.direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= post.blocks.length) return post
      const blocks = [...post.blocks]
      const tmp = blocks[i]
      blocks[i] = blocks[j]
      blocks[j] = tmp
      return { ...post, blocks }
    }

    case 'patch-block':
      return {
        ...post,
        blocks: post.blocks.map((b) =>
          b.id === action.id ? ({ ...b, ...action.patch } as Block) : b
        ),
      }

    default:
      return post
  }
}

/**
 * Client-side id generator for blocks (and unsaved drafts). Server-persisted
 * post ids are uuids assigned by the repository; block ids only need to be
 * unique within a post, so a compact time+random id is sufficient and avoids a
 * uuid dependency in shared UI.
 */
export function genId(prefix = 'blk'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

/**
 * A new, empty draft Post — the CREATE case of the one-editor principle. The
 * editor treats this exactly like a loaded existing Post; there is no separate
 * create form. `id: ''` marks it unsaved (the API assigns the real uuid on the
 * first save), so the page can branch create-vs-update purely on `id`.
 */
export function createEmptyPost(tenant: string, authorId: string): Post {
  const now = new Date().toISOString()
  return {
    id: '',
    tenant,
    authorId,
    title: '',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    blocks: [],
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  }
}

/**
 * Validate-on-PUBLISH only (never blocks typing/editing). A post may be
 * published once it has a title and at least one block. Returns human-readable
 * errors ([] = ok) so both the editor and the page can surface them inline.
 */
export function validateForPublish(post: Post): string[] {
  const errors: string[] = []
  if (!post.title.trim()) errors.push('A title is required')
  if (post.blocks.length === 0) errors.push('Add at least one block')
  return errors
}
