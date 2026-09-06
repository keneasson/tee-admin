'use client'

import { useParams, useRouter } from 'next/navigation'
import { PostEditorScreen } from '@my/app/features/post-editor'
import { PostDocEditorChrome } from '@/features/post-doc-editor'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

/**
 * /admin/posts/[id] — mount point for the shared authoring screen.
 *
 * Everything this route knows is web-specific: the params, the router, the
 * session, and the Lexical document canvas. The authoring behaviour itself lives
 * in `@my/app/features/post-editor` so Expo can mount the same screen.
 */
export default function AdminPostEditorPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading, user } = useAdminAccess()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  return (
    <PostEditorScreen
      routeId={params?.id}
      tenant={HOME_ECCLESIA.canonicalName}
      authorId={user?.email || 'unknown'}
      hasAccess={Boolean(hasAccess)}
      isAuthLoading={!isHydrated || isLoading}
      onOpenPost={(id) => router.push(`/admin/posts/${id}`)}
      onBack={() => router.push('/admin')}
      renderDocEditor={(props) => <PostDocEditorChrome {...props} />}
      confirmSend={(message) => window.confirm(message)}
    />
  )
}
