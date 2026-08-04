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

import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { Block, FlyerBlock } from '@my/app/types/post'
import { $isPostBlockNode } from './post-block-node'
import { useEditSession } from './edit-session'
import { FlyerCanvas } from './flyer-canvas'

export interface BlockWidgetProps {
  nodeKey: NodeKey
  block: Block
}

export function BlockWidget({ nodeKey, block }: BlockWidgetProps) {
  const [editor] = useLexicalComposerContext()
  const { editingKey, beginEdit } = useEditSession()
  const [hovered, setHovered] = useState(false)
  const [selected, setSelected] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const isEditing = editingKey === nodeKey

  const onEdit = useCallback(() => beginEdit(nodeKey), [beginEdit, nodeKey])

  const update = useCallback(
    (next: Block) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isPostBlockNode(node)) node.setBlock(next)
      })
    },
    [editor, nodeKey]
  )

  const onRemove = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.remove()
    })
  }, [editor, nodeKey])

  // Clicking anywhere outside this element clears its in-canvas selection.
  useEffect(() => {
    if (!selected) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setSelected(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [selected])

  // Flyer/image gets the Google-Docs in-canvas treatment (handles + contextual
  // toolbar), not the generic hover affordance.
  if (block.kind === 'flyer') {
    return (
      <div ref={rootRef} contentEditable={false} suppressContentEditableWarning style={{ margin: '12px 0' }}>
        <FlyerCanvas
          block={block as FlyerBlock}
          selected={selected}
          onSelect={() => setSelected(true)}
          onChange={update}
          onEditOptions={onEdit}
          onRemove={onRemove}
        />
      </div>
    )
  }

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

const KIND_ICON: Record<Block['kind'], typeof MapPin> = {
  location: MapPin,
  person: Users,
  time: Clock,
  flyer: FileImage,
  registration: ClipboardCheck,
  link: LinkIcon,
  text: LinkIcon,
}

const ROLE_TITLE: Record<string, string> = {
  deceased: 'In loving memory of',
  speaker: 'Speaker',
  candidate: 'Baptism candidate',
  bride: 'Bride',
  groom: 'Groom',
  sponsor: 'Sponsor',
  contact: 'Contact',
  other: 'Person',
}

/**
 * Structure annotation for an unfilled block: `title` names WHAT this structure is
 * (a template's section label like "Visitation", or the kind), `action` is the
 * call-to-fill. Placeholders read as clearly-labelled structure, not mystery boxes.
 */
function placeholderAnnotation(block: Block): { title: string; action: string } {
  switch (block.kind) {
    case 'location':
      return { title: block.label || 'Location', action: 'Add the address or venue' }
    case 'time':
      return { title: block.label || 'Date & time', action: 'Add the date and time' }
    case 'person':
      return { title: ROLE_TITLE[block.role] ?? 'Person', action: 'Add the name and details' }
    case 'flyer':
      return { title: 'Photo', action: 'Add an image or flyer' }
    case 'registration':
      return { title: 'Registration', action: 'Add registration details' }
    case 'link':
      return { title: 'Link', action: 'Add a URL' }
    default:
      return { title: 'Content', action: 'Add details' }
  }
}

/**
 * A faint, annotated placeholder for a not-yet-filled structure. "Faint but WCAG
 * accessible": the placeholder look comes from a muted/dashed CONTAINER, while the
 * text keeps accessible contrast ($color11/$color12) — never washed-out text.
 */
function PlaceholderChip({ block, onPress }: { block: Block; onPress: () => void }) {
  const Icon = KIND_ICON[block.kind] ?? LinkIcon
  const { title, action } = placeholderAnnotation(block)
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        background: 'var(--color2)',
        border: '1px dashed var(--color8)',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      <Icon size={18} color="var(--color11)" />
      <XStack flexDirection="column" gap="$0.5">
        <Text fontSize="$3" fontWeight="700" color="$color12">
          {title}
        </Text>
        <Text fontSize="$2" fontStyle="italic" color="$color11">
          {action}
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
      // A label alone (e.g. a template's "Visitation" heading) is annotation, not
      // data — the block is still an unfilled placeholder until it has a date.
      return !block.startsAt
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
