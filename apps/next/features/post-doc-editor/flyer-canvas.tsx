'use client'

/**
 * FlyerCanvas — the Google-Docs in-canvas image treatment for a {@link FlyerBlock}
 * in the document (Consolidated CMS Phase 2R-1c).
 *
 * Idle, the image is the FINAL version — clean, no chrome. CLICK it and it becomes
 * "selected": blue selection handles appear at the corners (drag to resize) and a
 * small contextual toolbar floats beneath it (rotate · annotate · options · remove)
 * — exactly the on-canvas editing chrome from the design screenshots, in
 * editor-space, not printed into the document. The FULL image options (replace,
 * alt text, description) live in the floating tool's Edit panel via `onEditOptions`,
 * matching "all the options live in the Tool".
 *
 * Presentation edits (`displayWidth`, `rotation`, caption→`document.description`)
 * write the full next block back through `onChange`; the shared {@link FlyerBlockView}
 * honours them so the published post matches what you see here.
 *
 * Web-only (raw DOM drag; never runs on native), consistent with the rest of the
 * doc-editor chrome.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCw, MessageSquarePlus, Settings2, Trash2 } from '@tamagui/lucide-icons'
import type { FlyerBlock } from '@my/app/types/post'
import { looksLikeImage } from '@my/ui/src/post-view/post-view-format'

export interface FlyerCanvasProps {
  block: FlyerBlock
  selected: boolean
  onSelect: () => void
  onChange: (next: FlyerBlock) => void
  onEditOptions: () => void
  onRemove: () => void
}

const MIN_PCT = 10
const MAX_PCT = 100

export function FlyerCanvas({
  block,
  selected,
  onSelect,
  onChange,
  onEditOptions,
  onRemove,
}: FlyerCanvasProps) {
  const columnRef = useRef<HTMLDivElement>(null)
  const [captioning, setCaptioning] = useState(false)

  const { document: doc } = block
  const url = doc.fileUrl?.trim()
  const previewUrl = url && looksLikeImage(url, doc.mimeType) ? url : doc.thumbnailUrl?.trim()

  const widthPct = Math.min(MAX_PCT, Math.max(MIN_PCT, block.displayWidth ?? 100))
  const rotation = (((block.rotation ?? 0) % 360) + 360) % 360

  // Drag a corner handle → resize width as a % of the content column. `side`
  // is the horizontal direction the handle grows the image toward.
  const startResize = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const column = columnRef.current
      if (!column) return
      const basis = column.offsetWidth || 1
      const startX = e.clientX
      const startPct = widthPct

      const move = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        // Right handles grow with rightward drag; left handles with leftward.
        const deltaPct = ((side === 'right' ? dx : -dx) / basis) * 100
        const next = Math.round(Math.min(MAX_PCT, Math.max(MIN_PCT, startPct + deltaPct)))
        onChange({ ...block, displayWidth: next })
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [block, widthPct, onChange]
  )

  const rotate = useCallback(() => {
    onChange({ ...block, rotation: (rotation + 90) % 360 })
  }, [block, rotation, onChange])

  const setCaption = useCallback(
    (description: string) => onChange({ ...block, document: { ...doc, description } }),
    [block, doc, onChange]
  )

  // Escape / click-away clears the caption editor (selection is owned by the parent).
  useEffect(() => {
    if (!captioning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCaptioning(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [captioning])

  if (!previewUrl) {
    // No image yet — a placeholder chip that opens the options tool to add one.
    return (
      <button type="button" onClick={onEditOptions} style={placeholderStyle}>
        Add an image or flyer
      </button>
    )
  }

  return (
    <div ref={columnRef} style={{ width: '100%' }}>
      <div
        onClick={onSelect}
        style={{
          position: 'relative',
          width: `${widthPct}%`,
          maxWidth: 480,
          cursor: selected ? 'default' : 'pointer',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={doc.description || doc.originalName || 'Flyer image'}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            borderRadius: 8,
            border: selected ? '2px solid var(--blue9)' : '1px solid var(--borderColor)',
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
          }}
        />

        {selected ? (
          <>
            {/* Corner resize handles */}
            <Handle position="top-left" onMouseDown={startResize('left')} />
            <Handle position="top-right" onMouseDown={startResize('right')} />
            <Handle position="bottom-left" onMouseDown={startResize('left')} />
            <Handle position="bottom-right" onMouseDown={startResize('right')} />

            {/* Floating contextual toolbar beneath the image */}
            <div style={contextBarStyle} onClick={(e) => e.stopPropagation()}>
              <BarButton label="Rotate" onClick={rotate}>
                <RotateCw size={15} color="var(--color11)" />
              </BarButton>
              <BarButton label="Annotate" onClick={() => setCaptioning((c) => !c)}>
                <MessageSquarePlus size={15} color="var(--color11)" />
              </BarButton>
              <BarButton label="Image options" onClick={onEditOptions}>
                <Settings2 size={15} color="var(--color11)" />
              </BarButton>
              <BarButton label="Remove image" onClick={onRemove}>
                <Trash2 size={15} color="var(--red10)" />
              </BarButton>
            </div>
          </>
        ) : null}
      </div>

      {/* Caption (annotation) — writes document.description, shown under the image. */}
      {selected && captioning ? (
        <input
          autoFocus
          defaultValue={doc.description ?? ''}
          placeholder="Add a caption…"
          onChange={(e) => setCaption(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={captionInputStyle}
        />
      ) : doc.description ? (
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--color11)' }}>{doc.description}</div>
      ) : null}
    </div>
  )
}

// ---- Corner handle ----------------------------------------------------------

function Handle({
  position,
  onMouseDown,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  onMouseDown: (e: React.MouseEvent) => void
}) {
  const [v, h] = position.split('-') as ['top' | 'bottom', 'left' | 'right']
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        [v]: -6,
        [h]: -6,
        width: 12,
        height: 12,
        borderRadius: 3,
        background: 'var(--blue9)',
        border: '2px solid var(--background)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        cursor: position === 'top-left' || position === 'bottom-right' ? 'nwse-resize' : 'nesw-resize',
        zIndex: 6,
      }}
    />
  )
}

// ---- Contextual toolbar button ----------------------------------------------

function BarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} style={barBtnStyle}>
      {children}
    </button>
  )
}

// ---- Styles -----------------------------------------------------------------

const contextBarStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -46,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 2,
  padding: 4,
  background: 'var(--background)',
  border: '1px solid var(--borderColor)',
  borderRadius: 10,
  boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
  zIndex: 7,
}

const barBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 7,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
}

const captionInputStyle: React.CSSProperties = {
  marginTop: 8,
  width: '100%',
  maxWidth: 480,
  padding: '6px 10px',
  fontSize: 13,
  color: 'var(--color12)',
  background: 'var(--background)',
  border: '1px solid var(--blue7)',
  borderRadius: 6,
  outline: 'none',
}

const placeholderStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  background: 'var(--blue2)',
  border: '1px dashed var(--blue7)',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--blue11)',
  fontSize: 14,
}
