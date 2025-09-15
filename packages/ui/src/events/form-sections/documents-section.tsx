import { YStack } from 'tamagui'
import { Control } from 'react-hook-form'
import { DocumentUpload } from '../../form'
import { DocumentAttachment } from '@my/app/types/events'

interface DocumentsSectionProps {
  control: Control<any>
  documents: DocumentAttachment[]
  onChange: (documents: DocumentAttachment[]) => void
}

export function DocumentsSection({ control, documents, onChange }: DocumentsSectionProps) {
  return (
    <YStack gap="$4">
      <DocumentUpload
        documents={documents}
        onChange={onChange}
        maxFiles={10}
        allowedTypes={[
          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Text files
          'text/plain',
          'text/csv',
          // Images
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ]}
      />
    </YStack>
  )
}
