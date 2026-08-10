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
 * The node carries the FULL typed block as its payload (`__block`). It is block-
 * level (`isInline() === false`) so it lives as a direct child of the root,
 * interleaved with paragraphs — exactly the ordered `Post.blocks[]` shape. Its
 * `exportJSON` emits `{ type: 'post-block', block }`, which is what
 * `docToBlocks` walks; `importJSON` restores it from `blocksToDocState` output.
 */

import type { ReactNode } from 'react'
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical'
import type { Block } from '@my/app/types/post'
import { POST_BLOCK_TYPE, type SerializedPostBlockNode } from './doc-serialization'
import { BlockWidget } from './block-widget'

export class PostBlockNode extends DecoratorNode<ReactNode> {
  __block: Block

  static getType(): string {
    return POST_BLOCK_TYPE
  }

  static clone(node: PostBlockNode): PostBlockNode {
    return new PostBlockNode(node.__block, node.__key)
  }

  // Param widened to the base signature (SerializedLexicalNode) so the static
  // side stays assignable to DecoratorNode under strictFunctionTypes; the `block`
  // payload is read back off the concrete shape.
  static importJSON(json: SerializedLexicalNode): PostBlockNode {
    return new PostBlockNode((json as SerializedPostBlockNode).block)
  }

  constructor(block: Block, key?: NodeKey) {
    super(key)
    this.__block = block
  }

  exportJSON(): SerializedPostBlockNode {
    return { type: POST_BLOCK_TYPE, block: this.__block, version: 1 }
  }

  getBlock(): Block {
    return this.getLatest().__block
  }

  /** Replace the carried block (the widget's onChange path). Uses a writable clone. */
  setBlock(next: Block): void {
    const writable = this.getWritable()
    writable.__block = next
  }

  isInline(): false {
    return false
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'post-block-node'
    return div
  }

  updateDOM(): false {
    return false
  }

  decorate(): ReactNode {
    return <BlockWidget nodeKey={this.getKey()} block={this.__block} />
  }
}

export function $createPostBlockNode(block: Block): PostBlockNode {
  return new PostBlockNode(block)
}

export function $isPostBlockNode(node: LexicalNode | null | undefined): node is PostBlockNode {
  return node instanceof PostBlockNode
}
