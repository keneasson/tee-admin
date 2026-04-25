'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Text, Spinner, Heading, Card, ScrollView } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { AddMemberForm, type AddMemberFormData } from '@my/ui/src/form/add-member-form'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { Button } from 'tamagui'

export default function DirectoryAddMemberPage() {
  const { isMemberOrHigher, isLoading: authLoading } = useUserRole()
  const router = useRouter()
  const isHydrated = useHydrated()
  const [ecclesias, setEcclesias] = useState<string[]>([])
  const [viewerEcclesia, setViewerEcclesia] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [fetchingEcclesias, setFetchingEcclesias] = useState(true)

  const fetchEcclesias = useCallback(async () => {
    try {
      const res = await fetch('/api/people?noCache=true')
      if (res.ok) {
        const data = await res.json()
        setEcclesias(data.ecclesias || [])
        setViewerEcclesia(data.viewerEcclesia || undefined)
      }
    } catch (error) {
      console.error('Error fetching ecclesias:', error)
    } finally {
      setFetchingEcclesias(false)
    }
  }, [])

  useEffect(() => {
    if (isMemberOrHigher) {
      fetchEcclesias()
    }
  }, [isMemberOrHigher, fetchEcclesias])

  const handleSave = async (data: AddMemberFormData): Promise<boolean> => {
    setIsLoading(true)
    setResultMessage(null)
    try {
      const response = await fetch('/api/people/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setResultMessage(result.error || 'Failed to add member')
        return false
      }

      if (result.mode === 'direct') {
        router.push('/directory/people')
      } else {
        setResultMessage('Draft submitted for approval. A recorder or admin will review it.')
        setTimeout(() => router.push('/directory/people'), 2000)
      }
      return true
    } catch (error) {
      console.error('Error adding member:', error)
      setResultMessage('Network error. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/directory/people')
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
        <Text>You need to be a member to add contacts.</Text>
      </YStack>
    )
  }

  return (
    <ScrollView flex={1}>
      <YStack flex={1} padding="$4" gap="$4" maxWidth={700}>
        <XStack>
          <Button
            size="$3"
            variant="outlined"
            icon={ArrowLeft}
            onPress={handleCancel}
            borderWidth={0}
            chromeless
          >
            Back to Contact List
          </Button>
        </XStack>

        <YStack gap="$1">
          <Heading size="$7" fontWeight="700">Christadelphian Directory</Heading>
          <Text fontSize="$2" color="$gray11" fontStyle="italic">
            Malachi 3:16 Then those who feared the Lord spoke with one another. The Lord paid attention and heard them, and a book of remembrance was written before him of those who feared the Lord and esteemed his name.
          </Text>
        </YStack>

        <YStack gap="$2">
          <Heading size="$8">Add New Member</Heading>
          <Text color="$textSecondary">
            Add a new person to the community contact list.
          </Text>
        </YStack>

        <Card bordered padding="$4" backgroundColor="$brandLight">
          {fetchingEcclesias ? (
            <XStack alignItems="center" justifyContent="center" padding="$6" gap="$2">
              <Spinner size="small" width={20} height={20} />
              <Text fontSize="$3" theme="alt2">Loading...</Text>
            </XStack>
          ) : (
            <AddMemberForm
              defaultEcclesia={viewerEcclesia}
              ecclesias={ecclesias}
              onSave={handleSave}
              onCancel={handleCancel}
              isLoading={isLoading}
              resultMessage={resultMessage}
            />
          )}
        </Card>
      </YStack>
    </ScrollView>
  )
}
