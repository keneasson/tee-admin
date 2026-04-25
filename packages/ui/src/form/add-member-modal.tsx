import { useState } from 'react'
import { Dialog, Text } from 'tamagui'
import { AddMemberForm } from './add-member-form'

interface AddMemberResult {
  mode: 'direct' | 'draft'
  member?: { id: string; email: string; name: string; ecclesia: string }
  draft?: { draftId: string; firstName: string; lastName: string; email: string; ecclesia: string }
}

interface AddMemberModalProps {
  defaultEcclesia?: string
  ecclesias: string[]
  onMemberAdded: (result: AddMemberResult) => void
  trigger?: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddMemberModal({
  defaultEcclesia,
  ecclesias,
  onMemberAdded,
  trigger,
  isOpen = false,
  onOpenChange,
}: AddMemberModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResultMessage(null)
    }
    onOpenChange?.(newOpen)
  }

  const handleSave = async (data: {
    firstName: string
    lastName: string
    email: string
    ecclesia: string
  }): Promise<boolean> => {
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

      handleOpenChange(false)
      onMemberAdded(result)
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
    handleOpenChange(false)
  }

  return (
    <Dialog modal open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <Dialog.Trigger asChild>
          {trigger}
        </Dialog.Trigger>
      ) : null}

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="lazy"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation="quick"
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$0"
          padding="$0"
        >
          <Dialog.Title
            padding="$4"
            paddingBottom="$2"
            fontSize="$6"
            fontWeight="600"
          >
            Add New Member
          </Dialog.Title>

          <Dialog.Description
            padding="$4"
            paddingTop="$0"
            paddingBottom="$2"
            color="$textSecondary"
          >
            Add a new person to the contact list.
          </Dialog.Description>

          {resultMessage ? (
            <Text color="$red11" padding="$4" paddingTop="$0" fontSize="$3">
              {resultMessage}
            </Text>
          ) : null}

          <AddMemberForm
            defaultEcclesia={defaultEcclesia}
            ecclesias={ecclesias}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
