'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Text, Spinner, Heading } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { PeopleBrowser } from '@my/ui/src/people/people-browser'

interface Member {
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
}

export default function AdminContactsPage() {
  const { hasAccess, isLoading: authLoading } = useAdminAccess()
  const router = useRouter()
  const isHydrated = useHydrated()
  const [members, setMembers] = useState<Member[]>([])
  const [ecclesias, setEcclesias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEcclesia, setSelectedEcclesia] = useState<string | null>(null)
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null)

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
    if (hasAccess) {
      fetchMembers()
    }
  }, [hasAccess, fetchMembers])

  const handleMemberClick = (email: string) => {
    router.push(`/people/${encodeURIComponent(email)}`)
  }

  const handleDelete = async (email: string) => {
    const member = members.find(m => m.email === email)
    const name = member?.name || email

    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will remove them from the directory and unsubscribe them from email lists.`)) {
      return
    }

    setDeletingEmail(email)
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Deleted ${result.deletedRecords} record(s)${result.unsubscribedFromSES ? ' and unsubscribed from email lists' : ''}`)
        fetchMembers() // Refresh the list
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    } finally {
      setDeletingEmail(null)
    }
  }

  if (!isHydrated || authLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
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
        onMemberClick={handleMemberClick}
        onSearch={setSearchQuery}
        onFilterEcclesia={setSelectedEcclesia}
        onDelete={handleDelete}
        deletingEmail={deletingEmail}
      />
    </YStack>
  )
}
