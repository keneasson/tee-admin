'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { YStack, LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { SpeakerInvitesList } from '@my/app/features/speaker-invites'

/** Speaker invitations list (spec §9). The API scopes it to the inviter's ecclesia. */
function SpeakerInvitesPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const justSent = useSearchParams()?.get('sent') === '1'
  if (!isHydrated) return <LoadingState label="invitations" />
  return (
    <YStack flex={1} padding="$4">
      <SpeakerInvitesList justSent={justSent} onNew={() => router.push('/admin/speaker-invites/new')} />
    </YStack>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="invitations" />}>
      <SpeakerInvitesPage />
    </Suspense>
  )
}
