'use client'

/**
 * PostBlockNode — the Lexical `DecoratorNode` that embeds a structured Post
 * {@link Block} in the document canvas (Consolidated CMS Phase 2R-1 keystone).
 * This is the seam that makes the editor "structured underneath, freeform on
 * top": prose is ordinary Lexical text; every structured element is one of these
 * decorator nodes sitting between paragraphs, rendered as its FINAL published
 * display (see {@link BlockWidget}) — never a form. Editing happens in the
 * floating tool, not in the document.
 *
 * The node carries the FULL typed block as its payload (`__block`), plus where
 * it sits (`__inline`):
 *
 *  - **block-level** (default) — a direct child of the root, interleaved with
 *    paragraphs. A flyer or a registration panel is genuinely standalone.
 *  - **inline** — a child of a paragraph, so the value is a phrase inside the
 *    author's own sentence: "First class starts at 11:00 AM (doors 1:30)". The
 *    words around it stay prose, which is the whole point — a fixed widget can
 *    never hold that one extra detail, and prose always can.
 *
 * Placement is DERIVED from where the `{{kind:id}}` marker sits in the prose
 * (see `inline-markers.ts`), never declared on the Block. The stack just happens
 * to be stacked. `exportJSON` emits `{ type: 'post-block', block, inline }`,
 * which is what `docToBlocks` walks; `importJSON` restores it.
 */

import type { ReactNode } from 'react'
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical'
import type { Block } from '@my/app/types/post'
import { POST_BLOCK_TYPE, type SerializedPostBlockNode } from '@my/app/features/post-editor/doc-serialization'
import { BlockWidget } from './block-widget'

export class PostBlockNode extends DecoratorNode<ReactNode> {
  __block: Block
  __inline: boolean

  static getType(): string {
    return POST_BLOCK_TYPE
  }

  static clone(node: PostBlockNode): PostBlockNode {
    return new PostBlockNode(node.__block, node.__inline, node.__key)
  }

  // Param widened to the base signature (SerializedLexicalNode) so the static
  // side stays assignable to DecoratorNode under strictFunctionTypes; the `block`
  // payload is read back off the concrete shape.
  static importJSON(json: SerializedLexicalNode): PostBlockNode {
    const j = json as SerializedPostBlockNode
    return new PostBlockNode(j.block, j.inline === true)
  }

  constructor(block: Block, inline = false, key?: NodeKey) {
    super(key)
    this.__block = block
    this.__inline = inline
  }

  exportJSON(): SerializedPostBlockNode {
    return {
      type: POST_BLOCK_TYPE,
      block: this.__block,
      inline: this.__inline,
      version: 1,
    }
  }

  getBlock(): Block {
    return this.getLatest().__block
  }

  /** Replace the carried block (the widget's onChange path). Uses a writable clone. */
  setBlock(next: Block): void {
    const writable = this.getWritable()
    writable.__block = next
  }

  isInline(): boolean {
    return this.__inline
  }

  createDOM(): HTMLElement {
    // A span so the value sits in the line box with the surrounding words; a div
    // would force a break and re-create the stacking this exists to avoid.
    const el = document.createElement(this.__inline ? 'span' : 'div')
    el.className = this.__inline ? 'post-block-node post-block-node--inline' : 'post-block-node'
    return el
  }

  updateDOM(): false {
    return false
  }

  decorate(): ReactNode {
    return <BlockWidget nodeKey={this.getKey()} block={this.__block} inline={this.__inline} />
  }
}

export function $createPostBlockNode(block: Block, inline = false): PostBlockNode {
  return new PostBlockNode(block, inline)
}

export function $isPostBlockNode(node: LexicalNode | null | undefined): node is PostBlockNode {
  return node instanceof PostBlockNode
}
