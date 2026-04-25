import { useState } from 'react'
import { YStack, XStack, Text, Input, Card, Spinner } from 'tamagui'
import { Button } from '../Button'
import { Check, X, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'

interface DraftMember {
  draftId: string
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  createdBy: string
  createdByName: string
  createdAt: string
}

interface DraftReviewPanelProps {
  drafts: DraftMember[]
  onApprove: (draftId: string, ecclesia: string) => Promise<void>
  onReject: (draftId: string, ecclesia: string, note?: string) => Promise<void>
  loading?: boolean
}

export function DraftReviewPanel({
  drafts,
  onApprove,
  onReject,
  loading = false,
}: DraftReviewPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  if (drafts.length === 0) return null

  const handleApprove = async (draftId: string, ecclesia: string) => {
    setProcessingId(draftId)
    try {
      await onApprove(draftId, ecclesia)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (draftId: string, ecclesia: string) => {
    setProcessingId(draftId)
    try {
      await onReject(draftId, ecclesia, rejectNotes[draftId])
      setShowRejectInput(prev => ({ ...prev, [draftId]: false }))
      setRejectNotes(prev => ({ ...prev, [draftId]: '' }))
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <Card bordered padding="$3" backgroundColor="$yellow2" borderColor="$yellow6">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        onPress={() => setExpanded(!expanded)}
        cursor="pointer"
      >
        <XStack alignItems="center" gap="$2">
          <Text fontWeight="600" fontSize="$4">
            Pending Drafts
          </Text>
          <XStack
            backgroundColor="$yellow8"
            borderRadius="$10"
            paddingHorizontal="$2"
            paddingVertical="$1"
          >
            <Text color="white" fontSize="$2" fontWeight="700">
              {drafts.length}
            </Text>
          </XStack>
        </XStack>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </XStack>

      {expanded ? (
        <YStack gap="$3" marginTop="$3">
          {loading ? (
            <XStack justifyContent="center" padding="$3">
              <Spinner size="small" width={20} height={20} />
            </XStack>
          ) : (
            drafts.map((draft) => (
              <Card key={draft.draftId} bordered padding="$3" backgroundColor="$background">
                <YStack gap="$2">
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack gap="$1" flex={1}>
                      <Text fontWeight="600" fontSize="$4">
                        {draft.firstName} {draft.lastName}
                      </Text>
                      <Text fontSize="$3" color="$textSecondary">{draft.email}</Text>
                      <Text fontSize="$2" color="$textSecondary">
                        {draft.ecclesia} — submitted by {draft.createdByName} on {formatDate(draft.createdAt)}
                      </Text>
                    </YStack>
                  </XStack>

                  {showRejectInput[draft.draftId] ? (
                    <YStack gap="$2">
                      <Input
                        placeholder="Optional: reason for rejection"
                        value={rejectNotes[draft.draftId] || ''}
                        onChangeText={(text) =>
                          setRejectNotes(prev => ({ ...prev, [draft.draftId]: text }))
                        }
                        borderWidth={1}
                        borderColor="$gray6"
                      />
                      <XStack gap="$2" justifyContent="flex-end">
                        <Button
                          size="$3"
                          variant="outlined"
                          onPress={() => setShowRejectInput(prev => ({ ...prev, [draft.draftId]: false }))}
                          disabled={processingId === draft.draftId}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="$3"
                          theme="red"
                          icon={processingId === draft.draftId ? <Spinner size="small" width={16} height={16} /> : X}
                          onPress={() => handleReject(draft.draftId, draft.ecclesia)}
                          disabled={processingId === draft.draftId}
                        >
                          Confirm Reject
                        </Button>
                      </XStack>
                    </YStack>
                  ) : (
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button
                        size="$3"
                        theme="red"
                        variant="outlined"
                        icon={X}
                        onPress={() => setShowRejectInput(prev => ({ ...prev, [draft.draftId]: true }))}
                        disabled={processingId !== null}
                      >
                        Reject
                      </Button>
                      <Button
                        size="$3"
                        theme="green"
                        icon={processingId === draft.draftId ? <Spinner size="small" width={16} height={16} /> : Check}
                        onPress={() => handleApprove(draft.draftId, draft.ecclesia)}
                        disabled={processingId !== null}
                      >
                        Approve
                      </Button>
                    </XStack>
                  )}
                </YStack>
              </Card>
            ))
          )}
        </YStack>
      ) : null}
    </Card>
  )
}
