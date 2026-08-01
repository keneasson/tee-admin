'use client'

import { PostEditorShowcase } from '@my/ui/src/branding'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

/**
 * /admin/ui-ux/brand/post-editor — the /brand dev surface for the unified Post
 * block editor (Consolidated CMS Phase 2a). Mounts the PostEditor on an
 * in-memory draft so it can be developed in isolation. Admin/Owner only.
 */
export default function BrandPostEditorPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return <PostEditorShowcase />
}
