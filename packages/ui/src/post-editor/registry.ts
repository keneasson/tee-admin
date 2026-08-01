import type { FC } from 'react'
import type { Block, BlockKind } from '@my/app/types/post'

/**
 * Block registry — the extensibility seam of the post editor
 * (docs/UNIFIED_POST_MODEL_DESIGN.md §3.1: "Each Block type is its own
 * encapsulated editor, registered in a block registry; the toolbar orchestrates
 * them.").
 *
 * A block definition bundles everything the editor needs to offer and render a
 * block kind: a toolbar `label`/`icon`, a `make()` factory for the toolbar's
 * "add" action, and the `Editor` component the canvas renders for each instance.
 * Adding a new block type is one `registerBlock(...)` call — the PostEditor,
 * toolbar, and canvas need no changes.
 *
 * Cross-platform: no platform imports; the registry is a plain module map.
 */

/** Props every block Editor receives. `onChange` emits the FULL next block. */
export interface BlockEditorProps<B extends Block = Block> {
  block: B
  onChange: (next: B) => void
  onRemove: () => void
}

export interface BlockDef<B extends Block = Block> {
  kind: BlockKind
  /** Toolbar label (e.g. 'Text', 'Date & time'). */
  label: string
  /** Toolbar icon (Tamagui / Lucide icon component — a function component). */
  icon?: FC<{ size?: number | string; color?: string }>
  /** Factory for a fresh, empty block of this kind (used by the toolbar). */
  make: () => B
  /** The block's encapsulated editor, rendered per-instance on the canvas. */
  Editor: FC<BlockEditorProps<B>>
}

const registry = new Map<BlockKind, BlockDef>()

/**
 * Register (or override) the definition for a block kind. Typed per-block-kind
 * at the call site; stored type-erased so the editor can iterate uniformly.
 */
export function registerBlock<B extends Block>(
  kind: B['kind'],
  def: Omit<BlockDef<B>, 'kind'>
): void {
  registry.set(kind, { kind, ...def } as unknown as BlockDef)
}

export function getBlockDef(kind: BlockKind): BlockDef | undefined {
  return registry.get(kind)
}

/** All registered block definitions, in registration order (toolbar order). */
export function listBlockDefs(): BlockDef[] {
  return Array.from(registry.values())
}

/** Test/util helper — empties the registry so a test starts from a clean slate. */
export function clearBlockRegistry(): void {
  registry.clear()
}
