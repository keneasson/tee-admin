'use client'

/**
 * BlockWidget — how a {@link PostBlockNode} renders inside the document.
 *
 * THE DOCUMENT IS THE FINAL VERSION. This widget renders the structured element's
 * PUBLISHED appearance via the shared {@link BlockView} — the exact renderer the
 * read-only post/newsletter uses — so a Location in the doc looks like a Location
 * in the finished post, not a form. No field labels, no blue form box, no inline
 * metadata.
 *
 * Editing is EDITOR-SPACE, not document-space: hovering reveals a small floating
 * affordance ("Edit this {kind}" · Remove) at the element's edge — like Google
 * Docs image handles. "Edit" lifts this node into the {@link useEditSession}, and
 * the FLOATING toolbar swaps into an Edit panel hosting the element's real editor
 * (see {@link FloatingToolbar}). The form lives in the tool, never in the doc.
 *
 * A freshly-placed element has no content yet, so {@link BlockView} would render
 * nothing; we show a subtle placeholder chip instead so the element stays visible
 * and hoverable until its details are filled in from the floating editor.
 */

import { useCallback, useState } from 'react'
import { $getNodeByKey, type NodeKey } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { XStack, Text } from '@my/ui'
import { BlockView } from '@my/ui/src/post-view/post-view'
import {
  Pencil,
  Trash2,
  MapPin,
  Users,
  Clock,
  FileImage,
  ClipboardCheck,
  Link as LinkIcon,
} from '@tamagui/lucide-icons'
import type { Block } from '@my/app/types/post'
import { $isPostBlockNode } from './post-block-node'
import { useEditSession } from './edit-session'

export interface BlockWidgetProps {
  nodeKey: NodeKey
  block: Block
}

export function BlockWidget({ nodeKey, block }: BlockWidgetProps) {
  const [editor] = useLexicalComposerContext()
  const { editingKey, beginEdit } = useEditSession()
  const [hovered, setHovered] = useState(false)

  const isEditing = editingKey === nodeKey

  const onEdit = useCallback(() => beginEdit(nodeKey), [beginEdit, nodeKey])

  const onRemove = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.remove()
    })
  }, [editor, nodeKey])

  const empty = isBlockEmpty(block)

  return (
    // contentEditable=false so the element is an atomic object in the prose flow
    // (its own selection / hover), not editable text. Relative so the hover
    // affordance can float in editor-space at the element's edge.
    <div
      contentEditable={false}
      suppressContentEditableWarning
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        margin: '12px 0',
        borderRadius: 8,
        // Editor-space only: a faint ring on hover / while editing marks the
        // element as interactive WITHOUT printing metadata into the document.
        outline: isEditing
          ? '2px solid var(--blue8)'
          : hovered
            ? '2px solid var(--blue5)'
            : '2px solid transparent',
        outlineOffset: 4,
        transition: 'outline-color 120ms ease',
      }}
    >
      {empty ? (
        <PlaceholderChip block={block} onPress={onEdit} />
      ) : (
        <BlockView block={block} />
      )}

      {hovered || isEditing ? (
        <HoverAffordance kind={block.kind} onEdit={onEdit} onRemove={onRemove} />
      ) : null}
    </div>
  )
}

// ---- Editor-space hover affordance (floats at the element's top-right edge) ---

function HoverAffordance({
  kind,
  onEdit,
  onRemove,
}: {
  kind: Block['kind']
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: -14,
        right: 4,
        display: 'flex',
        gap: 4,
        zIndex: 5,
      }}
    >
      <button type="button" onClick={onEdit} style={affordanceBtn} aria-label={`Edit this ${kind}`}>
        <Pencil size={13} color="var(--blue11)" />
        <span style={{ marginLeft: 5 }}>Edit this {kind}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        style={{ ...affordanceBtn, paddingRight: 8 }}
        aria-label={`Remove this ${kind}`}
      >
        <Trash2 size={13} color="var(--red10)" />
      </button>
    </div>
  )
}

const affordanceBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 26,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--blue11)',
  background: 'var(--background)',
  border: '1px solid var(--borderColor)',
  borderRadius: 13,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  cursor: 'pointer',
}

// ---- Placeholder for a not-yet-filled element --------------------------------

const KIND_META: Record<Block['kind'], { icon: typeof MapPin; label: string }> = {
  location: { icon: MapPin, label: 'location' },
  person: { icon: Users, label: 'speaker' },
  time: { icon: Clock, label: 'date & time' },
  flyer: { icon: FileImage, label: 'image / flyer' },
  registration: { icon: ClipboardCheck, label: 'registration' },
  link: { icon: LinkIcon, label: 'link' },
  text: { icon: LinkIcon, label: 'text' },
}

function PlaceholderChip({ block, onPress }: { block: Block; onPress: () => void }) {
  const meta = KIND_META[block.kind] ?? KIND_META.text
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: 'var(--blue2)',
        border: '1px dashed var(--blue7)',
        borderRadius: 8,
        cursor: 'pointer',
        color: 'var(--blue11)',
      }}
    >
      <XStack alignItems="center" gap="$2">
        <Icon size={15} color="var(--blue10)" />
        <Text fontSize="$3" color="$blue11">
          Add {meta.label} details
        </Text>
      </XStack>
    </button>
  )
}

// ---- Emptiness predicate (mirrors BlockView's null-render conditions) ---------

/** True when {@link BlockView} would render nothing for this block. */
export function isBlockEmpty(block: Block): boolean {
  switch (block.kind) {
    case 'location': {
      const hasAddress = Boolean(
        block.venueName || block.address || block.city || block.directions || block.parkingInfo
      )
      const hasOnline = Boolean(block.onlineMeeting?.link || block.onlineMeeting?.meetingId)
      const hasEcclesia = block.mode === 'ecclesia' && Boolean(block.ecclesiaRef)
      return !hasAddress && !hasOnline && !hasEcclesia
    }
    case 'person':
      return block.people.length === 0
    case 'time':
      return !block.startsAt && !block.label
    case 'flyer':
      return !block.document?.fileUrl?.trim() && !block.document?.thumbnailUrl?.trim()
    case 'registration':
      return !(
        block.required ||
        block.deadline ||
        block.registrationUrl ||
        block.contactEmail ||
        block.contactPhone ||
        block.hasFee ||
        block.notes
      )
    case 'link':
      return !block.url?.trim()
    case 'text':
      return !block.body?.trim()
    default:
      return true
  }
}
