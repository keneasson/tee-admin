'use client'

/**
 * PostDocEditor — the document-canvas editor (Consolidated CMS Phase 2R-1
 * KEYSTONE): the Google-Docs / Notion redo of the block-form editor. You write
 * prose freely and drop structured elements INLINE where you place them, rendered
 * as clear form-widgets in the flow (see {@link BlockWidget}). "Structured
 * underneath, freeform on top": the data model, lifecycle, redaction and
 * rendering are all untouched — this is a CONTAINER SWAP for the authoring
 * experience only. The document ⇄ `Post.blocks[]` bijection lives in
 * {@link docToBlocks} / {@link blocksToDocState}.
 *
 * WEB-ONLY (a DOM rich-text editor cannot live in cross-platform packages/ui):
 * built on Lexical (`lexical` + `@lexical/react`, MIT / Meta). It MAY import the
 * Tamagui block editors from packages/ui (apps → packages is allowed); nothing in
 * packages/ui imports this editor.
 *
 * Controlled by the SAME contract the block-form editor uses: `initialBlocks`
 * seeds the document, `onBlocksChange` emits the ordered blocks on every edit.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HeadingNode } from '@lexical/rich-text'
import type { EditorState } from 'lexical'
import type { Block } from '@my/app/types/post'
import { PostBlockNode } from './post-block-node'
import { ArmedToolPlugin } from './armed-tool-plugin'
import { FloatingToolbar } from './floating-toolbar'
import { EditSessionProvider } from './edit-session'
import { blocksToDocState, docToBlocks } from './doc-serialization'
import { type ToolKind } from './tool-blocks'

export interface PostDocEditorProps {
  /** Seeds the document (order preserved). Read once at mount. */
  initialBlocks?: Block[]
  /** Emits the ordered blocks derived from the document on every edit. */
  onBlocksChange?: (blocks: Block[]) => void
}

const EDITOR_THEME = {
  paragraph: 'pde-paragraph',
  heading: { h1: 'pde-h1', h2: 'pde-h2', h3: 'pde-h3' },
  text: { bold: 'pde-bold', italic: 'pde-italic' },
}

export function PostDocEditor({ initialBlocks = [], onBlocksChange }: PostDocEditorProps) {
  const [armed, setArmed] = useState<ToolKind | null>(null)

  // Seed the editor state ONCE from the initial blocks (Lexical owns it after);
  // intentionally computed a single time at mount. Callers re-seed by remounting
  // with a new `key` (see the showcase), so `initialBlocks` is read-once by design.
  const initialEditorStateRef = useRef<string>()
  if (initialEditorStateRef.current === undefined) {
    initialEditorStateRef.current = JSON.stringify(blocksToDocState(initialBlocks))
  }
  const initialEditorState = initialEditorStateRef.current

  const initialConfig = useMemo(
    () => ({
      namespace: 'post-doc-editor',
      nodes: [HeadingNode, PostBlockNode],
      editorState: initialEditorState,
      theme: EDITOR_THEME,
      onError(error: Error) {
        console.error('[PostDocEditor] lexical error', error)
      },
    }),
    [initialEditorState]
  )

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (!onBlocksChange) return
      onBlocksChange(docToBlocks(editorState.toJSON()))
    },
    [onBlocksChange]
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditSessionProvider>
      <div style={{ position: 'relative' }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="pde-content"
              style={{
                outline: 'none',
                minHeight: 320,
                padding: '20px 24px',
                border: '1px solid var(--borderColor)',
                borderRadius: 12,
                lineHeight: 1.7,
                cursor: armed ? 'crosshair' : 'text',
              }}
              aria-placeholder="Write your post… pick a tool from the floating toolbar to drop in a Location, Speaker, Date, and more."
              placeholder={
                <div
                  style={{
                    position: 'absolute',
                    top: 20,
                    left: 24,
                    color: 'var(--color10)',
                    pointerEvents: 'none',
                  }}
                >
                  Write your post… use the floating toolbar to drop in structured elements.
                </div>
              }
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <ArmedToolPlugin armed={armed} onInserted={() => setArmed(null)} />
      </div>
      <FloatingToolbar armed={armed} onArm={setArmed} />
      </EditSessionProvider>
    </LexicalComposer>
  )
}
