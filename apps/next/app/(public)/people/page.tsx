'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Section, Text, YStack, Spinner } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { PeopleBrowser } from '@my/ui/src/people/people-browser'

interface Member {
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
}

export default function PeoplePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isHydrated = useHydrated()
  const [members, setMembers] = useState<Member[]>([])
  const [ecclesias, setEcclesias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEcclesia, setSelectedEcclesia] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (selectedEcclesia) params.set('ecclesia', selectedEcclesia)

      const res = await fetch(`/api/people?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setEcclesias(data.ecclesias || [])
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedEcclesia])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMembers()
    }
  }, [status, fetchMembers])

  const handleMemberClick = (email: string) => {
    router.push(`/people/${encodeURIComponent(email)}`)
  }

  if (!isHydrated || status === 'loading') {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Spinner size="large" />
            <Text fontSize="$4" theme="alt2">Loading...</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Text fontSize="$4">Please sign in to view the contact list.</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <PeopleBrowser
          members={members}
          ecclesias={ecclesias}
          loading={loading}
          onMemberClick={handleMemberClick}
          onSearch={setSearchQuery}
          onFilterEcclesia={setSelectedEcclesia}
        />
      </Section>
    </Wrapper>
  )
}
