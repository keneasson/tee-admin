'use client'

import { PostDocEditorShowcase } from '@/features/post-doc-editor'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

/**
 * /admin/ui-ux/brand/post-doc-editor — /brand dev surface for the document-canvas
 * editor (Consolidated CMS Phase 2R-1 KEYSTONE). Mounts the Lexical-based
 * PostDocEditor on an in-memory draft with a live serialized-blocks panel so the
 * doc ⇄ blocks round-trip is visible. Admin/Owner only. The live posts page and
 * the old block-form editor are untouched.
 */
export default function BrandPostDocEditorPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return <PostDocEditorShowcase />
}
