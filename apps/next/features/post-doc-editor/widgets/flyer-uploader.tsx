'use client'

/**
 * FlyerUploader — the IMAGE CHOOSER/UPLOADER for a {@link FlyerBlock}, hosted in
 * the floating tool's Edit panel (Consolidated CMS 2R-2). This is the "add / swap
 * the picture + its caption" half of the flyer; the in-canvas GEOMETRY (resize,
 * rotate, annotate) is the document's {@link FlyerCanvas} job and is NOT duplicated
 * here.
 *
 *   • No image yet → a file picker / drop zone. Choosing (or dropping) a file
 *     uploads it via POST /api/files/upload (multipart FormData) and, on success,
 *     writes the returned DocumentAttachment onto the block.
 *   • Has an image → a small preview + "Replace image" (re-runs the picker) + an
 *     "Alt text / caption" input bound to `document.description`.
 *
 * Web-only (fetch + <input type=file> + drag/drop); the pure decisions live in
 * {@link flyer-resolve.ts} (unit-tested there).
 */

import { useCallback, useRef, useState } from 'react'
import { YStack, XStack, Text, Button, Input, Spinner } from '@my/ui'
import { ImagePlus, UploadCloud, RefreshCw } from '@tamagui/lucide-icons'
import type { DocumentAttachment } from '@my/app/types/events'
import type { FlyerBlock } from '@my/app/types/post'
import { looksLikeImage } from '@my/ui/src/post-view/post-view-format'
import { FLYER_ACCEPT, hasFlyerImage } from './flyer-resolve'

export interface FlyerUploaderProps {
  block: FlyerBlock
  onChange: (next: FlyerBlock) => void
}

// Map the upload route's HTTP status onto a clear, author-facing message.
function uploadErrorFor(status: number): string {
  switch (status) {
    case 401:
      return 'Please sign in again to upload an image.'
    case 403:
      return 'You do not have permission to upload files.'
    case 413:
      return 'That file is too large. Try a smaller image.'
    case 415:
      return 'That file type is not supported. Choose an image.'
    default:
      return 'Upload failed. Please try again.'
  }
}

export function FlyerUploader({ block, onChange }: FlyerUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const doc = block.document
  const hasImage = hasFlyerImage(block)
  const previewUrl = doc.thumbnailUrl?.trim() || doc.fileUrl?.trim()

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        if (doc.description) form.append('description', doc.description)
        const res = await fetch('/api/files/upload', { method: 'POST', body: form })
        if (!res.ok) {
          setError(uploadErrorFor(res.status))
          return
        }
        const data = await res.json()
        const document = data?.document as DocumentAttachment | undefined
        if (!data?.success || !document?.fileUrl) {
          setError('Upload failed. Please try again.')
          return
        }
        onChange({ ...block, document })
      } catch {
        setError('Upload failed — check your connection and try again.')
      } finally {
        setUploading(false)
      }
    },
    [block, doc.description, onChange]
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset so re-picking the SAME file still fires onChange.
      e.target.value = ''
      if (file) void upload(file)
    },
    [upload]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void upload(file)
    },
    [upload]
  )

  const setCaption = useCallback(
    (description: string) =>
      onChange({ ...block, document: { ...doc, description: description || undefined } }),
    [block, doc, onChange]
  )

  const openPicker = useCallback(() => inputRef.current?.click(), [])

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <ImagePlus size={16} color="$color10" />
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Image / flyer
        </Text>
      </XStack>

      {/* Hidden native file input drives both the picker and "Replace". */}
      <input
        ref={inputRef}
        type="file"
        accept={FLYER_ACCEPT}
        style={{ display: 'none' }}
        onChange={onPick}
      />

      {hasImage ? (
        <YStack gap="$3">
          {previewUrl && looksLikeImage(previewUrl, doc.mimeType) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt={doc.description || doc.originalName || 'Flyer image'}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 240,
                height: 'auto',
                borderRadius: 8,
                border: '1px solid var(--borderColor)',
              }}
            />
          ) : (
            <Text fontSize="$2" color="$color10">
              {doc.originalName || doc.fileName || 'Uploaded file'}
            </Text>
          )}

          <Button
            size="$2"
            icon={uploading ? undefined : RefreshCw}
            disabled={uploading}
            justifyContent="flex-start"
            onPress={openPicker}
          >
            {uploading ? 'Uploading…' : 'Replace image'}
          </Button>

          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Alt text / caption
            </Text>
            <Input
              value={doc.description ?? ''}
              onChangeText={setCaption}
              placeholder="Describe the image (shown as a caption; helps accessibility)"
            />
          </YStack>
        </YStack>
      ) : (
        // Native div so DOM drag/drop is reliable (same approach as FlyerCanvas).
        <div
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '28px 16px',
            borderRadius: 10,
            border: `1px dashed ${dragOver ? 'var(--blue8)' : 'var(--borderColor)'}`,
            background: dragOver ? 'var(--blue3)' : 'var(--color1)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {uploading ? (
            <XStack alignItems="center" gap="$2">
              <Spinner size="small" />
              <Text fontSize="$2" color="$color10">
                Uploading…
              </Text>
            </XStack>
          ) : (
            <>
              <UploadCloud size={22} color="$color10" />
              <Text fontSize="$3" fontWeight="600" color="$color11">
                Choose an image
              </Text>
              <Text fontSize="$2" color="$color10">
                or drag &amp; drop it here
              </Text>
            </>
          )}
        </div>
      )}

      {error ? (
        <Text fontSize="$2" color="$red10">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
