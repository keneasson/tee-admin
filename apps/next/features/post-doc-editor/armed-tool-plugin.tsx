'use client'

/**
 * ArmedToolPlugin — the Photoshop-style armed-tool mechanic with the
 * paste-and-distil CONVERT-SELECTION interaction (Consolidated CMS Phase 2R-1b).
 * When a tool is armed (parent state, set by the floating toolbar), two things
 * can happen:
 *
 *  - CONVERT (selection): if a NON-collapsed text selection exists at the moment
 *    the tool is armed, its text is extracted, the range is deleted, and a
 *    {@link PostBlockNode} SEEDED with that text is dropped in its place (for
 *    Location the seed becomes the resolver's initial query). This is the primary
 *    paste-a-raw-email → select "Toronto East Ecclesial Hall" → click Location
 *    workflow. Reads Lexical's editor-state selection (which survives the toolbar
 *    click's DOM blur), so no click in the canvas is needed.
 *  - INSERT (caret): with only a caret, the next click in the canvas drops a
 *    BLANK block at the caret via `$insertNodeToNearestRoot` (the original
 *    keystone behavior), then disarms.
 *
 * The pure state-transition equivalent of the insert is {@link insertBlockNodeAt}
 * in doc-serialization.ts; the seed factory is {@link makeSeededToolBlock}. Both
 * are what the unit tests exercise (the full Lexical editor can't mount headless
 * in vitest cleanly).
 */

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical'
import { $insertNodeToNearestRoot } from '@lexical/utils'
import { $createPostBlockNode } from './post-block-node'
import { makeToolBlock, makeSeededToolBlock, type ToolKind } from '@my/app/features/post-editor/tool-blocks'
import { useEditSession } from './edit-session'

export interface ArmedToolPluginProps {
  armed: ToolKind | null
  onInserted: () => void
}

export function ArmedToolPlugin({ armed, onInserted }: ArmedToolPluginProps) {
  const [editor] = useLexicalComposerContext()
  const { beginEdit } = useEditSession()

  useEffect(() => {
    if (!armed) return

    // CONVERT-SELECTION: if there is a live non-collapsed selection when the tool
    // is armed, replace it with a seeded block immediately (no canvas click).
    let convertedKey: string | null = null
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel) || sel.isCollapsed()) return
      const text = sel.getTextContent().trim()
      if (text.length === 0) return
      // Delete the selected range, then drop the seeded widget at the caret.
      sel.removeText()
      const node = $createPostBlockNode(makeSeededToolBlock(armed, text))
      $insertNodeToNearestRoot(node)
      convertedKey = node.getKey()
    })
    if (convertedKey) {
      onInserted()
      // Open the seeded element in the floating tool so its resolver (pre-filled
      // with the selected text) is ready to confirm — never an inline form.
      beginEdit(convertedKey)
      return
    }

    // INSERT-AT-CARET: otherwise arm a one-shot click that drops a blank block.
    return editor.registerCommand(
      CLICK_COMMAND,
      () => {
        let newKey: string | null = null
        editor.update(() => {
          const node = $createPostBlockNode(makeToolBlock(armed))
          $insertNodeToNearestRoot(node)
          newKey = node.getKey()
        })
        onInserted()
        // Open the freshly-placed element straight into the floating editor —
        // the user never meets an inline form; the element lands as its (empty)
        // final display and its editor opens in the tool.
        if (newKey) beginEdit(newKey)
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, armed, onInserted, beginEdit])

  return null
}
