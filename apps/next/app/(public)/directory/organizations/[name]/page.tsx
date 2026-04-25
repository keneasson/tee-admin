'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { YStack, Text, Spinner, Card, Heading } from '@my/ui'
import { Button } from '@my/ui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { useUserRole } from '@/hooks/use-user-role'
import { OrganizationDetailView } from '@my/ui/src/organizations/organization-detail-view'
import type { OrganizationDetailData } from '@my/ui/src/organizations/organization-detail-view'

export default function DirectoryOrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isMemberOrHigher, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const showFeature = useFeatureFlag(FEATURE_FLAGS.MULTI_TENANT_INIT)

  const [organization, setOrganization] = useState<OrganizationDetailData | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const orgName = decodeURIComponent((params?.name as string) || '')

  const fetchOrganization = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgName)}`)
      if (res.ok) {
        const data = await res.json()
        setOrganization(data.organization)
        setCanEdit(data.canEdit || false)
        setCanDelete(data.canDelete || false)
      } else if (res.status === 404) {
        setError('Organization not found')
      } else {
        setError('Failed to load organization')
      }
    } catch (err) {
      console.error('Error fetching organization:', err)
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }, [orgName])

  useEffect(() => {
    if (isMemberOrHigher && showFeature && orgName) {
      fetchOrganization()
    }
  }, [isMemberOrHigher, showFeature, orgName, fetchOrganization])

  const handleUpdate = async (updates: Partial<OrganizationDetailData>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        await fetchOrganization()
        return true
      }
      const data = await res.json()
      console.error('Update failed:', data.error)
      return false
    } catch (err) {
      console.error('Error updating organization:', err)
      return false
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgName)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.push('/directory/organizations')
      } else {
        const data = await res.json()
        alert(`Failed to delete: ${data.error}`)
      }
    } catch {
      alert('Failed to delete organization')
    }
  }

  if (!isHydrated || authLoading || loading) {
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
        <Text>Please sign in to view organization details.</Text>
      </YStack>
    )
  }

  if (!showFeature) {
    return null
  }

  if (error) {
    return (
      <YStack flex={1} padding="$4" gap="$4">
        <Button
          alignSelf="flex-start"
          icon={ArrowLeft}
          onPress={() => router.push('/directory/organizations')}
        >
          Back to Organizations
        </Button>
        <Card padding="$4" backgroundColor="$red2">
          <Text fontSize="$4" color="$red10">{error}</Text>
        </Card>
      </YStack>
    )
  }

  if (!organization) {
    return null
  }

  return (
    <YStack padding="$4" gap="$4">
      <Button
        alignSelf="flex-start"
        icon={ArrowLeft}
        onPress={() => router.push('/directory/organizations')}
      >
        Back to Organizations
      </Button>
      <OrganizationDetailView
        organization={organization}
        canEdit={canEdit}
        canDelete={canDelete}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBack={() => router.push('/directory/organizations')}
      />
    </YStack>
  )
}
