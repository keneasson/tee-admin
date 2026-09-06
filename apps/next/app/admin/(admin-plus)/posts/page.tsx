'use client'

import { useRouter } from 'next/navigation'
import { PostListScreen } from '@my/app/features/post-editor'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'

/**
 * /admin/posts — mount point for the shared post list (ADR-0003).
 *
 * Flag-gated the same way as the editor and its API: the underlying
 * `GET /api/admin/posts` 404s outright when CONSOLIDATED_CMS is off, so an
 * un-flagged admin sees a load error here, not partial functionality.
 */
export default function AdminPostsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const router = useRouter()

  return (
    <PostListScreen
      hasAccess={Boolean(hasAccess)}
      isAuthLoading={!isHydrated || isLoading}
      onOpenPost={(id) => router.push(`/admin/posts/${id}`)}
      onNewPost={() => router.push('/admin/posts/new')}
    />
  )
}
