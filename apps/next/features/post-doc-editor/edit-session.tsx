'use client'

/**
 * EditSession — the seam that keeps the document a FINAL, WYSIWYG surface while
 * editing happens in the FLOATING tool (Consolidated CMS Phase 2R-1, the
 * "document is the final version" redo).
 *
 * The document never hosts a form. Each structured element renders its published
 * appearance (see {@link BlockWidget} → PostView renderers). To change one you
 * "Edit" it — that lifts the element's Lexical node key here; the
 * {@link FloatingToolbar} reads it and swaps from Insert mode into an Edit panel
 * hosting that element's registry editor. Exactly one element is editable at a
 * time; `editingKey` is that element (or null = the toolbar is in Insert mode).
 *
 * Provided INSIDE the LexicalComposer so both the decorator widgets and the
 * floating toolbar (siblings under the composer) share it via React context.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { NodeKey } from 'lexical'

interface EditSessionValue {
  /** The node currently open in the floating editor, or null (Insert mode). */
  editingKey: NodeKey | null
  /** Open the floating editor on a node (called from a widget's "Edit"). */
  beginEdit: (key: NodeKey) => void
  /** Close the floating editor, returning the toolbar to Insert mode. */
  endEdit: () => void
}

const EditSessionContext = createContext<EditSessionValue | null>(null)

export function EditSessionProvider({ children }: { children: ReactNode }) {
  const [editingKey, setEditingKey] = useState<NodeKey | null>(null)
  const value = useMemo<EditSessionValue>(
    () => ({
      editingKey,
      beginEdit: (key) => setEditingKey(key),
      endEdit: () => setEditingKey(null),
    }),
    [editingKey]
  )
  return <EditSessionContext.Provider value={value}>{children}</EditSessionContext.Provider>
}

export function useEditSession(): EditSessionValue {
  const ctx = useContext(EditSessionContext)
  if (!ctx) {
    // Decorators can, in edge cases, render a frame before the provider mounts;
    // fall back to an inert session rather than throwing inside Lexical.
    return { editingKey: null, beginEdit: () => {}, endEdit: () => {} }
  }
  return ctx
}
