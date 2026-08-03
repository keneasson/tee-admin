'use client'

/**
 * ArmedToolPlugin — the Photoshop-style "armed tool → click to drop" mechanic
 * (Consolidated CMS Phase 2R-1 keystone). While a tool is armed (the parent holds
 * `armed` state, set by the floating toolbar), the NEXT click inside the editor
 * inserts a fresh {@link PostBlockNode} of that kind at the caret via Lexical's
 * `$insertNodeToNearestRoot` (which splits the surrounding paragraph so the widget
 * lands exactly at the insertion point), then disarms.
 *
 * The pure state-transition equivalent of this insert is
 * {@link insertBlockNodeAt} in doc-serialization.ts, which is what the unit tests
 * exercise (the full Lexical editor can't mount headless in vitest cleanly).
 */

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { CLICK_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical'
import { $insertNodeToNearestRoot } from '@lexical/utils'
import { $createPostBlockNode } from './post-block-node'
import { makeToolBlock, type ToolKind } from './tool-blocks'

export interface ArmedToolPluginProps {
  armed: ToolKind | null
  onInserted: () => void
}

export function ArmedToolPlugin({ armed, onInserted }: ArmedToolPluginProps) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!armed) return
    return editor.registerCommand(
      CLICK_COMMAND,
      () => {
        editor.update(() => {
          const node = $createPostBlockNode(makeToolBlock(armed))
          $insertNodeToNearestRoot(node)
        })
        onInserted()
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, armed, onInserted])

  return null
}
