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
import { $createPostBlockNode, $isPostBlockNode } from './post-block-node'
import { $getRoot } from 'lexical'
import { makeToolBlock, makeSeededToolBlock, type ToolKind } from '@my/app/features/post-editor/tool-blocks'
import { isPhraseKind } from '@my/app/types/post'
import { useEditSession } from './edit-session'

export interface ArmedToolPluginProps {
  armed: ToolKind | null
  onInserted: () => void
}

/**
 * Resolve a decorator's CURRENT Lexical key by the stable id of the block it
 * carries. Node keys are Lexical's own identity and can change across an
 * insertion; the block id is ours and does not.
 */
function findNodeKeyByBlockId(
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  blockId: string
): string | null {
  let key: string | null = null
  editor.getEditorState().read(() => {
    const walk = (nodes: ReturnType<typeof $getRoot>['getChildren'] extends () => infer R ? R : never) => {
      for (const node of nodes as any[]) {
        if ($isPostBlockNode(node) && node.getBlock().id === blockId) {
          key = node.getKey()
          return
        }
        if (typeof node.getChildren === 'function') walk(node.getChildren())
        if (key) return
      }
    }
    walk($getRoot().getChildren() as any)
  })
  return key
}

export function ArmedToolPlugin({ armed, onInserted }: ArmedToolPluginProps) {
  const [editor] = useLexicalComposerContext()
  const { beginEdit } = useEditSession()

  useEffect(() => {
    if (!armed) return

    // CONVERT-SELECTION: if there is a live non-collapsed selection when the tool
    // is armed, replace it with a seeded block immediately (no canvas click).
    //
    // The key is resolved AFTER the update commits, by looking the node up by
    // its block id. `sel.insertNodes()` may clone the node during normalisation,
    // so a key captured before insertion can already be stale — which showed up
    // as "This element is no longer in the document." the moment the floating
    // editor opened. `$insertNodeToNearestRoot` did not have that problem, so
    // the bug arrived with inline placement.
    let convertedId: string | null = null
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel) || sel.isCollapsed()) return
      const text = sel.getTextContent().trim()
      if (text.length === 0) return

      const block = makeSeededToolBlock(armed, text)

      // A phrase kind stays WHERE THE AUTHOR WROTE IT. Identifying "11:00 AM" as
      // a Time must not tear it out of "First class starts at 11:00 AM in the
      // hall" and restack it — that is what made the editor feel like a form,
      // and it is what stops the author adding the one extra detail a fixed
      // widget has no slot for. `insertNodes` puts the inline node at the caret
      // inside the paragraph; `$insertNodeToNearestRoot` would lift it to root.
      if (isPhraseKind(block.kind)) {
        sel.removeText()
        sel.insertNodes([$createPostBlockNode(block, true)])
        convertedId = block.id
        return
      }

      // A flyer or a registration panel is genuinely standalone — it still takes
      // its own line.
      sel.removeText()
      $insertNodeToNearestRoot($createPostBlockNode(block))
      convertedId = block.id
    })
    if (convertedId) {
      onInserted()
      const key = findNodeKeyByBlockId(editor, convertedId)
      // Open the seeded element in the floating tool so its resolver (pre-filled
      // with the selected text) is ready to confirm — never an inline form.
      if (key) beginEdit(key)
      return
    }

    // INSERT-AT-CARET: otherwise arm a one-shot click that drops a blank block.
    return editor.registerCommand(
      CLICK_COMMAND,
      () => {
        let newId: string | null = null
        editor.update(() => {
          const block = makeToolBlock(armed)
          $insertNodeToNearestRoot($createPostBlockNode(block))
          newId = block.id
        })
        onInserted()
        // Open the freshly-placed element straight into the floating editor —
        // the user never meets an inline form; the element lands as its (empty)
        // final display and its editor opens in the tool.
        const key = newId ? findNodeKeyByBlockId(editor, newId) : null
        if (key) beginEdit(key)
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, armed, onInserted, beginEdit])

  return null
}
