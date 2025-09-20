import { styled, YStack } from 'tamagui'

// Section component for individual service content
// No border/background since parent Card provides that
export const Section = styled(YStack, {
  gap: '$2',
})