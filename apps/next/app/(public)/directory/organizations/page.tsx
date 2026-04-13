'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Spinner, Text } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { useUserRole } from '@/hooks/use-user-role'
import { OrganizationList } from '@my/ui/src/organizations/organization-list'
import { OrganizationForm } from '@my/ui/src/organizations/organization-form'
import type { OrganizationFormData } from '@my/ui/src/organizations/organization-form'
import type { OrganizationCardData } from '@my/ui/src/organizations/organization-card'
import { Dialog } from 'tamagui'

export default function DirectoryOrganizationsPage() {
  const { isMemberOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const router = useRouter()
  const showFeature = useFeatureFlag(FEATURE_FLAGS.MULTI_TENANT_INIT)

  const [organizations, setOrganizations] = useState<OrganizationCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMemberOrHigher && showFeature) {
      fetchOrganizations()
    }
  }, [isMemberOrHigher, showFeature, fetchOrganizations])

  const handleCreate = async (data: OrganizationFormData): Promise<boolean> => {
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setCreateOpen(false)
        fetchOrganizations()
        return true
      }
      const err = await res.json()
      throw new Error(err.error || 'Failed to create')
    } catch (error: any) {
      throw error
    }
  }

  if (!isHydrated || authLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="small" width={20} height={20} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  if (status === 'unauthenticated' || !isMemberOrHigher) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text>Please sign in to view organizations.</Text>
      </YStack>
    )
  }

  if (!showFeature) {
    return null
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <OrganizationList
        organizations={organizations}
        loading={loading}
        onOrganizationClick={(name) => router.push(`/directory/organizations/${encodeURIComponent(name)}`)}
        onCreateClick={() => setCreateOpen(true)}
        canCreate={isAdminOrOwner}
      />

      {/* Create Organization Dialog */}
      <Dialog modal open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            key="content"
            bordered
            elevate
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            width={700}
            maxHeight="90vh"
          >
            <Dialog.Title fontSize="$1" opacity={0} height={0}>Create Organization</Dialog.Title>
            <OrganizationForm
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  )
}
