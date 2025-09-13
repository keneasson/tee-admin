import { Control, FieldValues } from 'react-hook-form'
import { Card, Text, YStack, XStack } from 'tamagui'

export interface BaseFormSectionProps<T extends FieldValues> {
  control: Control<T>
  title: string
  description?: string
  icon?: React.ComponentType<any>
  required?: boolean
  onFieldChange?: () => void
}

export function BaseFormSection<T extends FieldValues>({
  title,
  description,
  icon: IconComponent,
  children,
  required = false
}: BaseFormSectionProps<T> & { children: React.ReactNode }) {
  return (
    <Card p="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$4">
        <XStack gap="$2" alignItems="center">
          {IconComponent && <IconComponent size="$1" color="$blue10" />}
          <Text fontSize="$5" fontWeight="600">
            {title}
            {required && <Text color="$red10"> *</Text>}
          </Text>
        </XStack>
        
        {description && (
          <Text color="$gray11" fontSize="$3">
            {description}
          </Text>
        )}
        
        {children}
      </YStack>
    </Card>
  )
}