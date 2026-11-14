'use client'

import { useRouter } from 'next/navigation'
import { YStack, LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { SpeakerInviteComposer } from '@my/app/features/speaker-invites'
import { useUserRole } from '@/hooks/use-user-role'

/** Speaker invitation composer (spec §9). The ecclesia is the inviter's own; only the owner picks. */
export default function NewSpeakerInvitePage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const { session, isOwner, isLoading } = useUserRole()
  if (!isHydrated || isLoading) return <LoadingState />
  const ecclesia = (session?.user as { ecclesia?: string } | undefined)?.ecclesia ?? null
  return (
    <YStack flex={1} padding="$4">
      <SpeakerInviteComposer
        ownEcclesia={ecclesia}
        isOwner={isOwner}
        onSent={() => router.push('/admin/speaker-invites?sent=1')}
        onManagePrograms={() => router.push('/admin/speaker-invites/programs')}
      />
    </YStack>
  )
}
