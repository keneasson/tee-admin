'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Text, Spinner, Heading } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { PeopleBrowser } from '@my/ui/src/people/people-browser'

interface Member {
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
}

export default function AdminContactsPage() {
  const { isMemberOrHigher, isLoading: authLoading } = useUserRole()
  const router = useRouter()
  const isHydrated = useHydrated()
  const [members, setMembers] = useState<Member[]>([])
  const [ecclesias, setEcclesias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEcclesia, setSelectedEcclesia] = useState<string | null>(null)
  const defaultApplied = useRef(false)

  const fetchMembers = useCallback(async (ecclesiaOverride?: string | null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      const ecc = ecclesiaOverride !== undefined ? ecclesiaOverride : selectedEcclesia
      if (ecc) params.set('ecclesia', ecc)

      const res = await fetch(`/api/people?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setEcclesias(data.ecclesias || [])

        // On first load, default to viewer's home ecclesia
        if (!defaultApplied.current && data.viewerEcclesia) {
          defaultApplied.current = true
          setSelectedEcclesia(data.viewerEcclesia)
        }
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedEcclesia])

  useEffect(() => {
    if (isMemberOrHigher) {
      fetchMembers()
    }
  }, [isMemberOrHigher, fetchMembers])

  const handleMemberClick = (email: string) => {
    router.push(`/people/${encodeURIComponent(email)}`)
  }

  if (!isHydrated || authLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  if (!isMemberOrHigher) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text>You need to be a member to view the Contact List.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <YStack gap="$2">
        <Heading size="$8">Contact List</Heading>
        <Text color="$textSecondary">
          Browse and manage community contacts
        </Text>
      </YStack>

      <PeopleBrowser
        members={members}
        ecclesias={ecclesias}
        loading={loading}
        defaultEcclesia={selectedEcclesia}
        onMemberClick={handleMemberClick}
        onSearch={setSearchQuery}
        onFilterEcclesia={setSelectedEcclesia}
      />
    </YStack>
  )
}
