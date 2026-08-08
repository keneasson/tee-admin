'use client'

/**
 * FloatingToolbar — the Photoshop-style floating, draggable, collapsible tool
 * palette (Consolidated CMS Phase 2R-1 keystone). It has TWO modes:
 *
 *  • INSERT mode (default) — a tool palette. Clicking a tool ARMS it; the next
 *    click in the document drops that structured element at the caret (see
 *    {@link ArmedToolPlugin}). Clicking the armed tool again — or Escape — disarms.
 *
 *  • EDIT mode — entered when an element in the document is opened for editing
 *    ({@link useEditSession} holds its node key). The palette is replaced by that
 *    element's REAL editor (the registry `Editor`), hosted HERE in the floating
 *    tool rather than inline in the document. Every keystroke writes the full next
 *    block back onto the Lexical node, so the document's FINAL display updates
 *    live. "Done" returns to Insert mode.
 *
 * This is the whole point of the tool floating: the document stays the finished,
 * WYSIWYG version; all the form/metadata affordances live in the tool.
 *
 * Web-only editor chrome: raw DOM drag (never runs on native), Tamagui shell.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { $getNodeByKey, BLUR_COMMAND, COMMAND_PRIORITY_LOW, FOCUS_COMMAND } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { YStack, XStack, Text, Button, Separator } from '@my/ui'
import { GripVertical, ChevronDown, ChevronRight, MapPin, Check, X } from '@tamagui/lucide-icons'
import type { Block, LinkBlock, LocationBlock, PersonBlock, TimeBlock } from '@my/app/types/post'
import { getBlockDef } from '@my/ui/src/post-editor/registry'
import { registerDefaultBlocks } from '@my/ui/src/post-editor/register-default-blocks'
import { TOOLS, type ToolKind } from './tool-blocks'
import { useEditSession } from './edit-session'
import { $isPostBlockNode } from './post-block-node'
import { LocationResolver } from './widgets/location-resolver'
import { PersonResolver } from './widgets/person-resolver'
import { TimePicker } from './widgets/time-picker'
import { LinkEditor } from './widgets/link-editor'

// Populate the block registry (idempotent) so Edit mode can look up each kind's
// encapsulated editor. Same registry the block-form editor uses.
registerDefaultBlocks()

export interface FloatingToolbarProps {
  armed: ToolKind | null
  onArm: (kind: ToolKind | null) => void
}

export function FloatingToolbar({ armed, onArm }: FloatingToolbarProps) {
  const [editor] = useLexicalComposerContext()
  const [pos, setPos] = useState({ x: 24, y: 120 })
  const [collapsed, setCollapsed] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hoverToolbar, setHoverToolbar] = useState(false)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const { editingKey } = useEditSession()

  // This toolbar belongs to ONE editor. On a page with several editors (e.g. the
  // showcase) each renders its own fixed toolbar; without gating they'd stack.
  // Show it only when THIS editor is engaged: focused, hovering its own toolbar,
  // a tool is armed, or an element is open for editing.
  useEffect(() => {
    const offFocus = editor.registerCommand(
      FOCUS_COMMAND,
      () => {
        setFocused(true)
        return false
      },
      COMMAND_PRIORITY_LOW
    )
    const offBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        setFocused(false)
        return false
      },
      COMMAND_PRIORITY_LOW
    )
    return () => {
      offFocus()
      offBlur()
    }
  }, [editor])

  const onHandleDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
      const move = (ev: MouseEvent) => {
        if (!dragOffset.current) return
        setPos({ x: ev.clientX - dragOffset.current.dx, y: ev.clientY - dragOffset.current.dy })
      }
      const up = () => {
        dragOffset.current = null
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [pos.x, pos.y]
  )

  // Escape disarms the current tool (Edit mode owns its own Escape via the panel).
  useEffect(() => {
    if (!armed || editingKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onArm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed, editingKey, onArm])

  const editing = editingKey != null
  const visible = focused || hoverToolbar || armed != null || editing
  if (!visible) return null

  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000, width: editing ? 320 : 244 }}
      onMouseEnter={() => setHoverToolbar(true)}
      onMouseLeave={() => setHoverToolbar(false)}
    >
      <YStack
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$background"
        borderRadius="$4"
        shadowColor="$shadowColor"
        shadowRadius={16}
        shadowOffset={{ width: 0, height: 4 }}
        elevation="$4"
        overflow="hidden"
        maxHeight="80vh"
      >
        {/* Drag handle / header — a native div so DOM mouse-drag is reliable. */}
        <div onMouseDown={onHandleDown} style={{ cursor: 'grab' }}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            backgroundColor="$backgroundHover"
          >
            <XStack alignItems="center" gap="$2">
              <GripVertical size={16} color="$color10" />
              <Text fontSize="$3" fontWeight="700">
                {editing ? 'Edit' : 'Insert'}
              </Text>
            </XStack>
            <Button
              size="$1"
              chromeless
              circular
              icon={collapsed ? ChevronRight : ChevronDown}
              aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
              onPress={() => setCollapsed((c) => !c)}
            />
          </XStack>
        </div>

        {collapsed ? null : editing ? (
          <EditPanel key={editingKey} nodeKey={editingKey!} />
        ) : (
          <InsertPanel armed={armed} onArm={onArm} />
        )}
      </YStack>
    </div>
  )
}

