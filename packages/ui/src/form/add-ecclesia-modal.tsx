import { useState } from 'react'
import { Dialog, Button } from 'tamagui'
import { Plus } from '@tamagui/lucide-icons'
import { AddEcclesiaForm } from './add-ecclesia-form'

interface EcclesiaFormData {
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
}

interface AddEcclesiaModalProps {
  initialData?: Partial<EcclesiaFormData>
  /** @deprecated Use initialData instead */
  initialName?: string
  onEcclesiaAdded: (ecclesia: EcclesiaFormData) => void
  trigger?: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'add' | 'edit'
}

// API function for saving ecclesia
const saveNewEcclesia = async (data: EcclesiaFormData): Promise<boolean> => {
  try {
    const response = await fetch('/api/ecclesia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('Save failed:', result.error)
    }

    return result.success
  } catch (error) {
    console.error('Error saving new ecclesia:', error)
    return false
  }
}

// API function for updating ecclesia
const updateEcclesia = async (originalName: string, data: EcclesiaFormData): Promise<boolean> => {
  try {
    const response = await fetch('/api/ecclesia', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ originalName, ...data }),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('Update failed:', result.error)
    }

    return result.success
  } catch (error) {
    console.error('Error updating ecclesia:', error)
    return false
  }
}

export function AddEcclesiaModal({
  initialData,
  initialName = '',
  onEcclesiaAdded,
  trigger,
  isOpen = false,
  onOpenChange,
  mode = 'add'
}: AddEcclesiaModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange?.(newOpen)
  }

  const handleSave = async (ecclesiaData: EcclesiaFormData): Promise<boolean> => {
    setIsLoading(true)
    try {
      let success: boolean
      if (mode === 'edit' && initialData?.name) {
        success = await updateEcclesia(initialData.name, ecclesiaData)
      } else {
        success = await saveNewEcclesia(ecclesiaData)
      }

      if (success) {
        // Close modal and notify parent
        handleOpenChange(false)
        onEcclesiaAdded(ecclesiaData)
        return true
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    handleOpenChange(false)
  }

  const title = mode === 'edit' ? 'Edit Ecclesia' : 'Add New Ecclesia'
  const description = mode === 'edit'
    ? `Update the details for "${initialData?.name || ''}".`
    : initialData?.name || initialName
      ? `Add "${initialData?.name || initialName}" as a new ecclesia in our directory.`
      : 'Add a new ecclesia to our directory.'

  return (
    <Dialog modal open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <Dialog.Trigger asChild>
          {trigger}
        </Dialog.Trigger> : null}

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
            {title}
          </Dialog.Title>

          <Dialog.Description
            padding="$4"
            paddingTop="$0"
            paddingBottom="$2"
            color="$textSecondary"
          >
            {description}
          </Dialog.Description>

          <AddEcclesiaForm
            initialData={initialData}
            initialName={initialName}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isLoading}
            mode={mode}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

// Convenience component with default trigger
export function AddEcclesiaButton({
  initialName,
  onEcclesiaAdded,
  buttonText = "Add New Ecclesia"
}: Omit<AddEcclesiaModalProps, 'trigger'> & { buttonText?: string }) {
  return (
    <AddEcclesiaModal
      initialName={initialName}
      onEcclesiaAdded={onEcclesiaAdded}
      trigger={
        <Button
          size="$3"
          theme="blue"
          icon={Plus}
          borderWidth={2}
        >
          {buttonText}
        </Button>
      }
    />
  )
}