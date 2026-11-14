'use client'

import { useRouter } from 'next/navigation'
import { YStack, LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { InviteProgramsScreen } from '@my/app/features/speaker-invites'
import { useUserRole } from '@/hooks/use-user-role'

/** Invitation programs (spec §3a). The ecclesia is the inviter's own; only the owner picks. */
export default function InviteProgramsPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const { session, isOwner, isLoading } = useUserRole()
  if (!isHydrated || isLoading) return <LoadingState />
  const ecclesia = (session?.user as { ecclesia?: string } | undefined)?.ecclesia ?? null
  return (
    <YStack flex={1} padding="$4">
      <InviteProgramsScreen
        ownEcclesia={ecclesia}
        isOwner={isOwner}
        onConnectSchedules={() => router.push('/admin/ecclesia-schedules')}
        onDone={() => router.push('/admin/speaker-invites')}
      />
    </YStack>
  )
}