// ---- Insert mode: the tool palette ------------------------------------------

function InsertPanel({
  armed,
  onArm,
}: {
  armed: ToolKind | null
  onArm: (kind: ToolKind | null) => void
}) {
  const armedLabel = TOOLS.find((t) => t.kind === armed)?.label

  return (
    <YStack padding="$2" gap="$2">
      {armed ? (
        <XStack alignItems="center" gap="$2" padding="$2" borderRadius="$3" backgroundColor="$blue3">
          <MapPin size={14} color="$blue10" />
          <Text fontSize="$2" color="$blue11" flex={1}>
            Click in the document to place {armedLabel}. Esc to cancel.
          </Text>
        </XStack>
      ) : (
        <Text fontSize="$2" color="$color10" paddingHorizontal="$1">
          Pick a tool, then click where it should go.
        </Text>
      )}

      <YStack gap="$1">
        {TOOLS.map((tool) => {
          const isArmed = armed === tool.kind
          return (
            <Button
              key={tool.kind}
              size="$3"
              justifyContent="flex-start"
              disabled={!tool.enabled}
              opacity={tool.enabled ? 1 : 0.5}
              theme={isArmed ? 'blue' : undefined}
              backgroundColor={isArmed ? '$blue5' : undefined}
              hoverStyle={isArmed ? { backgroundColor: '$blue6' } : undefined}
              onPress={() => (tool.enabled ? onArm(isArmed ? null : tool.kind) : undefined)}
            >
              <XStack flex={1} justifyContent="space-between" alignItems="center">
                <Text fontSize="$3">{tool.label}</Text>
                {tool.enabled ? null : (
                  <Text fontSize="$1" color="$color10">
                    soon
                  </Text>
                )}
              </XStack>
            </Button>
          )
        })}
      </YStack>
    </YStack>
  )
}

// ---- Edit mode: host the element's real editor in the floating tool ----------

function EditPanel({ nodeKey }: { nodeKey: string }) {
  const [editor] = useLexicalComposerContext()
  const { endEdit } = useEditSession()

  // Seed a working copy from the node once; onChange streams edits back to the
  // node (live final-display update) AND keeps this copy in sync for the form.
  const [draft, setDraft] = useState<Block | null>(() => {
    let found: Block | null = null
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isPostBlockNode(node)) found = node.getBlock()
    })
    return found
  })

  const writeBack = useCallback(
    (next: Block) => {
      setDraft(next)
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isPostBlockNode(node)) node.setBlock(next)
      })
    },
    [editor, nodeKey]
  )

  const removeNode = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.remove()
    })
    endEdit()
  }, [editor, nodeKey, endEdit])

  // Escape closes the edit panel (returns the tool to Insert mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [endEdit])

  if (!draft) {
    return (
      <YStack padding="$3" gap="$2">
        <Text color="$color10">This element is no longer in the document.</Text>
        <Button size="$2" onPress={endEdit}>
          Close
        </Button>
      </YStack>
    )
  }

  const def = getBlockDef(draft.kind)
  const Editor = def?.Editor

  return (
    <YStack>
      <YStack padding="$3" gap="$3" overflow="scroll">
        <Text fontSize="$2" color="$color10">
          Editing this {def?.label ?? draft.kind} — the document updates as you type.
        </Text>
        {/* Purpose-built progressive widgets host their editor HERE in the floating
            tool (never inline in the doc). Kinds not yet redesigned fall back to
            the registry's block-form Editor. */}
        {draft.kind === 'location' ? (
          <LocationResolver
            block={draft as LocationBlock}
            onChange={writeBack as (next: LocationBlock) => void}
          />
        ) : draft.kind === 'person' ? (
          <PersonResolver
            block={draft as PersonBlock}
            onChange={writeBack as (next: PersonBlock) => void}
          />
        ) : draft.kind === 'time' ? (
          <TimePicker
            block={draft as TimeBlock}
            onChange={writeBack as (next: TimeBlock) => void}
          />
        ) : draft.kind === 'link' ? (
          <LinkEditor
            block={draft as LinkBlock}
            onChange={writeBack as (next: LinkBlock) => void}
          />
        ) : Editor ? (
          <Editor block={draft} onChange={writeBack} onRemove={removeNode} />
        ) : (
          <Text color="$color10">
            The "{draft.kind}" editor is coming in a later slice.
          </Text>
        )}
      </YStack>

      <Separator />
      <XStack padding="$2" gap="$2" justifyContent="flex-end">
        <Button size="$2" chromeless icon={X} onPress={removeNode} theme="red">
          Remove
        </Button>
        <Button size="$2" icon={Check} theme="blue" onPress={endEdit}>
          Done
        </Button>
      </XStack>
    </YStack>
  )
}
