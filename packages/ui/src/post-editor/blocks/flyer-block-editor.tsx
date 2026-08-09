import { YStack, XStack, Label, Text, Input, Image } from 'tamagui'
import type { FlyerBlock } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'

/**
 * FlyerBlock editor — a single {@link DocumentAttachment}. PII can be baked
 * into pixels (unredactable), so under a PII-bearing occasion this block
 * defaults to `visibility: 'members'` at save time (design §5) — not this
 * editor's concern, it just captures the document.
 *
 * TODO(2c+): wire the real uploader (`packages/ui/src/form/document-upload.tsx`
 * — `DocumentUpload`) once block editors have a story for async upload
 * actions; it's built on `react-dropzone` + `POST /api/files/upload`, which
 * doesn't fit today's pure `value`/`onChange` contract without lifting an
 * upload callback through `BlockEditorProps`. For now: title + URL, with an
 * image preview when the URL looks like an image.
 */
export function makeFlyerBlock(): FlyerBlock {
  return {
    id: genId(),
    kind: 'flyer',
    document: {
      id: genId('doc'),
      documentType: 'upload',
      fileName: '',
      originalName: '',
      fileUrl: '',
      fileSize: 0,
      mimeType: '',
      uploadedAt: new Date(),
      uploadedBy: '',
    },
  }
}

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|svg)$/i

function looksLikeImage(url: string, mimeType: string): boolean {
  if (mimeType.startsWith('image/')) return true
  return IMAGE_EXTENSION.test(url)
}

export function FlyerBlockEditor({ block, onChange }: BlockEditorProps<FlyerBlock>) {
  const { document } = block

  const patchDocument = (patch: Partial<FlyerBlock['document']>) => {
    onChange({ ...block, document: { ...document, ...patch } })
  }

  const showPreview = document.fileUrl.trim() !== '' && looksLikeImage(document.fileUrl, document.mimeType)

  return (
    <YStack gap="$3">
      <YStack gap="$2">
        <Label htmlFor={`${block.id}-title`} fontSize="$3" fontWeight="600">
          Title
        </Label>
        <Input
          id={`${block.id}-title`}
          value={document.originalName}
          onChangeText={(originalName) => patchDocument({ originalName })}
          placeholder="Flyer title"
        />
      </YStack>

      <YStack gap="$2">
        <Label htmlFor={`${block.id}-url`} fontSize="$3" fontWeight="600">
          File URL
        </Label>
        <Input
          id={`${block.id}-url`}
          value={document.fileUrl}
          onChangeText={(fileUrl) => patchDocument({ fileUrl })}
          placeholder="https://…"
          autoCapitalize="none"
        />
        <Text fontSize="$2" color="$color10">
          TODO: replace with a real uploader — this is a URL + title placeholder for 2b.
        </Text>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={160} gap="$2">
          <Label htmlFor={`${block.id}-mime`} fontSize="$3" fontWeight="600">
            MIME type (optional)
          </Label>
          <Input
            id={`${block.id}-mime`}
            value={document.mimeType}
            onChangeText={(mimeType) => patchDocument({ mimeType })}
            placeholder="e.g. application/pdf, image/png"
            autoCapitalize="none"
          />
        </YStack>
        <YStack flex={1} minWidth={160} gap="$2">
          <Label htmlFor={`${block.id}-desc`} fontSize="$3" fontWeight="600">
            Description (optional)
          </Label>
          <Input
            id={`${block.id}-desc`}
            value={document.description ?? ''}
            onChangeText={(description) => patchDocument({ description })}
            placeholder="Short description"
          />
        </YStack>
      </XStack>

      {showPreview ? (
        <YStack gap="$2">
          <Label fontSize="$3" fontWeight="600">
            Preview
          </Label>
          <Image
            source={{ uri: document.fileUrl }}
            width={200}
            height={200}
            objectFit="contain"
            borderRadius="$2"
            borderWidth={1}
            borderColor="$borderColor"
          />
        </YStack>
      ) : null}
    </YStack>
  )
}
