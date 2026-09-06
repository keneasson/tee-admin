'use client'

/**
 * LinkEditor — the minimal Link widget for the document-canvas editor
 * (Consolidated CMS 2R-2). A link is the simplest structured block: a URL and an
 * optional display label. Kept deliberately tiny (no resolver) but in the same
 * spirit — forgiving input (a bare "example.com" is normalized to a real URL on
 * blur) and the published view shows `label || url`.
 *
 * Web-only; URL helpers are unit-tested in {@link link-resolve.ts}.
 */

import { YStack, Text, Input } from 'tamagui'
import type { LinkBlock } from '@my/app/types/post'
import { normalizeUrl } from '@my/app/features/post-editor/resolvers/link-resolve'

export interface LinkEditorProps {
  block: LinkBlock
  onChange: (next: LinkBlock) => void
}

export function LinkEditor({ block, onChange }: LinkEditorProps) {
  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$color11">
          URL
        </Text>
        <Input
          value={block.url ?? ''}
          onChangeText={(t) => onChange({ ...block, url: t })}
          onBlur={() => {
            const normalized = normalizeUrl(block.url ?? '')
            if (normalized !== block.url) onChange({ ...block, url: normalized })
          }}
          placeholder="example.com or https://…"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </YStack>
      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Link text (optional)
        </Text>
        <Input
          value={block.label ?? ''}
          onChangeText={(t) => onChange({ ...block, label: t || undefined })}
          placeholder="Shown instead of the URL — e.g. “Register here”"
        />
      </YStack>
    </YStack>
  )
}
